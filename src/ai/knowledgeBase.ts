/**
 * Turns the built-in corpora and the user's own memories into one searchable
 * knowledge base.
 *
 * The index is built lazily and cached; rebuilding only happens when the
 * memory set actually changes (tracked by a cheap signature) so typing in the
 * chat box does not re-index megabytes of documents on every keystroke.
 */

import {
  COMMUNICATION_EXEMPLARS,
  COMMUNICATION_PRINCIPLES,
  COMMUNICATION_CORPUS_STATS,
  type CommunicationExemplar,
} from './datasets/communicationCorpus';
import {
  FINANCE_ENTRIES,
  FINANCE_PLAYBOOKS,
  FINANCE_CORPUS_STATS,
} from './datasets/financeCorpus';
import { KnowledgeIndex, type RetrievableDocument, type RetrievalHit } from './retrieval';
import { hashText } from './text';

/* ------------------------------------------------------------------ */
/* Dataset -> document conversion                                      */
/* ------------------------------------------------------------------ */

export function communicationDocuments(): RetrievableDocument[] {
  const exemplars: RetrievableDocument[] = COMMUNICATION_EXEMPLARS.map((item) => ({
    id: `comm:${item.id}`,
    title: `${item.intent} — ${item.situation}`,
    category: `COMM_${item.intent}`,
    source: 'BUILTIN_COMMUNICATION',
    tags: [...item.tags, item.language, item.intent],
    text: [
      `Situation: ${item.situation}`,
      `Language: ${item.language}`,
      `Techniques: ${item.techniques.join(', ')}`,
      item.avoid?.length ? `Avoid: ${item.avoid.join('; ')}` : '',
      `USER: ${item.user}`,
      `ANGEL: ${item.angel}`,
    ]
      .filter(Boolean)
      .join('\n'),
  }));

  const principles: RetrievableDocument[] = COMMUNICATION_PRINCIPLES.map((item) => ({
    id: `principle:${item.id}`,
    title: `Principle — ${item.name}`,
    category: 'COMM_PRINCIPLE',
    source: 'BUILTIN_COMMUNICATION',
    tags: ['principle', 'style'],
    text: `Rule: ${item.rule}\nWhy: ${item.why}\nGood: ${item.good}\nBad: ${item.bad}`,
  }));

  return [...exemplars, ...principles];
}

