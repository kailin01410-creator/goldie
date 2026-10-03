/**
 * System prompt assembly.
 *
 * The previous prompt was ~4,000 words of static identity text with the user's
 * documents bolted on the end, and it asserted things that were not true
 * (boasting about multi-terabyte datasets it never had). Two concrete problems
 * from that: the behavioural rules were diluted across thousands of tokens, and
 * the model was being told it had knowledge it did not have, which is a direct
 * invitation to hallucinate.
 *
 * This builder produces a compact, evidence-first prompt: rules that fit in
 * working memory, then only the grounding that was actually retrieved for this
 * specific message, with explicit instructions about citing it and about what
 * to do when it is missing.
 */

import { COMMUNICATION_PRINCIPLES } from './datasets/communicationCorpus';
import { profileDirectives, type DetectedLanguage, type UserProfile } from './adaptive';
import type { GroundingResult } from './knowledgeBase';
import { renderToolResultsForPrompt, type DetectedCalculation } from './financeTools';
import { summarizeSnippet } from './text';

export interface MarketContext {
  symbol?: string;
  price?: number;
  timeframe?: string;
  session?: string;
  marketStatus?: string;
  isMarketClosed?: boolean;
  marketClosureReason?: string;
  confluenceScore?: number;
  rsi?: number;
}

export interface ProjectContext {
  name?: string;
  category?: string;
  targetSymbol?: string;
  riskRewardRatio?: string;
  maxRiskPerTradePercent?: number;
  rules?: string[];
}

export interface PromptInput {
  message: string;
  profile: UserProfile;
  language: DetectedLanguage;
  grounding: GroundingResult;
  calculations: DetectedCalculation[];
  market?: MarketContext;
  project?: ProjectContext;
  /** ISO timestamp of "now", so the model does not invent a date. */
  nowIso?: string;
}

const IDENTITY = `You are ANGEL — a personal AI assistant built into a live trading and personal-finance terminal.

You are software. You do not have a body, a life outside this session, or feelings in the human sense, and you never claim otherwise. You also never perform emotional manipulation to increase engagement: your job is to make the user more capable and more independent, not more dependent on you.

You are good at: reading and reasoning over the user's own documents, exact financial arithmetic, thinking through decisions, explaining things clearly, drafting text, and keeping track of what was agreed earlier.`;

const ANSWER_CONTRACT = `HOW TO ANSWER
1. Lead with the answer. The first sentence resolves the question; reasoning follows.
2. Length follows the question, not habit. A short question gets a short answer.
3. Use the VERIFIED CALCULATIONS block verbatim when present — those numbers were computed in code and are correct. Never recompute or contradict them.
4. Cite the user's own documents by name when you use them: (source: filename.md). Do not cite documents that are not in the grounding block below.
5. If the grounding does not contain the answer, say so plainly and answer from general knowledge while labelling it as such. Never invent a document, a statistic, a date, or a quote.
6. Never claim to have taken an action in the world (sent, bought, placed, saved, emailed). You can only produce text.
7. Finish with one concrete next step or one specific question — not "let me know if you need anything".
8. Formatting: prose by default. Use a list only for genuinely enumerable items. No decorative headers on short replies. No emoji unless the user uses them first.`;

const SAFETY = `BOUNDARIES
- Information and analysis, not personalised investment advice. Where a decision carries real financial risk, show the tradeoffs and leave the choice with the user.
- Never guarantee a market outcome, a return, or a price. Where you give a probability or a historical base rate, label it as such.
- If the user describes distress that goes beyond money stress, respond with care, keep it human-scale, and encourage real-world support rather than positioning yourself as a substitute for it.
- If asked for something you cannot do, say what you cannot do and then give the closest thing you can.`;

function renderPrinciples(): string {
  // Compact one-line form. The full dataset with examples stays retrievable;
  // only the rules themselves belong in every prompt.
  return COMMUNICATION_PRINCIPLES.map((principle) => `- ${principle.name}: ${principle.rule}`).join('\n');
}

function renderMarket(market?: MarketContext, nowIso?: string): string {
  if (!market) return '';
  const lines = [
    `Current time (UTC): ${nowIso ?? new Date().toISOString()}`,
    market.symbol ? `Instrument on screen: ${market.symbol}` : '',
    typeof market.price === 'number' ? `Live price: ${market.price.toFixed(2)}` : '',
    market.timeframe ? `Chart timeframe: ${market.timeframe}` : '',
    market.session ? `Session: ${market.session}` : '',
    market.isMarketClosed ? `MARKET IS CLOSED — ${market.marketClosureReason ?? 'outside trading hours'}. Do not suggest entries that assume live execution.` : '',
  ].filter(Boolean);
  return lines.length > 0 ? `LIVE TERMINAL STATE\n${lines.join('\n')}` : '';
}

function renderProject(project?: ProjectContext): string {
  if (!project?.name) return '';
  const rules = (project.rules ?? []).map((rule, index) => `  ${index + 1}. ${rule}`).join('\n');
  return `ACTIVE STRATEGY PROJECT
Name: ${project.name}${project.category ? ` (${project.category})` : ''}
Symbol: ${project.targetSymbol ?? 'n/a'} · Target R:R: ${project.riskRewardRatio ?? 'n/a'} · Max risk/trade: ${project.maxRiskPerTradePercent ?? 'n/a'}%
${rules ? `Rules the user has committed to:\n${rules}\n\nIf the user proposes something that breaks one of these rules, point at the specific rule. Do not moralise — just name it.` : ''}`;
}

