/**
 * Model routing, discovery and failover.
 *
 * The bug this exists to fix: the server was hardcoded to call a Gemini model
 * ID that does not exist (a "3.8-flash"). Every single request
 * therefore threw, got swallowed by a `catch`, and silently degraded to the
 * canned fallback — so the product looked "working" while the actual AI had
 * never once run. Nothing in the UI reported this.
 *
 * The replacement:
 *  1. ask the API which models this key can actually use;
 *  2. pick the best one matching a preference order;
 *  3. retry transient failures with backoff, and fail over to the next model
 *     on a permanent error;
 *  4. surface the real reason upward instead of hiding it.
 */

import type { GoogleGenAI } from '@google/genai';

export interface ModelCandidate {
  id: string;
  /** Lower is better. */
  rank: number;
  note: string;
}

/**
 * Preference order. Discovery decides what is actually available; this only
 * decides which of the available models we would rather use.
 */
export const MODEL_PREFERENCES: ModelCandidate[] = [
  { id: 'gemini-2.5-flash', rank: 10, note: 'Fast, strong reasoning, generous free tier.' },
  { id: 'gemini-2.5-pro', rank: 20, note: 'Highest quality, slower and more expensive.' },
  { id: 'gemini-2.5-flash-lite', rank: 30, note: 'Cheapest and fastest; weaker on long reasoning.' },
  { id: 'gemini-2.0-flash', rank: 40, note: 'Previous generation workhorse.' },
  { id: 'gemini-2.0-flash-lite', rank: 50, note: 'Previous generation, minimal cost.' },
  { id: 'gemini-flash-latest', rank: 60, note: 'Floating alias to the current flash model.' },
  { id: 'gemini-pro-latest', rank: 70, note: 'Floating alias to the current pro model.' },
];

export interface ModelRouterState {
  /** Model currently being used. */
  active: string | null;
  /** Everything discovery found that supports generateContent. */
  available: string[];
  /** Models that failed permanently this process. */
  blacklisted: Record<string, string>;
  lastDiscoveryAt: number;
  lastError: string | null;
  discoverySource: 'api' | 'preference-probe' | 'none';
  consecutiveFailures: number;
}

const state: ModelRouterState = {
  active: null,
  available: [],
  blacklisted: {},
  lastDiscoveryAt: 0,
  lastError: null,
  discoverySource: 'none',
  consecutiveFailures: 0,
};

const DISCOVERY_TTL_MS = 10 * 60 * 1000;

export function getRouterState(): Readonly<ModelRouterState> {
  return { ...state, blacklisted: { ...state.blacklisted } };
}

export function resetRouter(): void {
  state.active = null;
  state.available = [];
  state.blacklisted = {};
  state.lastDiscoveryAt = 0;
  state.lastError = null;
  state.discoverySource = 'none';
  state.consecutiveFailures = 0;
}

