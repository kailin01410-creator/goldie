/**
 * Self-diagnosis and self-repair.
 *
 * The request was for an AI that can tell where it is broken and fix what it
 * can. That is only meaningful if "broken" is defined in terms of checks that
 * can actually fail, so this module is a registry of concrete probes:
 *
 *   - configuration (is there a key, is it shaped like a key)
 *   - connectivity  (does a real model answer a real request)
 *   - storage       (does every indexed document still exist on disk)
 *   - knowledge     (do the datasets load and does retrieval return hits)
 *   - computation   (do the finance tools still produce known-correct answers)
 *   - source code   (static scan for the specific defect classes that have
 *                    already bitten this codebase, reported as file:line)
 *
 * Checks that can be repaired safely expose a `repair()`. Everything else
 * returns a precise remediation instruction instead of a vague warning.
 */

import fs from 'fs';
import path from 'path';
import type { GoogleGenAI } from '@google/genai';
import { getRouterState, probeModel, resetRouter, type ModelRouterState } from './modelRouter';
import { getStore } from './store';
import { buildKnowledgeBase, invalidateKnowledgeBase, knowledgeBaseReport } from '../ai/knowledgeBase';
import { positionSize, loanPayment, expectancy, detectCalculations } from '../ai/financeTools';
import { COMMUNICATION_EXEMPLARS } from '../ai/datasets/communicationCorpus';
import { FINANCE_ENTRIES } from '../ai/datasets/financeCorpus';

export type Severity = 'OK' | 'INFO' | 'WARN' | 'CRITICAL';

export interface CheckResult {
  id: string;
  title: string;
  area: 'CONFIG' | 'MODEL' | 'STORAGE' | 'KNOWLEDGE' | 'COMPUTE' | 'CODE' | 'RUNTIME';
  severity: Severity;
  detail: string;
  /** Where the problem lives, as `file:line` when known. */
  location?: string;
  /** What to do about it, in concrete terms. */
  remediation?: string;
  /** True when this run repaired it automatically. */
  repaired?: boolean;
  evidence?: string[];
  durationMs: number;
}

export interface DiagnosticsReport {
  generatedAt: string;
  healthy: boolean;
  score: number;
  counts: Record<Severity, number>;
  checks: CheckResult[];
  router: ModelRouterState;
  summary: string;
  repairsApplied: string[];
}

interface CheckContext {
  repair: boolean;
  ai: GoogleGenAI | null;
  projectRoot: string;
}

type CheckFunction = (context: CheckContext) => Promise<Omit<CheckResult, 'durationMs'>> | Omit<CheckResult, 'durationMs'>;

/* ------------------------------------------------------------------ */
/* Static source scanner                                               */
/* ------------------------------------------------------------------ */

interface CodeRule {
  id: string;
  pattern: RegExp;
  severity: Severity;
  message: string;
  remediation: string;
  /** Files to skip for this rule. */
  exclude?: RegExp;
  /**
   * Skip matches that land on a comment line. Needed for rules whose patterns
   * are themselves quoted in prose — a doc comment explaining why a defect is
   * bad is not an instance of that defect.
   */
  codeOnly?: boolean;
}

/**
 * Rules target defect classes that have already caused real failures here —
 * not generic lint. A scanner that flags everything gets ignored.
 */
