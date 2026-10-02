/**
 * BM25 retrieval engine with query expansion and MMR diversification.
 *
 * Replaces the previous "count substring occurrences" scoring, which had three
 * fatal flaws: long documents always won, synonyms never matched, and only the
 * first 8-10k characters of any document were ever visible to the model.
 *
 * Everything here is pure and synchronous so it can run in the browser during
 * typing and on the server during a request without a build step or a service.
 */

import { chunkText, fuzzySimilarity, hashText, stem, summarizeSnippet, tokenize } from './text';

export interface RetrievableDocument {
  id: string;
  title: string;
  text: string;
  /** Free-form bucket, e.g. 'STRATEGY_RULES' | 'COMMUNICATION' | 'FINANCE'. */
  category?: string;
  /** Where the content came from — user uploads outrank built-in knowledge. */
  source?: 'USER_UPLOAD' | 'USER_NOTE' | 'BUILTIN_COMMUNICATION' | 'BUILTIN_FINANCE' | 'CONVERSATION' | 'PROFILE';
  fileName?: string;
  tags?: string[];
  updatedAt?: number;
  /** Multiplier applied to the final score. Defaults to 1. */
  weight?: number;
}

interface IndexedChunk {
  chunkId: string;
  docId: string;
  title: string;
  category: string;
  source: NonNullable<RetrievableDocument['source']>;
  fileName?: string;
  tags: string[];
  updatedAt: number;
  weight: number;
  heading?: string;
  text: string;
  length: number;
  termFrequency: Map<string, number>;
}

export interface RetrievalHit {
  docId: string;
  chunkId: string;
  title: string;
  heading?: string;
  category: string;
  source: string;
  fileName?: string;
  text: string;
  score: number;
  snippet: string;
  matchedTerms: string[];
}

export interface SearchOptions {
  /** Max hits returned after diversification. */
  limit?: number;
  /** 0 = pure relevance, 1 = pure diversity. */
  diversity?: number;
  /** Restrict to these sources. */
  sources?: RetrievableDocument['source'][];
  /** Restrict to these categories. */
  categories?: string[];
  /** Drop hits scoring below this value. */
  minScore?: number;
  /** Favour recently updated documents. Defaults true. */
  recencyBoost?: boolean;
}

/**
 * Domain synonym graph. Query expansion is the cheapest large win in retrieval:
 * a user asking "how big should my position be" must reach documents that only
 * ever say "lot sizing" or "risk per trade".
 */
export const SYNONYMS: Record<string, string[]> = {
  // finance / trading
  position: ['lot', 'size', 'sizing', 'exposure'],
  lot: ['position', 'size', 'sizing', 'volume'],
  risk: ['drawdown', 'exposure', 'loss', 'downside'],
  stop: ['stoploss', 'sl', 'invalidation'],
  target: ['takeprofit', 'tp', 'objective'],
  profit: ['gain', 'return', 'pnl', 'earnings'],
  loss: ['drawdown', 'losing', 'red'],
  budget: ['spending', 'allocation', 'cashflow', 'expenses'],
  save: ['saving', 'savings', 'reserve', 'emergency'],
  debt: ['loan', 'credit', 'borrowing', 'amortization', 'utang'],
  invest: ['investing', 'investment', 'portfolio', 'allocation'],
  interest: ['apr', 'apy', 'yield', 'rate'],
  inflation: ['cpi', 'purchasing', 'deflation'],
  tax: ['taxes', 'withholding', 'taxable'],
  retire: ['retirement', 'pension', 'fire'],
  gold: ['xau', 'xauusd', 'bullion', 'metal'],
  forex: ['fx', 'currency', 'pair'],
  dollar: ['dxy', 'usd', 'greenback'],
  fed: ['fomc', 'federal', 'centralbank', 'rates'],
  volatility: ['atr', 'vol', 'stdev', 'variance'],
  trend: ['momentum', 'direction', 'structure'],
  liquidity: ['sweep', 'stophunt', 'orderblock', 'imbalance'],
  // communication / emotional
  stress: ['anxious', 'anxiety', 'overwhelmed', 'tilt', 'burnout', 'pressure'],
  angry: ['frustrated', 'mad', 'tilt', 'upset', 'galit'],
  sad: ['down', 'low', 'depressed', 'discouraged', 'lungkot'],
  happy: ['glad', 'excited', 'grateful', 'masaya'],
  explain: ['teach', 'clarify', 'describe', 'walkthrough', 'paliwanag'],
  decide: ['decision', 'choose', 'choice', 'tradeoff', 'option'],
  plan: ['planning', 'schedule', 'roadmap', 'steps'],
  help: ['assist', 'support', 'guide', 'tulong'],
  write: ['draft', 'compose', 'rephrase', 'reword'],
  summarize: ['summary', 'tldr', 'recap', 'condense'],
  fix: ['repair', 'debug', 'resolve', 'ayusin'],
};