function normalizeModelName(name: string): string {
  return name.replace(/^models\//, '');
}

/** Ask the API which models the configured key can call. */
export async function discoverModels(ai: GoogleGenAI, force = false): Promise<string[]> {
  const fresh = Date.now() - state.lastDiscoveryAt < DISCOVERY_TTL_MS;
  if (!force && fresh && state.available.length > 0) return state.available;

  try {
    const pager = await ai.models.list();
    const names: string[] = [];
    for await (const model of pager) {
      const raw = (model as { name?: string }).name;
      if (!raw) continue;
      const actions = (model as { supportedActions?: string[] }).supportedActions;
      // Some endpoints omit supportedActions; assume usable rather than drop it.
      if (actions && actions.length > 0 && !actions.includes('generateContent')) continue;
      names.push(normalizeModelName(raw));
    }
    if (names.length > 0) {
      state.available = names;
      state.lastDiscoveryAt = Date.now();
      state.discoverySource = 'api';
      state.lastError = null;
      return names;
    }
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
  }

  // Discovery failed (older endpoint, restricted key, offline). Fall back to
  // the preference list and let the call path prove which one works.
  state.available = MODEL_PREFERENCES.map((candidate) => candidate.id);
  state.lastDiscoveryAt = Date.now();
  state.discoverySource = 'preference-probe';
  return state.available;
}

/** Ordered list of models worth trying right now. */
export function resolveModelOrder(available: string[], override?: string): string[] {
  const availableSet = new Set(available.map(normalizeModelName));
  const ordered: string[] = [];

  if (override && !state.blacklisted[override]) ordered.push(override);

  for (const candidate of [...MODEL_PREFERENCES].sort((a, b) => a.rank - b.rank)) {
    if (state.blacklisted[candidate.id]) continue;
    if (availableSet.has(candidate.id) && !ordered.includes(candidate.id)) ordered.push(candidate.id);
  }

  // Anything else the key exposes, preferring flash-class models.
  const remainder = [...availableSet]
    .filter((name) => !ordered.includes(name) && !state.blacklisted[name])
    .filter((name) => name.startsWith('gemini'))
    .sort((a, b) => {
      const score = (name: string) => (name.includes('flash') ? 0 : name.includes('pro') ? 1 : 2);
      return score(a) - score(b) || b.localeCompare(a);
    });

  return [...ordered, ...remainder];
}

/** Classify an API error so the caller knows whether retrying can help. */
export function classifyError(error: unknown): {
  kind: 'AUTH' | 'NOT_FOUND' | 'RATE_LIMIT' | 'QUOTA' | 'TRANSIENT' | 'BAD_REQUEST' | 'UNKNOWN';
  retryable: boolean;
  failover: boolean;
  message: string;
} {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  const status = (error as { status?: number })?.status ?? 0;

  if (status === 401 || status === 403 || /api key not valid|permission denied|unauthenticated|invalid api key/.test(lower)) {
    return { kind: 'AUTH', retryable: false, failover: false, message };
  }
  if (status === 404 || /not found|is not supported|unsupported model|does not exist/.test(lower)) {
    return { kind: 'NOT_FOUND', retryable: false, failover: true, message };
  }
  if (status === 429 || /rate limit|too many requests/.test(lower)) {
    return { kind: 'RATE_LIMIT', retryable: true, failover: true, message };
  }
  if (/quota|exhausted|billing/.test(lower)) {
    return { kind: 'QUOTA', retryable: false, failover: true, message };
  }
  if (status >= 500 || /internal|unavailable|overloaded|deadline|timeout|econnreset|fetch failed|socket hang up/.test(lower)) {
    return { kind: 'TRANSIENT', retryable: true, failover: true, message };
  }
  if (status === 400 || /invalid argument|bad request/.test(lower)) {
    return { kind: 'BAD_REQUEST', retryable: false, failover: false, message };
  }
  return { kind: 'UNKNOWN', retryable: true, failover: true, message };
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface GenerateOptions {
  systemInstruction: string;
  contents: unknown[];
  temperature?: number;
  maxOutputTokens?: number;
  /** Force a particular model (used by the diagnostics probe). */
  modelOverride?: string;
  /** Attempts per model before moving on. */
  retriesPerModel?: number;
  timeoutMs?: number;
}

export interface GenerateOutcome {
  ok: boolean;
  text?: string;
  model?: string;
  attempts: { model: string; error: string; kind: string }[];
  error?: string;
  errorKind?: string;
  latencyMs: number;
}

/**
 * Generate content with automatic model failover.
 *
 * Every failure is recorded with its classification, so `/api/angel/diagnostics`
 * can tell the user *which* model failed and *why* instead of "AI unavailable".
 */
export async function generateWithFailover(ai: GoogleGenAI, options: GenerateOptions): Promise<GenerateOutcome> {
  const startedAt = Date.now();
  const attempts: { model: string; error: string; kind: string }[] = [];

  const available = await discoverModels(ai);
  const order = resolveModelOrder(available, options.modelOverride ?? state.active ?? undefined);

  if (order.length === 0) {
    return {
      ok: false,
      attempts,
      error: 'No usable model is available for this API key.',
      errorKind: 'NOT_FOUND',
      latencyMs: Date.now() - startedAt,
    };
  }

  const retries = options.retriesPerModel ?? 2;
  const timeoutMs = options.timeoutMs ?? 45_000;

  for (const model of order) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const call = ai.models.generateContent({
          model,
          contents: options.contents as never,
          config: {
            systemInstruction: options.systemInstruction,
            temperature: options.temperature ?? 0.7,
            ...(options.maxOutputTokens ? { maxOutputTokens: options.maxOutputTokens } : {}),
          },
        });

        const response = await Promise.race([
          call,
          sleep(timeoutMs).then(() => {
            throw new Error(`Request timed out after ${timeoutMs}ms`);
          }),
        ]);

        const text = (response as { text?: string }).text;
        if (!text || !text.trim()) throw new Error('Model returned an empty response');

        state.active = model;
        state.lastError = null;
        state.consecutiveFailures = 0;
        return { ok: true, text, model, attempts, latencyMs: Date.now() - startedAt };
      } catch (error) {
        const classified = classifyError(error);
        attempts.push({ model, error: classified.message, kind: classified.kind });
        state.lastError = classified.message;

        if (classified.kind === 'AUTH' || classified.kind === 'BAD_REQUEST') {
          state.consecutiveFailures++;
          return {
            ok: false,
            attempts,
            error: classified.message,
            errorKind: classified.kind,
            latencyMs: Date.now() - startedAt,
          };
        }
        if (classified.kind === 'NOT_FOUND' || classified.kind === 'QUOTA') {
          // Permanently unusable for this process — stop wasting calls on it.
          state.blacklisted[model] = classified.message;
          if (state.active === model) state.active = null;
          break;
        }
        if (classified.retryable && attempt < retries - 1) {
          await sleep(Math.min(400 * Math.pow(2, attempt), 4_000));
          continue;
        }
        break;
      }
    }
  }

  state.consecutiveFailures++;
  const last = attempts[attempts.length - 1];
  return {
    ok: false,
    attempts,
    error: last?.error ?? 'All candidate models failed.',
    errorKind: last?.kind ?? 'UNKNOWN',
    latencyMs: Date.now() - startedAt,
  };
}

/** Lightweight probe used by diagnostics — one tiny generation. */
export async function probeModel(ai: GoogleGenAI, model?: string): Promise<GenerateOutcome> {
  return generateWithFailover(ai, {
    systemInstruction: 'Reply with the single word: ok',
    contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
    temperature: 0,
    maxOutputTokens: 2000,
    modelOverride: model,
    retriesPerModel: 1,
    timeoutMs: 20_000,
  });
}