const CODE_RULES: CodeRule[] = [
  {
    id: 'phantom-model',
    pattern: /['"`]gemini-(?:3\.8|3\.5|4)[\w.-]*['"`]/g,
    severity: 'CRITICAL',
    message: 'Reference to a Gemini model ID that does not exist. Every call using it fails and falls through to the offline core.',
    remediation: 'Use the model router (src/server/modelRouter.ts) which discovers available models at runtime instead of hardcoding a name.',
    codeOnly: true,
  },
  {
    id: 'hardcoded-secret',
    pattern: /(?:AIza[0-9A-Za-z_-]{30,}|goldapi-[0-9a-z]{20,}|sk-[A-Za-z0-9]{32,})/g,
    severity: 'CRITICAL',
    message: 'A live-looking API key is committed in the source tree.',
    remediation: 'Remove the value, rotate the key with the provider, and load it from an environment variable that is not committed.',
  },
  {
    id: 'empty-catch',
    pattern: /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g,
    severity: 'WARN',
    message: 'Empty catch block — this silently swallows an error and makes failures invisible.',
    remediation: 'Log the error, or add a comment stating explicitly why it is safe to ignore.',
    codeOnly: true,
  },
  {
    id: 'fabricated-scale-claim',
    pattern: /\b(?:\d+(?:\.\d+)?\s?(?:GB|TB)\s+(?:corpus|dataset|storage|memory)|10\+\s?TB)/gi,
    severity: 'WARN',
    message: 'Hardcoded claim about dataset size. If the number is not measured it will drift away from reality and misleads the user.',
    remediation: 'Compute the figure from the data (see COMMUNICATION_CORPUS_STATS / FINANCE_CORPUS_STATS) instead of asserting it.',
    codeOnly: true,
  },
  {
    id: 'unbounded-slice',
    pattern: /\.slice\(0,\s*(?:\d{6,})\)/g,
    severity: 'INFO',
    message: 'Very large fixed slice of document content. Fixed truncation loses everything past the cut regardless of relevance.',
    remediation: 'Chunk the document and retrieve the relevant parts (src/ai/retrieval.ts) rather than truncating at a fixed offset.',
  },
  {
    id: 'todo-marker',
    pattern: /\/\/\s*(?:TODO|FIXME|HACK|XXX)\b.*/g,
    severity: 'INFO',
    message: 'Unresolved TODO/FIXME marker.',
    remediation: 'Resolve it or convert it into a tracked issue.',
  },
];

const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
// `tests` is skipped deliberately: the scanner's own fixtures contain the
// defect patterns on purpose, and flagging them would be noise.
const SCAN_SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'coverage', 'data', '.cache', 'tests']);

function walkSourceFiles(root: string, accumulator: string[] = [], depth = 0): string[] {
  if (depth > 8) return accumulator;
  let items: fs.Dirent[];
  try {
    items = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return accumulator;
  }
  for (const item of items) {
    if (item.name.startsWith('.') && item.name !== '.env.example') continue;
    const full = path.join(root, item.name);
    if (item.isDirectory()) {
      if (SCAN_SKIP_DIRS.has(item.name)) continue;
      walkSourceFiles(full, accumulator, depth + 1);
    } else if (SCAN_EXTENSIONS.has(path.extname(item.name)) || item.name === '.env.example') {
      accumulator.push(full);
    }
  }
  return accumulator;
}

export interface CodeFinding {
  ruleId: string;
  severity: Severity;
  file: string;
  line: number;
  excerpt: string;
  message: string;
  remediation: string;
}

export function scanSource(projectRoot: string, limit = 60): CodeFinding[] {
  const files = walkSourceFiles(projectRoot);
  const findings: CodeFinding[] = [];

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    // The scanner's own rule table contains the patterns it looks for.
    if (file.endsWith(path.join('server', 'diagnostics.ts'))) continue;

    const relative = path.relative(projectRoot, file);
    const lines = content.split('\n');

    for (const rule of CODE_RULES) {
      if (rule.exclude?.test(relative)) continue;
      rule.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.pattern.exec(content)) !== null) {
        const lineNumber = content.slice(0, match.index).split('\n').length;
        const rawLine = lines[lineNumber - 1] ?? '';
        const excerpt = rawLine.trim().slice(0, 160);

        // An explicit, reviewed exception.
        if (/angel-scan-ignore/.test(rawLine) || /angel-scan-ignore/.test(lines[lineNumber - 2] ?? '')) continue;

        // Prose that discusses a defect is not the defect.
        if (rule.codeOnly && /^\s*(?:\/\/|\*|\/\*)/.test(rawLine)) continue;

        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          file: relative,
          line: lineNumber,
          excerpt,
          message: rule.message,
          remediation: rule.remediation,
        });
        if (findings.length >= limit * 3) break;
      }
    }
  }

  const order: Record<Severity, number> = { CRITICAL: 0, WARN: 1, INFO: 2, OK: 3 };
  return findings.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Checks                                                              */
/* ------------------------------------------------------------------ */

