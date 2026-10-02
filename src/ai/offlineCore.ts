/**
 * Offline reasoning core.
 *
 * Runs when no model API key is configured or the API call fails. The previous
 * implementation was a 370-line if/else chain of pre-written paragraphs that
 * ignored the user's documents entirely and claimed capabilities it did not
 * have. This version does real work without a model:
 *
 *  - runs exact finance calculations and shows the arithmetic;
 *  - retrieves and quotes the user's actual uploaded documents;
 *  - answers definition questions from the finance corpus;
 *  - is explicit that it is the offline core, so the user is never misled
 *    about what produced the answer.
 *
 * It does not pretend to be the model. It tells the truth about its limits and
 * still returns something usable.
 */

import { CONVERSATION_PATTERNS } from './datasets/communicationCorpus';
import { FINANCE_ENTRIES, FINANCE_PLAYBOOKS } from './datasets/financeCorpus';
import { detectLanguage, type DetectedLanguage, type UserProfile } from './adaptive';
import { detectCalculations, FINANCE_TOOL_CATALOG, type DetectedCalculation } from './financeTools';
import { gatherGrounding, type MemoryLike } from './knowledgeBase';
import { fuzzySimilarity, summarizeSnippet } from './text';

export interface OfflineCoreInput {
  message: string;
  profile: UserProfile;
  memories?: MemoryLike[];
  market?: { symbol?: string; price?: number; timeframe?: string; session?: string; isMarketClosed?: boolean };
  project?: { name?: string; rules?: string[]; maxRiskPerTradePercent?: number };
}

export interface OfflineCoreOutput {
  reply: string;
  usedTools: string[];
  citations: { title: string; fileName?: string; score: number; source?: string; heading?: string; snippet?: string }[];
  language: DetectedLanguage;
  /** Why this particular branch produced the answer — surfaced in diagnostics. */
  strategy: string;
}

const EMOTION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(angry|furious|mad|pissed|galit|inis|badtrip)\b/i, label: 'anger' },
  { pattern: /\b(anxious|anxiety|nervous|scared|kabado|takot|worried|stressed|stress)\b/i, label: 'anxiety' },
  { pattern: /\b(sad|depressed|down|hopeless|lungkot|malungkot|giving up|quit)\b/i, label: 'low mood' },
  { pattern: /\b(overwhelmed|burnt out|burned out|exhausted|pagod|sawa)\b/i, label: 'burnout' },
  { pattern: /\b(frustrated|stuck|hindi ko kaya|ewan ko na)\b/i, label: 'frustration' },
];

const SIGNOFF: Record<DetectedLanguage, string> = {
  en: 'What would you like to do with this?',
  tl: 'Ano ang gusto mong gawin dito?',
  taglish: 'Ano ang next step na gusto mo dito?',
};

const OFFLINE_BANNER: Record<DetectedLanguage, string> = {
  en: '_Answered by the offline core (no model API reachable). Calculations and document lookups below are exact; open-ended reasoning is limited until an API key is configured._',
  tl: '_Sinagot ito ng offline core (walang model API na maabot). Tumpak ang mga kalkulasyon at dokumentong binanggit; limitado lang ang malalimang pag-uusap hangga\'t walang API key._',
  taglish: '_Offline core ang sumagot nito (walang model API). Exact ang calculations at document lookups sa baba; limited lang ang open-ended reasoning hangga\'t walang API key._',
};

function renderCalculation(calculation: DetectedCalculation): string {
  const result = calculation.result!;
  const steps = result.steps
    .filter((step) => step.value)
    .map((step) => `- ${step.label}: ${step.expression} = **${step.value}**`)
    .join('\n');
  const notes = result.notes?.length ? `\n\n${result.notes.map((note) => `> ${note}`).join('\n')}` : '';
  return `**${result.title}**\n\n**${result.headline}**\n\n${steps}${notes}`;
}

function renderMissing(calculation: DetectedCalculation, language: DetectedLanguage): string {
  const needs = (calculation.missing ?? []).join(', ');
  if (language === 'tl') return `Kaya kong i-compute ito nang eksakto, pero kulang pa: **${needs}**. Ibigay mo lang at ilalabas ko agad ang numero.`;
  if (language === 'taglish') return `Pwede ko itong i-compute exactly, kailangan ko lang: **${needs}**. Give me those and I will run it.`;
  return `I can compute this exactly — I just need: **${needs}**. Give me those and I will run the numbers.`;
}