export function financeDocuments(): RetrievableDocument[] {
  const entries: RetrievableDocument[] = FINANCE_ENTRIES.map((item) => ({
    id: `fin:${item.id}`,
    title: item.term,
    category: item.domain,
    source: 'BUILTIN_FINANCE',
    tags: [...item.tags, ...(item.aliases ?? [])],
    text: [
      `Term: ${item.term}${item.aliases?.length ? ` (also: ${item.aliases.join(', ')})` : ''}`,
      `Domain: ${item.domain}`,
      `Definition: ${item.definition}`,
      item.formula ? `Formula: ${item.formula}` : '',
      item.example ? `Worked example: ${item.example}` : '',
      item.pitfall ? `Common mistake: ${item.pitfall}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  }));

  const playbooks: RetrievableDocument[] = FINANCE_PLAYBOOKS.map((item) => ({
    id: `play:${item.id}`,
    title: item.title,
    category: item.domain,
    source: 'BUILTIN_FINANCE',
    tags: [...item.tags, 'playbook', 'procedure'],
    text: `Playbook: ${item.title}\nUse when: ${item.when}\n${item.steps.join('\n')}`,
  }));

  return [...entries, ...playbooks];
}

/* ------------------------------------------------------------------ */
/* Memory conversion                                                   */
/* ------------------------------------------------------------------ */

export interface MemoryLike {
  id: string;
  title: string;
  content: string;
  category?: string;
  sourceType?: string;
  fileName?: string;
  tags?: string[];
  isActive?: boolean;
  updatedAt?: number;
  createdAt?: number;
}

export function memoryDocuments(memories: MemoryLike[]): RetrievableDocument[] {
  return (memories ?? [])
    .filter((memory) => memory && memory.isActive !== false && typeof memory.content === 'string' && memory.content.trim())
    .map((memory) => ({
      id: memory.id,
      title: memory.title || memory.fileName || 'Untitled note',
      text: memory.content,
      category: memory.category ?? 'UPLOADED_DOC',
      source: memory.sourceType === 'FILE_UPLOAD' ? ('USER_UPLOAD' as const) : ('USER_NOTE' as const),
      fileName: memory.fileName,
      tags: memory.tags ?? [],
      updatedAt: memory.updatedAt ?? memory.createdAt ?? 0,
      // The user's own material must outrank built-in reference knowledge.
      weight: 1.25,
    }));
}

/* ------------------------------------------------------------------ */
/* Cached composite index                                              */
/* ------------------------------------------------------------------ */

export interface KnowledgeBaseSnapshot {
  index: KnowledgeIndex;
  signature: string;
  builtAt: number;
  memoryCount: number;
}

let cached: KnowledgeBaseSnapshot | null = null;

function memorySignature(memories: MemoryLike[]): string {
  // id + length + updatedAt is enough to notice adds, deletes and edits without
  // hashing hundreds of megabytes of document text.
  const parts = (memories ?? []).map(
    (memory) => `${memory.id}:${memory.content?.length ?? 0}:${memory.updatedAt ?? 0}:${memory.isActive !== false ? 1 : 0}`,
  );
  return hashText(parts.join('|'));
}

export function buildKnowledgeBase(memories: MemoryLike[] = [], force = false): KnowledgeBaseSnapshot {
  const signature = memorySignature(memories);
  if (!force && cached && cached.signature === signature) return cached;

  const index = new KnowledgeIndex();
  index.addAll(communicationDocuments(), 900);
  index.addAll(financeDocuments(), 900);
  index.addAll(memoryDocuments(memories), 1100);

  cached = {
    index,
    signature,
    builtAt: Date.now(),
    memoryCount: memories?.length ?? 0,
  };
  return cached;
}

export function invalidateKnowledgeBase(): void {
  cached = null;
}

/* ------------------------------------------------------------------ */
/* Composite retrieval                                                 */
/* ------------------------------------------------------------------ */

export interface GroundingResult {
  /** The user's own documents that are relevant to this message. */
  memoryHits: RetrievalHit[];
  /** Finance reference knowledge relevant to this message. */
  financeHits: RetrievalHit[];
  /** Communication exemplars demonstrating how to answer this kind of message. */
  styleHits: RetrievalHit[];
  stats: ReturnType<KnowledgeIndex['stats']>;
}

export interface GroundingOptions {
  memoryLimit?: number;
  financeLimit?: number;
  styleLimit?: number;
}

export function gatherGrounding(
  query: string,
  memories: MemoryLike[] = [],
  options: GroundingOptions = {},
): GroundingResult {
  const { memoryLimit = 6, financeLimit = 4, styleLimit = 3 } = options;
  const { index } = buildKnowledgeBase(memories);

  return {
    memoryHits: index.search(query, {
      limit: memoryLimit,
      sources: ['USER_UPLOAD', 'USER_NOTE', 'CONVERSATION', 'PROFILE'],
      diversity: 0.35,
    }),
    financeHits: index.search(query, {
      limit: financeLimit,
      sources: ['BUILTIN_FINANCE'],
      diversity: 0.45,
    }),
    styleHits: index.search(query, {
      limit: styleLimit,
      sources: ['BUILTIN_COMMUNICATION'],
      diversity: 0.5,
    }),
    stats: index.stats(),
  };
}

/** Pick exemplars by intent when retrieval produced nothing useful. */
export function exemplarsByIntent(intent: string, limit = 2): CommunicationExemplar[] {
  return COMMUNICATION_EXEMPLARS.filter((item) => item.intent === intent).slice(0, limit);
}

/** Honest, computed description of what the knowledge base actually contains. */
export function knowledgeBaseReport(memories: MemoryLike[] = []) {
  const { index } = buildKnowledgeBase(memories);
  const stats = index.stats();
  const activeMemories = (memories ?? []).filter((memory) => memory.isActive !== false);
  const memoryCharacters = activeMemories.reduce((total, memory) => total + (memory.content?.length ?? 0), 0);

  return {
    communication: {
      exemplars: COMMUNICATION_CORPUS_STATS.exemplars,
      principles: COMMUNICATION_CORPUS_STATS.principles,
      patterns: COMMUNICATION_CORPUS_STATS.patterns,
      intents: COMMUNICATION_CORPUS_STATS.intents,
      languages: COMMUNICATION_CORPUS_STATS.languages,
      characters: COMMUNICATION_CORPUS_STATS.characters,
    },
    finance: {
      entries: FINANCE_CORPUS_STATS.entries,
      playbooks: FINANCE_CORPUS_STATS.playbooks,
      formulas: FINANCE_CORPUS_STATS.formulas,
      domains: FINANCE_CORPUS_STATS.domains,
      characters: FINANCE_CORPUS_STATS.characters,
    },
    userMemory: {
      documents: activeMemories.length,
      inactive: (memories?.length ?? 0) - activeMemories.length,
      characters: memoryCharacters,
    },
    index: stats,
  };
}