const CHECKS: { id: string; run: CheckFunction }[] = [
  {
    id: 'config.api-key',
    run: () => {
      const key = process.env.GEMINI_API_KEY?.trim() ?? '';
      if (!key) {
        return {
          id: 'config.api-key',
          title: 'Model API key',
          area: 'CONFIG' as const,
          severity: 'WARN' as const,
          detail:
            'GEMINI_API_KEY is not set. ANGEL runs on the offline core: exact calculations and document retrieval still work, but open-ended conversation does not.',
          location: '.env',
          remediation:
            'Create a .env file in the project root with GEMINI_API_KEY=your-key (get one at https://aistudio.google.com/apikey), then restart the server.',
        };
      }
      if (key === 'MY_GEMINI_API_KEY' || key.length < 20) {
        return {
          id: 'config.api-key',
          title: 'Model API key',
          area: 'CONFIG' as const,
          severity: 'CRITICAL' as const,
          detail: `GEMINI_API_KEY is set but looks like a placeholder (${key.length} characters).`,
          location: '.env',
          remediation: 'Replace the placeholder with a real key from https://aistudio.google.com/apikey.',
        };
      }
      return {
        id: 'config.api-key',
        title: 'Model API key',
        area: 'CONFIG' as const,
        severity: 'OK' as const,
        detail: `Key present (${key.slice(0, 6)}…${key.slice(-4)}, ${key.length} characters).`,
      };
    },
  },
  {
    id: 'model.reachable',
    run: async ({ ai, repair }) => {
      if (!ai) {
        return {
          id: 'model.reachable',
          title: 'Model connectivity',
          area: 'MODEL' as const,
          severity: 'INFO' as const,
          detail: 'Skipped — no API client because no key is configured.',
          remediation: 'Set GEMINI_API_KEY to enable live model responses.',
        };
      }

      if (repair) resetRouter();
      const outcome = await probeModel(ai);

      if (outcome.ok) {
        return {
          id: 'model.reachable',
          title: 'Model connectivity',
          area: 'MODEL' as const,
          severity: 'OK' as const,
          detail: `Live. Responding model: ${outcome.model} (${outcome.latencyMs}ms round trip).`,
          repaired: repair && outcome.attempts.length > 0,
          evidence: outcome.attempts.map((attempt) => `${attempt.model}: ${attempt.kind} — ${attempt.error}`),
        };
      }

      const authFailure = outcome.errorKind === 'AUTH';
      return {
        id: 'model.reachable',
        title: 'Model connectivity',
        area: 'MODEL' as const,
        severity: authFailure ? ('CRITICAL' as const) : ('WARN' as const),
        detail: `No model responded. Last error (${outcome.errorKind}): ${outcome.error}`,
        location: 'src/server/modelRouter.ts',
        remediation: authFailure
          ? 'The API key was rejected. Verify it at https://aistudio.google.com/apikey and confirm the Generative Language API is enabled for the project.'
          : 'Usually transient or a quota limit. ANGEL keeps serving from the offline core; run the self-heal again in a few minutes.',
        evidence: outcome.attempts.map((attempt) => `${attempt.model}: ${attempt.kind} — ${attempt.error}`),
      };
    },
  },
  {
    id: 'storage.integrity',
    run: ({ repair }) => {
      const store = getStore();
      const result = store.verify(repair);
      const stats = store.stats();

      if (result.healthy) {
        return {
          id: 'storage.integrity',
          title: 'Document store integrity',
          area: 'STORAGE' as const,
          severity: 'OK' as const,
          detail: `${stats.activeDocuments} active document(s), ${stats.totalCharacters.toLocaleString()} characters, ${stats.conversationTurns} conversation turns. No inconsistencies.`,
        };
      }

      const repairedCount = result.issues.filter((issue) => issue.repaired).length;
      return {
        id: 'storage.integrity',
        title: 'Document store integrity',
        area: 'STORAGE' as const,
        severity: repairedCount === result.issues.length ? ('OK' as const) : ('WARN' as const),
        detail: `${result.issues.length} inconsistenc${result.issues.length === 1 ? 'y' : 'ies'} found${repairedCount > 0 ? `, ${repairedCount} repaired automatically` : ''}.`,
        location: stats.root,
        remediation: repairedCount === result.issues.length ? undefined : 'Run self-heal to drop index entries whose files are missing and delete orphaned files.',
        repaired: repairedCount > 0,
        evidence: result.issues.map((issue) => `${issue.kind}${issue.id ? ` [${issue.id}]` : ''}: ${issue.detail}${issue.repaired ? ' — repaired' : ''}`),
      };
    },
  },
  {
    id: 'storage.writable',
    run: () => {
      const store = getStore();
      const stats = store.stats();
      const probePath = path.join(stats.root, '.write-probe');
      try {
        fs.mkdirSync(stats.root, { recursive: true });
        fs.writeFileSync(probePath, String(Date.now()));
        fs.unlinkSync(probePath);
        return {
          id: 'storage.writable',
          title: 'Store writability',
          area: 'STORAGE' as const,
          severity: 'OK' as const,
          detail: `${stats.root} is writable.`,
        };
      } catch (error) {
        return {
          id: 'storage.writable',
          title: 'Store writability',
          area: 'STORAGE' as const,
          severity: 'CRITICAL' as const,
          detail: `Cannot write to the store directory: ${(error as Error).message}`,
          location: stats.root,
          remediation: 'Fix the store directory permissions so it is writable. Without this, uploads will not survive a restart.',
        };
      }
    },
  },
  {
    id: 'knowledge.datasets',
    run: () => {
      const problems: string[] = [];

      if (COMMUNICATION_EXEMPLARS.length < 10) problems.push(`Communication corpus has only ${COMMUNICATION_EXEMPLARS.length} exemplars.`);
      if (FINANCE_ENTRIES.length < 20) problems.push(`Finance corpus has only ${FINANCE_ENTRIES.length} entries.`);

      const duplicateCommunication = COMMUNICATION_EXEMPLARS.length - new Set(COMMUNICATION_EXEMPLARS.map((item) => item.id)).size;
      if (duplicateCommunication > 0) problems.push(`${duplicateCommunication} duplicate communication exemplar id(s).`);

      const duplicateFinance = FINANCE_ENTRIES.length - new Set(FINANCE_ENTRIES.map((item) => item.id)).size;
      if (duplicateFinance > 0) problems.push(`${duplicateFinance} duplicate finance entry id(s).`);

      const emptyFinance = FINANCE_ENTRIES.filter((item) => !item.definition?.trim()).map((item) => item.id);
      if (emptyFinance.length > 0) problems.push(`Finance entries missing a definition: ${emptyFinance.join(', ')}`);

      const report = knowledgeBaseReport([]);
      if (problems.length === 0) {
        return {
          id: 'knowledge.datasets',
          title: 'Built-in datasets',
          area: 'KNOWLEDGE' as const,
          severity: 'OK' as const,
          detail: `${report.communication.exemplars} communication exemplars across ${report.communication.intents.length} intents and ${report.communication.languages.length} languages; ${report.finance.entries} finance entries (${report.finance.formulas} with formulas) across ${report.finance.domains.length} domains; ${report.finance.playbooks} playbooks.`,
        };
      }

      return {
        id: 'knowledge.datasets',
        title: 'Built-in datasets',
        area: 'KNOWLEDGE' as const,
        severity: 'WARN' as const,
        detail: problems.join(' '),
        location: 'src/ai/datasets/',
        remediation: 'Fix the dataset entries listed above; duplicates make retrieval return the same content twice.',
      };
    },
  },
  {
    id: 'knowledge.retrieval',
    run: ({ repair }) => {
      if (repair) invalidateKnowledgeBase();
      const store = getStore();
      const documents = store.loadAllWithText().map((document) => ({
        id: document.id,
        title: document.title,
        content: document.content,
        category: document.category,
        sourceType: document.sourceType,
        fileName: document.fileName,
        tags: document.tags,
        isActive: document.isActive,
        updatedAt: document.updatedAt,
      }));

      const { index } = buildKnowledgeBase(documents, repair);
      const stats = index.stats();

      // Golden queries: each must return a hit from the expected corpus, which
      // is what catches a tokenizer or indexing regression.
      const probes: { query: string; expect: string }[] = [
        { query: 'how do I size a position with 1% risk', expect: 'position' },
        { query: 'what is compound interest', expect: 'compound' },
        { query: 'I am angry after a stop out', expect: 'anger|tilt|EMOTIONAL' },
        { query: 'paano mag budget ng sahod', expect: 'budget' },
      ];

      const failures: string[] = [];
      for (const probe of probes) {
        const hits = index.search(probe.query, { limit: 3 });
        const matched = hits.some((hit) => new RegExp(probe.expect, 'i').test(`${hit.title} ${hit.category} ${hit.text.slice(0, 400)}`));
        if (!matched) failures.push(`"${probe.query}" returned ${hits.length} hit(s), none matching /${probe.expect}/`);
      }

      if (failures.length === 0) {
        return {
          id: 'knowledge.retrieval',
          title: 'Retrieval engine',
          area: 'KNOWLEDGE' as const,
          severity: 'OK' as const,
          detail: `Index holds ${stats.chunks} chunks from ${stats.documents} documents, ${stats.uniqueTerms.toLocaleString()} unique terms. All ${probes.length} golden queries returned the expected corpus.`,
          repaired: repair,
        };
      }

      return {
        id: 'knowledge.retrieval',
        title: 'Retrieval engine',
        area: 'KNOWLEDGE' as const,
        severity: 'CRITICAL' as const,
        detail: `${failures.length} of ${probes.length} golden retrieval queries failed. ANGEL will miss relevant documents.`,
        location: 'src/ai/retrieval.ts',
        remediation: 'Rebuild the index with self-heal. If it persists, the tokenizer or BM25 scoring in src/ai/retrieval.ts has regressed — the golden queries above pin the expected behaviour.',
        evidence: failures,
      };
    },
  },
  {
    id: 'compute.finance-tools',
    run: () => {
      const failures: string[] = [];
      const approximately = (actual: number, expected: number, tolerance = 0.01) => Math.abs(actual - expected) <= tolerance;

      // $10,000 @ 1% = $100 risk; gold stop of 2.50 costs $250/lot → 0.4 lots.
      const sizing = positionSize({ accountBalance: 10_000, riskPercent: 1, entryPrice: 2650, stopPrice: 2647.5, symbol: 'XAU/USD' });
      if (!approximately(Number(sizing.outputs.lots), 0.4)) {
        failures.push(`position_size returned ${sizing.outputs.lots} lots, expected 0.40`);
      }

      // 500,000 @ 9% over 5y → 10,379.12/month (standard amortisation).
      const loan = loanPayment(500_000, 9, 5);
      if (!approximately(Number(loan.outputs.monthlyPayment), 10_379.12, 1)) {
        failures.push(`loan_payment returned ${loan.outputs.monthlyPayment}, expected ≈10379.12`);
      }

      // 0.45*300 - 0.55*120 = 69.
      const edge = expectancy(45, 300, 120);
      if (!approximately(Number(edge.outputs.expectancy), 69, 0.5)) {
        failures.push(`expectancy returned ${edge.outputs.expectancy}, expected 69`);
      }

      const detected = detectCalculations('My account is 10000, I risk 1% per trade, entry 2650 stop 2647.5, what lot size?', {
        symbol: 'XAU/USD',
      });
      if (!detected.some((item) => item.tool === 'position_size' && item.result)) {
        failures.push('detectCalculations failed to route a plain-language sizing question to position_size');
      }

      if (failures.length === 0) {
        return {
          id: 'compute.finance-tools',
          title: 'Finance calculation engine',
          area: 'COMPUTE' as const,
          severity: 'OK' as const,
          detail: 'All 4 known-answer tests passed (position sizing, loan amortisation, expectancy, intent routing).',
        };
      }

      return {
        id: 'compute.finance-tools',
        title: 'Finance calculation engine',
        area: 'COMPUTE' as const,
        severity: 'CRITICAL' as const,
        detail: `${failures.length} known-answer test(s) failed. Numbers given to the user cannot be trusted until this is fixed.`,
        location: 'src/ai/financeTools.ts',
        remediation: 'A formula or the contract specification table has regressed. The failing expectations are listed below.',
        evidence: failures,
      };
    },
  },
  {
    id: 'code.static-scan',
    run: ({ projectRoot }) => {
      const findings = scanSource(projectRoot);
      const critical = findings.filter((finding) => finding.severity === 'CRITICAL');
      const warnings = findings.filter((finding) => finding.severity === 'WARN');

      if (findings.length === 0) {
        return {
          id: 'code.static-scan',
          title: 'Source code scan',
          area: 'CODE' as const,
          severity: 'OK' as const,
          detail: 'No known defect patterns found in the source tree.',
        };
      }

      const severity: Severity = critical.length > 0 ? 'CRITICAL' : warnings.length > 0 ? 'WARN' : 'INFO';
      return {
        id: 'code.static-scan',
        title: 'Source code scan',
        area: 'CODE' as const,
        severity,
        detail: `${findings.length} finding(s): ${critical.length} critical, ${warnings.length} warning, ${findings.length - critical.length - warnings.length} informational.`,
        location: findings[0] ? `${findings[0].file}:${findings[0].line}` : undefined,
        remediation: 'Each finding below names the file, the line, and the specific change required.',
        evidence: findings.map((finding) => `${finding.severity} ${finding.file}:${finding.line} [${finding.ruleId}] ${finding.message} → ${finding.remediation}\n    ${finding.excerpt}`),
      };
    },
  },
  {
    id: 'runtime.environment',
    run: () => {
      const nodeMajor = Number(process.versions.node.split('.')[0]);
      const memory = process.memoryUsage();
      const heapMb = Math.round(memory.heapUsed / 1024 / 1024);
      const issues: string[] = [];
      if (nodeMajor < 18) issues.push(`Node ${process.versions.node} is below the required v18.`);
      if (heapMb > 1500) issues.push(`Heap usage is high (${heapMb} MB).`);

      return {
        id: 'runtime.environment',
        title: 'Runtime environment',
        area: 'RUNTIME' as const,
        severity: issues.length > 0 ? ('WARN' as const) : ('OK' as const),
        detail:
          issues.length > 0
            ? issues.join(' ')
            : `Node ${process.versions.node}, heap ${heapMb} MB, uptime ${Math.round(process.uptime())}s.`,
        remediation: issues.length > 0 ? 'Upgrade Node to v20 LTS or restart the server to release memory.' : undefined,
      };
    },
  },
];

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