const EXPANSION_WEIGHT = 0.45;

function expandQuery(tokens: string[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const token of tokens) weights.set(token, Math.max(weights.get(token) ?? 0, 1));
  for (const token of tokens) {
    const related = SYNONYMS[token];
    if (!related) continue;
    for (const synonym of related) {
      const stemmed = stem(synonym);
      if (!weights.has(stemmed)) weights.set(stemmed, EXPANSION_WEIGHT);
    }
  }
  return weights;
}

const SOURCE_PRIORS: Record<string, number> = {
  USER_UPLOAD: 1.35,
  USER_NOTE: 1.2,
  PROFILE: 1.3,
  CONVERSATION: 1.0,
  BUILTIN_FINANCE: 1.0,
  BUILTIN_COMMUNICATION: 1.0,
};

const K1 = 1.4;
const B = 0.72;

export class KnowledgeIndex {
  private chunks: IndexedChunk[] = [];
  private inverted = new Map<string, number[]>();
  private docFrequency = new Map<string, number>();
  private averageLength = 0;
  private docIds = new Set<string>();

  get size(): number {
    return this.chunks.length;
  }

  get documentCount(): number {
    return this.docIds.size;
  }

  /** Total characters held in the index — used by the diagnostics report. */
  get characterCount(): number {
    return this.chunks.reduce((total, chunk) => total + chunk.text.length, 0);
  }

  clear(): void {
    this.chunks = [];
    this.inverted.clear();
    this.docFrequency.clear();
    this.averageLength = 0;
    this.docIds.clear();
  }

  add(document: RetrievableDocument, chunkSize = 1100): void {
    if (!document || typeof document.text !== 'string') return;
    const body = document.text.trim();
    if (!body) return;

    this.docIds.add(document.id);
    const pieces = chunkText(body, { size: chunkSize });
    const source = document.source ?? 'USER_NOTE';

    for (const piece of pieces) {
      // Title and heading are repeated into the indexed text: a chunk from the
      // middle of "Position Sizing Playbook" should still match the word
      // "position" even if that chunk never repeats the title.
      const indexedText = [document.title, piece.heading, (document.tags ?? []).join(' '), piece.text]
        .filter(Boolean)
        .join('\n');
      const tokens = tokenize(indexedText);
      if (tokens.length === 0) continue;

      const termFrequency = new Map<string, number>();
      for (const token of tokens) termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);

      const chunkIndex = this.chunks.length;
      this.chunks.push({
        chunkId: `${document.id}::${piece.index}`,
        docId: document.id,
        title: document.title,
        category: document.category ?? 'GENERAL',
        source,
        fileName: document.fileName,
        tags: document.tags ?? [],
        updatedAt: document.updatedAt ?? 0,
        weight: document.weight ?? 1,
        heading: piece.heading,
        text: piece.text,
        length: tokens.length,
        termFrequency,
      });

      for (const term of termFrequency.keys()) {
        let postings = this.inverted.get(term);
        if (!postings) {
          postings = [];
          this.inverted.set(term, postings);
        }
        postings.push(chunkIndex);
        this.docFrequency.set(term, (this.docFrequency.get(term) ?? 0) + 1);
      }
    }