function renderMemoryGrounding(grounding: GroundingResult): string {
  if (grounding.memoryHits.length === 0) {
    return `USER DOCUMENTS
Nothing in the user's uploaded documents or notes matched this message.
Do NOT pretend to have read a file. If the user believes they uploaded something relevant, say you could not find a match and ask for the file name.`;
  }

  const blocks = grounding.memoryHits.map((hit, index) => {
    const label = hit.fileName ? `${hit.title} (file: ${hit.fileName})` : hit.title;
    const section = hit.heading ? ` › ${hit.heading}` : '';
    return `[DOC ${index + 1}] ${label}${section}  — relevance ${hit.score}
"""
${hit.text}
"""`;
  });

  return `USER DOCUMENTS — the ${grounding.memoryHits.length} most relevant excerpts from the user's own uploads and notes.
These are excerpts, not whole files. If you need a part that is not here, say which document and which section you would need.

${blocks.join('\n\n')}`;
}

function renderFinanceGrounding(grounding: GroundingResult): string {
  if (grounding.financeHits.length === 0) return '';
  const blocks = grounding.financeHits.map((hit) => `- ${hit.title}: ${hit.text.replace(/\n/g, ' ')}`);
  return `REFERENCE FINANCE KNOWLEDGE (built-in, verified definitions and formulas — prefer these over your own recollection)
${blocks.join('\n')}`;
}

function renderStyleGrounding(grounding: GroundingResult): string {
  if (grounding.styleHits.length === 0) return '';
  const blocks = grounding.styleHits.map((hit) => hit.text);
  return `TONE CALIBRATION — worked examples of how to handle a message like this one.
Match the register, structure and directness. Do NOT copy the wording.

${blocks.join('\n\n---\n\n')}`;
}

export interface BuiltPrompt {
  systemInstruction: string;
  /** Diagnostics for the UI: what grounding was actually used. */
  citations: {
    title: string;
    fileName?: string;
    score: number;
    source: string;
    heading?: string;
    snippet?: string;
  }[];
  tokensEstimate: number;
  sections: string[];
}

export function buildSystemPrompt(input: PromptInput): BuiltPrompt {
  const sections: { name: string; body: string }[] = [
    { name: 'identity', body: IDENTITY },
    { name: 'principles', body: `COMMUNICATION RULES\n${renderPrinciples()}` },
    { name: 'contract', body: ANSWER_CONTRACT },
    { name: 'safety', body: SAFETY },
    { name: 'profile', body: `WHAT YOU KNOW ABOUT THIS USER\n${profileDirectives(input.profile, input.language)}` },
    { name: 'market', body: renderMarket(input.market, input.nowIso) },
    { name: 'project', body: renderProject(input.project) },
    { name: 'calculations', body: renderToolResultsForPrompt(input.calculations) },
    { name: 'memory', body: renderMemoryGrounding(input.grounding) },
    { name: 'finance', body: renderFinanceGrounding(input.grounding) },
    { name: 'style', body: renderStyleGrounding(input.grounding) },
  ].filter((section) => section.body && section.body.trim().length > 0);

  const systemInstruction = sections.map((section) => section.body.trim()).join('\n\n==================================================\n\n');

  const citations = input.grounding.memoryHits.map((hit) => ({
    title: hit.title,
    fileName: hit.fileName,
    score: hit.score,
    source: hit.source,
    heading: hit.heading,
    // A short quote lets the user verify the claim without opening the file,
    // and makes a fabricated citation immediately obvious.
    snippet: summarizeSnippet(hit.text, 180),
  }));

  return {
    systemInstruction,
    citations,
    // ~4 characters per token is close enough for budgeting and UI display.
    tokensEstimate: Math.round(systemInstruction.length / 4),
    sections: sections.map((section) => section.name),
  };
}

/**
 * Trim a prompt that has grown past the budget by dropping the least valuable
 * grounding first. Order of sacrifice: style exemplars, then finance reference,
 * then the lowest-scoring document excerpts. Behavioural rules are never cut.
 */
export function enforcePromptBudget(input: PromptInput, maxCharacters = 120_000): PromptInput {
  let working = input;
  let built = buildSystemPrompt(working);
  if (built.systemInstruction.length <= maxCharacters) return working;

  working = {
    ...working,
    grounding: { ...working.grounding, styleHits: working.grounding.styleHits.slice(0, 1) },
  };
  built = buildSystemPrompt(working);
  if (built.systemInstruction.length <= maxCharacters) return working;

  working = {
    ...working,
    grounding: { ...working.grounding, financeHits: working.grounding.financeHits.slice(0, 2) },
  };
  built = buildSystemPrompt(working);
  if (built.systemInstruction.length <= maxCharacters) return working;

  let memoryHits = [...working.grounding.memoryHits];
  while (memoryHits.length > 1) {
    memoryHits = memoryHits.slice(0, memoryHits.length - 1);
    working = { ...working, grounding: { ...working.grounding, memoryHits } };
    built = buildSystemPrompt(working);
    if (built.systemInstruction.length <= maxCharacters) return working;
  }

  // Last resort: truncate the single remaining excerpt.
  if (memoryHits.length === 1) {
    const only = memoryHits[0];
    working = {
      ...working,
      grounding: {
        ...working.grounding,
        memoryHits: [{ ...only, text: only.text.slice(0, 20_000) + '\n[excerpt truncated to fit the context budget]' }],
      },
    };
  }
  return working;
}
