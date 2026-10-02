/**
 * The adaptation layer.
 *
 * "Adapting" has to mean something measurable, so this module keeps a profile
 * that changes in response to observable evidence:
 *
 *  - language is learned from what the user actually types, not from a setting;
 *  - verbosity is learned from thumbs-down reasons and from how long the user's
 *    own messages are;
 *  - durable facts (name, account size, risk limit, goals) are extracted once
 *    and then re-asserted in every later prompt, which is what makes the
 *    assistant appear to remember;
 *  - every adjustment records why it happened, so the behaviour is auditable
 *    rather than mysterious.
 *
 * Pure functions with immutable updates — the same code runs in the browser and
 * on the server, and the server simply persists the result.
 */

export type DetectedLanguage = 'en' | 'tl' | 'taglish';
export type VerbosityLevel = 'TERSE' | 'BALANCED' | 'DETAILED';
export type FeedbackRating = 'UP' | 'DOWN';
export type FeedbackReason =
  | 'TOO_LONG'
  | 'TOO_SHORT'
  | 'WRONG_LANGUAGE'
  | 'INACCURATE'
  | 'GENERIC'
  | 'TOO_FORMAL'
  | 'HELPFUL'
  | 'OTHER';

export interface LearnedFact {
  key: string;
  value: string;
  /** Verbatim text the fact was taken from, so the user can check it. */
  evidence: string;
  confidence: number;
  learnedAt: number;
  /** How many times the fact has been re-observed. */
  reinforcements: number;
}

export interface FeedbackEvent {
  messageId: string;
  rating: FeedbackRating;
  reason?: FeedbackReason;
  note?: string;
  at: number;
}

export interface StyleAdjustment {
  at: number;
  field: string;
  from: string;
  to: string;
  because: string;
}

export interface UserProfile {
  version: 2;
  preferredName: string;
  /** Rolling counts of the language the user writes in. */
  languageCounts: Record<DetectedLanguage, number>;
  verbosity: VerbosityLevel;
  /** 0 = strictly professional, 1 = very warm. */
  warmth: number;
  /** Topics the user keeps returning to, with hit counts. */
  topicInterest: Record<string, number>;
  facts: LearnedFact[];
  feedback: FeedbackEvent[];
  adjustments: StyleAdjustment[];
  messageCount: number;
  averageUserMessageLength: number;
  createdAt: number;
  updatedAt: number;
}