    this.averageLength =
      this.chunks.length === 0
        ? 0
        : this.chunks.reduce((total, chunk) => total + chunk.length, 0) / this.chunks.length;
  }

  addAll(documents: RetrievableDocument[], chunkSize = 1100): void {
    for (const document of documents) this.add(document, chunkSize);
  }

  /** Remove every chunk belonging to a document (used when a memory is deleted). */
  remove(docId: string): void {
    if (!this.docIds.has(docId)) return;
    const survivors = this.chunks.filter((chunk) => chunk.docId !== docId);
    const documents = new Map<string, RetrievableDocument>();
    for (const chunk of survivors) {
      const existing = documents.get(chunk.docId);
      if (existing) {
        existing.text += `\n\n${chunk.text}`;
      } else {
        documents.set(chunk.docId, {
          id: chunk.docId,
          title: chunk.title,
          text: chunk.text,
          category: chunk.category,
          source: chunk.source,
          fileName: chunk.fileName,
          tags: chunk.tags,
          updatedAt: chunk.updatedAt,
          weight: chunk.weight,
        });
      }
    }
    this.clear();
    this.addAll([...documents.values()]);
  }

  search(query: string, options: SearchOptions = {}): RetrievalHit[] {
    const {
      limit = 8,
      diversity = 0.32,
      sources,
      categories,
      minScore = 0.01,
      recencyBoost = true,
    } = options;

    if (this.chunks.length === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];
    const weightedTerms = expandQuery(queryTokens);

    const totalChunks = this.chunks.length;
    const scores = new Map<number, number>();
    const matched = new Map<number, Set<string>>();
    const now = Date.now();

    for (const [term, termWeight] of weightedTerms) {
      const postings = this.inverted.get(term);
      if (!postings) continue;
      const documentFrequency = this.docFrequency.get(term) ?? 1;
      // BM25 IDF with the +1 guard that keeps very common terms from going negative.
      const idf = Math.log(1 + (totalChunks - documentFrequency + 0.5) / (documentFrequency + 0.5));

      for (const chunkIndex of postings) {
        const chunk = this.chunks[chunkIndex];
        if (sources && !sources.includes(chunk.source)) continue;
        if (categories && !categories.includes(chunk.category)) continue;

        const frequency = chunk.termFrequency.get(term) ?? 0;
        const denominator =
          frequency + K1 * (1 - B + (B * chunk.length) / (this.averageLength || 1));
        const contribution = (idf * (frequency * (K1 + 1))) / (denominator || 1);
        scores.set(chunkIndex, (scores.get(chunkIndex) ?? 0) + contribution * termWeight);

        if (termWeight >= 1) {
          let set = matched.get(chunkIndex);
          if (!set) {
            set = new Set<string>();
            matched.set(chunkIndex, set);
          }
          set.add(term);
        }
      }
    }

    if (scores.size === 0) {
      // Nothing matched lexically. Fall back to fuzzy title matching so that a
      // misspelled file name ("positon sizing") still finds its document.
      // The same source/category filters must apply, otherwise a search
      // restricted to the user's own documents can return built-in reference
      // material and the caller will present it as the user's file.
      return this.fuzzyFallback(query, limit, sources, categories);
    }

    const candidates: { chunkIndex: number; score: number }[] = [];
    for (const [chunkIndex, rawScore] of scores) {
      const chunk = this.chunks[chunkIndex];
      let score = rawScore * chunk.weight * (SOURCE_PRIORS[chunk.source] ?? 1);

      if (recencyBoost && chunk.updatedAt > 0) {
        const ageDays = (now - chunk.updatedAt) / 86_400_000;
        if (ageDays < 30) score *= 1 + 0.25 * (1 - ageDays / 30);
      }
      // Coverage bonus: chunks hitting several distinct query terms are far more
      // likely to be the real answer than one term repeated many times.
      const distinctMatches = matched.get(chunkIndex)?.size ?? 0;
      if (distinctMatches > 1) score *= 1 + 0.12 * (distinctMatches - 1);

      if (score >= minScore) candidates.push({ chunkIndex, score });
    }

    candidates.sort((a, b) => b.score - a.score);
    const pool = candidates.slice(0, Math.max(limit * 5, 30));
    const selected = this.maximalMarginalRelevance(pool, limit, diversity);

    return selected.map(({ chunkIndex, score }) => {
      const chunk = this.chunks[chunkIndex];
      return {
        docId: chunk.docId,
        chunkId: chunk.chunkId,
        title: chunk.title,
        heading: chunk.heading,
        category: chunk.category,
        source: chunk.source,
        fileName: chunk.fileName,
        text: chunk.text,
        score: Number(score.toFixed(4)),
        snippet: summarizeSnippet(chunk.text, 260),
        matchedTerms: [...(matched.get(chunkIndex) ?? [])],
      };
    });
  }

  /**
   * Maximal Marginal Relevance: greedily pick the highest scoring chunk, then
   * penalize anything that repeats what we already picked. Without this, a long
   * document dominates all slots and the model never sees a second perspective.
   */
  private maximalMarginalRelevance(
    pool: { chunkIndex: number; score: number }[],
    limit: number,
    diversity: number,
  ): { chunkIndex: number; score: number }[] {
    if (pool.length === 0) return [];
    const lambda = 1 - Math.min(Math.max(diversity, 0), 0.9);
    const selected: { chunkIndex: number; score: number }[] = [];
    const remaining = [...pool];
    const maxScore = pool[0].score || 1;

    while (selected.length < limit && remaining.length > 0) {
      let bestPosition = 0;
      let bestValue = -Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const normalized = candidate.score / maxScore;
        let maxOverlap = 0;
        for (const chosen of selected) {
          const overlap = this.chunkOverlap(candidate.chunkIndex, chosen.chunkIndex);
          if (overlap > maxOverlap) maxOverlap = overlap;
        }
        const value = lambda * normalized - (1 - lambda) * maxOverlap;
        if (value > bestValue) {
          bestValue = value;
          bestPosition = i;
        }
      }
      selected.push(remaining[bestPosition]);
      remaining.splice(bestPosition, 1);
    }
    return selected;
  }

  private chunkOverlap(a: number, b: number): number {
    const left = this.chunks[a].termFrequency;
    const right = this.chunks[b].termFrequency;
    const [small, large] = left.size <= right.size ? [left, right] : [right, left];
    let shared = 0;
    for (const term of small.keys()) if (large.has(term)) shared++;
    return shared / (small.size || 1);
  }

  private fuzzyFallback(
    query: string,
    limit: number,
    sources?: SearchOptions['sources'],
    categories?: string[],
  ): RetrievalHit[] {
    const seen = new Set<string>();
    const scored: { chunk: IndexedChunk; score: number }[] = [];
    for (const chunk of this.chunks) {
      if (seen.has(chunk.docId)) continue;
      if (sources && !sources.includes(chunk.source)) continue;
      if (categories && !categories.includes(chunk.category)) continue;
      const score = Math.max(
        fuzzySimilarity(query, chunk.title),
        chunk.fileName ? fuzzySimilarity(query, chunk.fileName) : 0,
      );
      if (score > 0.42) {
        seen.add(chunk.docId);
        scored.push({ chunk, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(({ chunk, score }) => ({
      docId: chunk.docId,
      chunkId: chunk.chunkId,
      title: chunk.title,
      heading: chunk.heading,
      category: chunk.category,
      source: chunk.source,
      fileName: chunk.fileName,
      text: chunk.text,
      score: Number(score.toFixed(4)),
      snippet: summarizeSnippet(chunk.text, 260),
      matchedTerms: [],
    }));
  }

  /** Fingerprint of the indexed corpus — lets diagnostics detect silent drift. */
  fingerprint(): string {
    return hashText(
      `${this.chunks.length}:${this.docIds.size}:${this.averageLength.toFixed(2)}:${this.inverted.size}`,
    );
  }

  stats() {
    const bySource: Record<string, number> = {};
    for (const chunk of this.chunks) {
      bySource[chunk.source] = (bySource[chunk.source] ?? 0) + 1;
    }
    return {
      documents: this.docIds.size,
      chunks: this.chunks.length,
      uniqueTerms: this.inverted.size,
      averageChunkTokens: Number(this.averageLength.toFixed(1)),
      characters: this.characterCount,
      bySource,
      fingerprint: this.fingerprint(),
    };
  }
}

/** Convenience helper: build a throwaway index and query it once. */
export function searchDocuments(
  documents: RetrievableDocument[],
  query: string,
  options: SearchOptions = {},
): RetrievalHit[] {
  const index = new KnowledgeIndex();
  index.addAll(documents);
  return index.search(query, options);
}