const SEVERITY_WEIGHT: Record<Severity, number> = { OK: 0, INFO: 1, WARN: 6, CRITICAL: 25 };

export async function runDiagnostics(options: { repair?: boolean; ai?: GoogleGenAI | null; projectRoot?: string } = {}): Promise<DiagnosticsReport> {
  const context: CheckContext = {
    repair: options.repair ?? false,
    ai: options.ai ?? null,
    projectRoot: options.projectRoot ?? process.cwd(),
  };

  const checks: CheckResult[] = [];
  for (const check of CHECKS) {
    const startedAt = Date.now();
    try {
      const result = await check.run(context);
      checks.push({ ...result, durationMs: Date.now() - startedAt });
    } catch (error) {
      checks.push({
        id: check.id,
        title: check.id,
        area: 'RUNTIME',
        severity: 'CRITICAL',
        detail: `The check itself threw: ${(error as Error).message}`,
        remediation: 'This is a bug in the diagnostics module. The stack trace is in the server log.',
        durationMs: Date.now() - startedAt,
      });
    }
  }

  const counts: Record<Severity, number> = { OK: 0, INFO: 0, WARN: 0, CRITICAL: 0 };
  let penalty = 0;
  for (const check of checks) {
    counts[check.severity]++;
    penalty += SEVERITY_WEIGHT[check.severity];
  }

  const score = Math.max(0, 100 - penalty);
  const repairsApplied = checks.filter((check) => check.repaired).map((check) => check.title);
  const problems = checks.filter((check) => check.severity === 'CRITICAL' || check.severity === 'WARN');

  const summary =
    problems.length === 0
      ? `All ${checks.length} checks passed. Health score ${score}/100.`
      : `${problems.length} of ${checks.length} checks need attention: ${problems.map((check) => check.title).join(', ')}. Health score ${score}/100.`;

  return {
    generatedAt: new Date().toISOString(),
    healthy: counts.CRITICAL === 0 && counts.WARN === 0,
    score,
    counts,
    checks,
    router: getRouterState(),
    summary,
    repairsApplied,
  };
}