/** Find a finance entry whose term or alias closely matches a definition request. */
function lookupDefinition(message: string) {
  const match = /\b(?:what(?:'s| is| are)|define|meaning of|ano ang|anong ibig sabihin ng|explain)\s+(?:a |an |the )?([a-z0-9 /&-]{2,40})/i.exec(
    message,
  );
  if (!match) return null;
  const query = match[1].trim().replace(/[?.!]$/, '');
  if (!query) return null;

  let best: { entry: (typeof FINANCE_ENTRIES)[number]; score: number } | null = null;
  for (const entry of FINANCE_ENTRIES) {
    const candidates = [entry.term, ...(entry.aliases ?? [])];
    for (const candidate of candidates) {
      const score = fuzzySimilarity(query, candidate);
      if (!best || score > best.score) best = { entry, score };
    }
  }
  return best && best.score >= 0.55 ? best.entry : null;
}

/**
 * Words too generic to indicate a playbook. "plan" matched "Building a debt
 * payoff plan" for the question "what does my scalping plan say about news",
 * which is exactly the kind of confident irrelevance this core must not emit.
 */
const PLAYBOOK_STOPWORDS = new Set([
  'plan', 'planning', 'that', 'this', 'with', 'from', 'your', 'about', 'actually',
  'changes', 'building', 'weekly', 'order', 'operations', 'getting', 'started',
  'trade', 'trades', 'trading', 'money', 'finance', 'financial', 'personal', 'review',
]);

function lookupPlaybook(message: string) {
  const text = message.toLowerCase();
  const matches = (keyword: string) =>
    // Word-boundary match: "risk" must not fire on "asterisk".
    new RegExp(`\\b${keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text);

  let best: { playbook: (typeof FINANCE_PLAYBOOKS)[number]; hits: number } | null = null;

  for (const playbook of FINANCE_PLAYBOOKS) {
    // Curated tags are the signal; title words only reinforce them.
    const tagHits = playbook.tags.filter((tag) => matches(tag)).length;
    const titleHits = playbook.title
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3 && !PLAYBOOK_STOPWORDS.has(word) && matches(word)).length;

    const hits = tagHits * 2 + titleHits;
    // Require either a real tag match plus corroboration, or two tag matches.
    if (tagHits >= 1 && hits >= 3 && (!best || hits > best.hits)) {
      best = { playbook, hits };
    }
  }

  return best?.playbook ?? null;
}

export function runOfflineCore(input: OfflineCoreInput): OfflineCoreOutput {
  const message = (input.message ?? '').trim();
  const language = detectLanguage(message);
  const name = input.profile?.preferredName || 'there';
  const usedTools: string[] = [];
  const parts: string[] = [];
  let strategy = 'general';

  /* 1. Short conversational patterns — handled directly, no ceremony. */
  for (const pattern of CONVERSATION_PATTERNS) {
    if (pattern.trigger.test(message) && message.length < 90) {
      return {
        reply: pattern.template.replace(/\{name\}/g, name),
        usedTools: [],
        citations: [],
        language,
        strategy: `pattern:${pattern.id}`,
      };
    }
  }

  /* 2. Exact calculations — the highest-value thing the offline core can do. */
  const calculations = detectCalculations(message, {
    symbol: input.market?.symbol ?? input.project?.name,
    price: input.market?.price,
  });
  const computed = calculations.filter((item) => item.result);
  const incomplete = calculations.filter((item) => !item.result && (item.missing?.length ?? 0) > 0);

  if (computed.length > 0) {
    strategy = 'calculation';
    for (const calculation of computed) {
      usedTools.push(calculation.tool);
      parts.push(renderCalculation(calculation));
    }
  } else if (incomplete.length > 0) {
    strategy = 'calculation-incomplete';
    parts.push(renderMissing(incomplete[0], language));
  }

  /* 3. The user's own documents. */
  const grounding = gatherGrounding(message, input.memories ?? [], {
    memoryLimit: 3,
    financeLimit: 2,
    styleLimit: 0,
  });

  const citations = grounding.memoryHits.map((hit) => ({
    title: hit.title,
    fileName: hit.fileName,
    score: hit.score,
    source: hit.source,
    heading: hit.heading,
    snippet: summarizeSnippet(hit.text, 180),
  }));

  if (grounding.memoryHits.length > 0) {
    if (strategy === 'general') strategy = 'documents';
    const heading =
      language === 'tl'
        ? 'Mula sa mga dokumento mo'
        : language === 'taglish'
          ? 'From your uploaded documents'
          : 'From your own documents';
    const quoted = grounding.memoryHits
      .map((hit) => {
        const label = hit.fileName ? `**${hit.title}** (${hit.fileName})` : `**${hit.title}**`;
        return `${label}${hit.heading ? ` › ${hit.heading}` : ''}\n> ${summarizeSnippet(hit.text, 420).replace(/\n/g, '\n> ')}`;
      })
      .join('\n\n');
    parts.push(`**${heading}**\n\n${quoted}`);
  }

  /* 4. Definition lookup from the finance corpus. */
  const definition = lookupDefinition(message);
  if (definition) {
    if (strategy === 'general') strategy = 'definition';
    usedTools.push('finance_corpus');
    const lines = [`**${definition.term}**`, '', definition.definition];
    if (definition.formula) lines.push('', `Formula: \`${definition.formula}\``);
    if (definition.example) lines.push('', `Example: ${definition.example}`);
    if (definition.pitfall) lines.push('', `Common mistake: ${definition.pitfall}`);
    parts.push(lines.join('\n'));
  }

  /* 5. Playbook match — only when the user's own documents did not answer.
         Their plan outranks a generic one, always. */
  const playbook = !definition && grounding.memoryHits.length === 0 ? lookupPlaybook(message) : null;
  if (playbook) {
    if (strategy === 'general') strategy = 'playbook';
    usedTools.push('finance_playbook');
    parts.push(`**${playbook.title}**\n_Use when: ${playbook.when}_\n\n${playbook.steps.join('\n')}`);
  }

  /* 6. Emotional content — acknowledge before anything else in the output. */
  const emotion = EMOTION_PATTERNS.find((item) => item.pattern.test(message));
  if (emotion) {
    if (strategy === 'general') strategy = 'emotional';
    const acknowledgement =
      language === 'tl'
        ? `Narinig kita, at makatuwiran ang nararamdaman mo. Hindi kita madaliin.`
        : language === 'taglish'
          ? `I hear you — valid yung nararamdaman mo, and we do not have to rush this.`
          : `I hear you, and that reaction makes sense. We do not have to rush past it.`;
    const question =
      language === 'tl'
        ? 'Gusto mo bang pag-usapan muna ito, o mas gusto mong dumiretso sa solusyon?'
        : language === 'taglish'
          ? 'Gusto mo ba munang pag-usapan ito, or diretso na tayo sa fix?'
          : 'Do you want to talk it through first, or go straight to what can be done about it?';
    parts.unshift(`${acknowledgement}\n\n${question}`);
  }

  /* 7. Risk guardrail: flag a stated risk above the project limit. */
  const riskMatch = /\b(\d+(?:\.\d+)?)\s?%\s*(?:risk|per trade|of (?:my )?account)/i.exec(message);
  const maxRisk = input.project?.maxRiskPerTradePercent;
  if (riskMatch && maxRisk && parseFloat(riskMatch[1]) > maxRisk) {
    parts.push(
      `⚠️ That is ${riskMatch[1]}% per trade. Your active project "${input.project?.name ?? 'current plan'}" caps risk at ${maxRisk}%. At ${riskMatch[1]}%, a six-loss streak costs about ${(100 * (1 - Math.pow(1 - parseFloat(riskMatch[1]) / 100, 6))).toFixed(1)}% of the account.`,
    );
  }

  /* 8. Nothing matched — be honest and show what is actually available. */
  if (parts.length === 0) {
    strategy = 'fallback';
    const capabilities = FINANCE_TOOL_CATALOG.slice(0, 8)
      .map((tool) => `- ${tool.label} (needs: ${tool.needs.join(', ')})`)
      .join('\n');
    const documentCount = (input.memories ?? []).filter((memory) => memory.isActive !== false).length;

    const intro =
      language === 'tl'
        ? 'Hindi ko maabot ang model API ngayon, kaya hindi ako makakasagot nang malayang pag-uusap. Pero may mga bagay akong kayang gawin nang eksakto kahit offline:'
        : language === 'taglish'
          ? 'Hindi ko maabot ang model API ngayon, so limited ako sa free-form conversation. Pero exact pa rin ito kahit offline:'
          : 'I cannot reach the model API right now, so open-ended conversation is limited. These still work exactly, offline:';

    parts.push(
      `${intro}\n\n${capabilities}\n\nI can also search the ${documentCount} document(s) you have stored — ask about one by name or topic.`,
    );
  }

  const body = parts.join('\n\n');
  const closing = strategy === 'fallback' ? '' : `\n\n${SIGNOFF[language]}`;
  const reply = `${body}${closing}\n\n${OFFLINE_BANNER[language]}`;

  return { reply, usedTools, citations, language, strategy };
}