export function createProfile(preferredName = 'Trader'): UserProfile {
  const now = Date.now();
  return {
    version: 2,
    preferredName,
    languageCounts: { en: 0, tl: 0, taglish: 0 },
    verbosity: 'BALANCED',
    warmth: 0.55,
    topicInterest: {},
    facts: [],
    feedback: [],
    adjustments: [],
    messageCount: 0,
    averageUserMessageLength: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/* ------------------------------------------------------------------ */
/* Language detection                                                  */
/* ------------------------------------------------------------------ */

const TAGALOG_MARKERS = [
  'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila', 'ang', 'mga', 'nang', 'naman',
  'kasi', 'kaya', 'pero', 'talaga', 'sobrang', 'ganun', 'ganyan', 'paano', 'bakit', 'saan',
  'kumusta', 'kamusta', 'salamat', 'walang', 'meron', 'wala', 'hindi', 'opo', 'sige',
  'tulong', 'tulungan', 'gusto', 'ayaw', 'alam', 'dapat', 'pwede', 'puwede', 'ipon',
  'pera', 'utang', 'sahod', 'gastos', 'bayad', 'mahal', 'mura', 'trabaho', 'araw',
  'ngayon', 'bukas', 'kahapon', 'lagi', 'palagi', 'konti', 'marami', 'lang', 'yung',
];

const ENGLISH_MARKERS = [
  // function words
  'the', 'and', 'is', 'are', 'was', 'were', 'be', 'been', 'am', 'a', 'an', 'of', 'to', 'in',
  'on', 'at', 'for', 'with', 'from', 'by', 'as', 'it', 'its', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'we', 'they', 'me', 'my', 'your', 'our', 'their', 'his', 'her',
  'what', 'when', 'where', 'why', 'how', 'which', 'who', 'if', 'then', 'than', 'so', 'but',
  'or', 'not', 'no', 'yes', 'can', 'could', 'should', 'would', 'will', 'shall', 'may', 'might',
  'do', 'does', 'did', 'done', 'have', 'has', 'had', 'get', 'got', 'make', 'made',
  // high-frequency verbs and nouns in this product's domain
  'please', 'thanks', 'thank', 'because', 'about', 'want', 'need', 'know', 'think', 'help',
  'check', 'show', 'tell', 'give', 'look', 'see', 'take', 'use', 'work', 'try', 'put', 'keep',
  'account', 'money', 'price', 'trade', 'risk', 'loss', 'profit', 'market', 'buy', 'sell',
  'now', 'today', 'tomorrow', 'please', 'again', 'still', 'just', 'very', 'really', 'good', 'bad',
];

export function detectLanguage(message: string): DetectedLanguage {
  const words = message.toLowerCase().match(/[a-zñáéíóú]+/g) ?? [];
  if (words.length === 0) return 'en';

  let tagalog = 0;
  let english = 0;
  for (const word of words) {
    if (TAGALOG_MARKERS.includes(word)) tagalog++;
    else if (ENGLISH_MARKERS.includes(word)) english++;
  }

  const tagalogShare = tagalog / words.length;
  const englishShare = english / words.length;

  if (tagalog === 0) return 'en';
  if (english === 0 && tagalogShare > 0.12) return 'tl';
  // Both present in meaningful amounts → Taglish.
  if (tagalogShare >= 0.08 && englishShare >= 0.05) return 'taglish';
  if (tagalogShare > englishShare * 1.5) return 'tl';
  return tagalogShare > 0.05 ? 'taglish' : 'en';
}

/* ------------------------------------------------------------------ */
/* Fact extraction                                                     */
/* ------------------------------------------------------------------ */

interface FactPattern {
  key: string;
  pattern: RegExp;
  /** Index of the capture group holding the value. */
  group?: number;
  confidence: number;
  transform?: (value: string) => string;
  /** Values matching this are discarded — guards against greedy captures. */
  reject?: RegExp;
}

const FACT_PATTERNS: FactPattern[] = [
  {
    key: 'preferred_name',
    // Case-insensitive on the lead-in, but the captured name must still be
    // capitalised — otherwise "I'm going to..." is read as a name.
    pattern: /\b(?:[Cc]all me|[Mm]y name is|[Ii]'m|[Ii] am|[Aa]ko si|[Aa]ng pangalan ko ay|[Nn]ame ko ay)\s+([A-Z][a-zA-Z'-]{1,20})\b/,
    confidence: 0.9,
    reject: /^(?:Just|Not|Going|Trying|Looking|Sorry|Here|Still|Okay|Good|Really|Also|Very|About|Thinking|Working|Wondering|Asking|Hoping|Afraid|Sure|Done|New|Back|Only|Always|Never)$/,
  },
  {
    key: 'account_balance',
    pattern: /\b(?:my )?(?:account|balance|capital|equity|portfolio)\s*(?:is|=|:|of)?\s*([$£€¥₱]?\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m)?)/i,
    confidence: 0.8,
  },
  {
    key: 'risk_limit',
    pattern: /\b(?:risk|risking)\s*(?:is|=|:|of|at)?\s*(\d+(?:\.\d+)?\s?%)\s*(?:per trade|each trade|a trade)?/i,
    confidence: 0.85,
  },
  {
    key: 'monthly_income',
    pattern: /\b(?:i (?:earn|make)|my (?:salary|income|take.?home)|sahod ko)\s*(?:is|=|:|of)?\s*([$£€¥₱]?\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m)?)/i,
    confidence: 0.85,
  },
  {
    key: 'monthly_expenses',
    pattern: /\b(?:my )?(?:expenses|spending|gastos|bills)\s*(?:are|is|=|:)?\s*([$£€¥₱]?\s?\d[\d,]*(?:\.\d+)?\s?(?:k|m)?)/i,
    confidence: 0.8,
  },
  {
    key: 'goal',
    pattern: /\b(?:my goal is|i want to|i'?m trying to|gusto ko(?:ng)?)\s+([^.!?\n]{6,90})/i,
    confidence: 0.6,
  },
  {
    key: 'broker',
    pattern: /\b(?:my broker is|i (?:use|trade with|am with))\s+([A-Za-z][A-Za-z0-9 .&-]{2,24})\b/i,
    confidence: 0.7,
  },
  {
    key: 'timezone_routine',
    pattern: /\bi (?:trade|work|wake up|start)\s+(?:at|around|during)\s+([^.!?\n]{3,40})/i,
    confidence: 0.55,
  },
  {
    key: 'instrument_focus',
    pattern: /\bi (?:mainly |mostly |only )?trade\s+([A-Z]{3,6}(?:\/[A-Z]{3})?|gold|silver|indices|crypto)\b/i,
    confidence: 0.7,
  },
  {
    key: 'constraint',
    pattern: /\b(?:don'?t|do not|never|please stop|avoid|huwag)\s+([^.!?\n]{4,80})/i,
    confidence: 0.75,
  },
];

const TOPIC_KEYWORDS: Record<string, RegExp> = {
  'position sizing': /\b(position siz|lot siz|risk per trade)\b/i,
  'risk management': /\b(risk|drawdown|stop loss|ruin)\b/i,
  budgeting: /\b(budget|expenses|spending|gastos)\b/i,
  debt: /\b(debt|loan|credit card|utang|mortgage)\b/i,
  investing: /\b(invest|portfolio|index fund|etf|compound)\b/i,
  gold: /\b(gold|xau|bullion)\b/i,
  forex: /\b(forex|eur\/usd|gbp|usd\/jpy|currency pair)\b/i,
  macro: /\b(cpi|fomc|fed|inflation|yields|nfp)\b/i,
  psychology: /\b(tilt|revenge|anxious|discipline|emotion|stress)\b/i,
  'strategy design': /\b(backtest|strategy|system|edge|expectancy)\b/i,
  options: /\b(option|call|put|gamma|delta|implied vol)\b/i,
  savings: /\b(save|savings|ipon|emergency fund)\b/i,
};

function upsertFact(facts: LearnedFact[], incoming: Omit<LearnedFact, 'reinforcements'>): LearnedFact[] {
  const existingIndex = facts.findIndex((fact) => fact.key === incoming.key);
  if (existingIndex === -1) return [...facts, { ...incoming, reinforcements: 1 }];

  const existing = facts[existingIndex];
  const next = [...facts];

  if (existing.value.toLowerCase() === incoming.value.toLowerCase()) {
    // Repeated observation strengthens the fact.
    next[existingIndex] = {
      ...existing,
      reinforcements: existing.reinforcements + 1,
      confidence: Math.min(0.99, existing.confidence + 0.05),
      learnedAt: incoming.learnedAt,
    };
  } else {
    // Contradiction: the newer statement wins, but confidence resets so the
    // assistant knows to confirm rather than assert.
    next[existingIndex] = { ...incoming, reinforcements: 1, confidence: Math.max(0.5, incoming.confidence - 0.1) };
  }
  return next;
}

export interface ObservationResult {
  profile: UserProfile;
  /** Facts newly learned or changed by this message. */
  newFacts: LearnedFact[];
  language: DetectedLanguage;
}

/** Update the profile from a single user message. */
export function observeMessage(profile: UserProfile, message: string): ObservationResult {
  const now = Date.now();
  const language = detectLanguage(message);
  const newFacts: LearnedFact[] = [];
  let facts = profile.facts;

  for (const pattern of FACT_PATTERNS) {
    const match = pattern.pattern.exec(message);
    if (!match) continue;
    const raw = (match[pattern.group ?? 1] ?? '').trim().replace(/\s+/g, ' ');
    if (!raw || raw.length > 120) continue;
    const value = pattern.transform ? pattern.transform(raw) : raw;
    if (pattern.reject?.test(value)) continue;

    const candidate: Omit<LearnedFact, 'reinforcements'> = {
      key: pattern.key,
      value,
      evidence: message.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20).trim(),
      confidence: pattern.confidence,
      learnedAt: now,
    };
    const before = facts.find((fact) => fact.key === pattern.key)?.value;
    facts = upsertFact(facts, candidate);
    if (before !== value) newFacts.push({ ...candidate, reinforcements: 1 });
  }

  const topicInterest = { ...profile.topicInterest };
  for (const [topic, pattern] of Object.entries(TOPIC_KEYWORDS)) {
    if (pattern.test(message)) topicInterest[topic] = (topicInterest[topic] ?? 0) + 1;
  }

  const messageCount = profile.messageCount + 1;
  const averageUserMessageLength =
    (profile.averageUserMessageLength * profile.messageCount + message.length) / messageCount;

  const nameFact = facts.find((fact) => fact.key === 'preferred_name');

  return {
    language,
    newFacts,
    profile: {
      ...profile,
      preferredName: nameFact?.value ?? profile.preferredName,
      languageCounts: {
        ...profile.languageCounts,
        [language]: (profile.languageCounts[language] ?? 0) + 1,
      },
      topicInterest,
      facts,
      messageCount,
      averageUserMessageLength,
      updatedAt: now,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Feedback-driven style adaptation                                    */
/* ------------------------------------------------------------------ */

const VERBOSITY_ORDER: VerbosityLevel[] = ['TERSE', 'BALANCED', 'DETAILED'];

function shiftVerbosity(current: VerbosityLevel, direction: -1 | 1): VerbosityLevel {
  const index = VERBOSITY_ORDER.indexOf(current);
  const next = Math.min(Math.max(index + direction, 0), VERBOSITY_ORDER.length - 1);
  return VERBOSITY_ORDER[next];
}

/**
 * Apply one feedback event. The point of returning the adjustment log is that
 * the user can see exactly what their thumbs-down changed.
 */
export function recordFeedback(
  profile: UserProfile,
  event: Omit<FeedbackEvent, 'at'> & { at?: number },
): { profile: UserProfile; adjustment?: StyleAdjustment } {
  const at = event.at ?? Date.now();
  const feedback = [...profile.feedback, { ...event, at }].slice(-200);
  let next: UserProfile = { ...profile, feedback, updatedAt: at };
  let adjustment: StyleAdjustment | undefined;

  const note = (field: string, from: string, to: string, because: string) => {
    adjustment = { at, field, from, to, because };
    next = { ...next, adjustments: [...next.adjustments, adjustment].slice(-100) };
  };

  if (event.rating === 'DOWN') {
    switch (event.reason) {
      case 'TOO_LONG': {
        const to = shiftVerbosity(profile.verbosity, -1);
        if (to !== profile.verbosity) {
          next = { ...next, verbosity: to };
          note('verbosity', profile.verbosity, to, 'User marked a reply as too long.');
        }
        break;
      }
      case 'TOO_SHORT': {
        const to = shiftVerbosity(profile.verbosity, 1);
        if (to !== profile.verbosity) {
          next = { ...next, verbosity: to };
          note('verbosity', profile.verbosity, to, 'User marked a reply as too short.');
        }
        break;
      }
      case 'TOO_FORMAL': {
        const warmth = Math.min(1, profile.warmth + 0.15);
        next = { ...next, warmth };
        note('warmth', profile.warmth.toFixed(2), warmth.toFixed(2), 'User marked a reply as too formal.');
        break;
      }
      case 'GENERIC': {
        // Generic replies usually mean grounding was too thin — bias toward detail.
        const to = shiftVerbosity(profile.verbosity, 1);
        next = { ...next, verbosity: to };
        note('verbosity', profile.verbosity, to, 'User marked a reply as generic; more specific grounding requested.');
        break;
      }
      default:
        break;
    }
  }

  return { profile: next, adjustment };
}

/* ------------------------------------------------------------------ */
/* Derived guidance                                                    */
/* ------------------------------------------------------------------ */

export function dominantLanguage(profile: UserProfile): DetectedLanguage {
  const entries = Object.entries(profile.languageCounts) as [DetectedLanguage, number][];
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return 'en';
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function feedbackScore(profile: UserProfile): { up: number; down: number; ratio: number } {
  const up = profile.feedback.filter((item) => item.rating === 'UP').length;
  const down = profile.feedback.filter((item) => item.rating === 'DOWN').length;
  const total = up + down;
  return { up, down, ratio: total === 0 ? 1 : up / total };
}

export function topTopics(profile: UserProfile, limit = 5): { topic: string; count: number }[] {
  return Object.entries(profile.topicInterest)
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Render the learned profile as prompt directives. */
export function profileDirectives(profile: UserProfile, currentLanguage?: DetectedLanguage): string {
  const lines: string[] = [];
  const language = currentLanguage ?? dominantLanguage(profile);

  lines.push(`Address the user as "${profile.preferredName}". Use the name sparingly — once or twice, not every paragraph.`);

  const languageInstruction: Record<DetectedLanguage, string> = {
    en: 'This message is in English. Reply in English.',
    tl: 'This message is in Tagalog. Reply in Tagalog.',
    taglish: 'This message is in Taglish. Reply in natural Taglish — mixed the way Filipinos actually speak, not translated sentence by sentence.',
  };
  lines.push(languageInstruction[language]);

  const verbosityInstruction: Record<VerbosityLevel, string> = {
    TERSE: 'This user has asked for shorter replies. Default to 2-5 sentences. Expand only when explicitly asked.',
    BALANCED: 'Default length: as short as the question allows, expanding only where the content genuinely requires it.',
    DETAILED: 'This user prefers thorough answers. Give the full reasoning, the worked numbers, and the edge cases.',
  };
  lines.push(verbosityInstruction[profile.verbosity]);

  if (profile.warmth > 0.7) lines.push('Lean warm and informal in tone.');
  else if (profile.warmth < 0.35) lines.push('Lean businesslike. Minimal pleasantries.');

  const confidentFacts = profile.facts.filter((fact) => fact.confidence >= 0.6);
  if (confidentFacts.length > 0) {
    lines.push('');
    lines.push('KNOWN FACTS ABOUT THIS USER (learned from previous messages — use them, do not re-ask):');
    for (const fact of confidentFacts) {
      const confidence = fact.confidence >= 0.8 ? '' : ' (uncertain — confirm if it matters)';
      lines.push(`- ${fact.key.replace(/_/g, ' ')}: ${fact.value}${confidence}`);
    }
  }

  const topics = topTopics(profile, 4);
  if (topics.length > 0) {
    lines.push('');
    lines.push(`Recurring interests: ${topics.map((item) => `${item.topic} (${item.count})`).join(', ')}.`);
  }

  const recentAdjustments = profile.adjustments.slice(-3);
  if (recentAdjustments.length > 0) {
    lines.push('');
    lines.push('STYLE CORRECTIONS THE USER HAS ALREADY MADE — do not regress:');
    for (const adjustment of recentAdjustments) {
      lines.push(`- ${adjustment.field}: ${adjustment.from} → ${adjustment.to} (${adjustment.because})`);
    }
  }

  return lines.join('\n');
}

/** Merge a stored profile that may come from an older version or be malformed. */
export function normalizeProfile(input: unknown): UserProfile {
  const base = createProfile();
  if (!input || typeof input !== 'object') return base;
  const raw = input as Partial<UserProfile>;

  return {
    ...base,
    ...raw,
    version: 2,
    preferredName: typeof raw.preferredName === 'string' && raw.preferredName.trim() ? raw.preferredName : base.preferredName,
    languageCounts: { ...base.languageCounts, ...(raw.languageCounts ?? {}) },
    verbosity: VERBOSITY_ORDER.includes(raw.verbosity as VerbosityLevel) ? (raw.verbosity as VerbosityLevel) : 'BALANCED',
    warmth: typeof raw.warmth === 'number' && raw.warmth >= 0 && raw.warmth <= 1 ? raw.warmth : base.warmth,
    topicInterest: typeof raw.topicInterest === 'object' && raw.topicInterest ? raw.topicInterest : {},
    facts: Array.isArray(raw.facts) ? raw.facts.filter((fact) => fact && fact.key && fact.value) : [],
    feedback: Array.isArray(raw.feedback) ? raw.feedback.slice(-200) : [],
    adjustments: Array.isArray(raw.adjustments) ? raw.adjustments.slice(-100) : [],
    messageCount: Number.isFinite(raw.messageCount) ? (raw.messageCount as number) : 0,
    averageUserMessageLength: Number.isFinite(raw.averageUserMessageLength) ? (raw.averageUserMessageLength as number) : 0,
  };
}
