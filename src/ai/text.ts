/**
 * Core text processing primitives shared by the browser and the Node server.
 *
 * Deliberately dependency-free so the exact same tokenizer/stemmer/chunker runs
 * on both sides. If the client and the server tokenize differently, retrieval
 * scores drift and ANGEL "forgets" documents it should have found.
 */

/** English + Tagalog stopwords. Tagalog matters: ANGEL speaks Taglish. */
export const STOPWORDS = new Set<string>([
  // English
  'a', 'about', 'above', 'after', 'again', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further',
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'him', 'his', 'how',
  'i', 'if', 'in', 'into', 'is', 'it', 'its', 'just', 'me', 'more', 'most', 'my',
  'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'out', 'over', 'own',
  'same', 'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then',
  'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up',
  'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why',
  'will', 'with', 'would', 'you', 'your', 'yours',
  // Tagalog / Taglish fillers
  'ang', 'ng', 'sa', 'na', 'ay', 'mga', 'ko', 'mo', 'niya', 'namin', 'natin', 'ninyo', 'nila',
  'ako', 'ikaw', 'siya', 'kami', 'tayo', 'kayo', 'sila', 'ito', 'iyan', 'iyon', 'dito', 'diyan',
  'doon', 'para', 'kung', 'pero', 'at', 'o', 'din', 'rin', 'lang', 'lamang', 'naman', 'po', 'opo',
  'yung', 'yan', 'nung', 'kasi', 'nga', 'ba', 'pa', 'may', 'meron', 'wala', 'hindi', 'oo',
]);

const SUFFIXES = [
  'ational', 'izations', 'fulness', 'ousness', 'iveness', 'ization', 'ations', 'tional',
  'alities', 'ability', 'ically', 'ation', 'ement', 'ments', 'ingly', 'ities', 'ality',
  'ively', 'ness', 'ment', 'ance', 'ence', 'able', 'ible', 'ical', 'ing', 'ers', 'est',
  'ies', 'ive', 'ful', 'ous', 'ed', 'ly', 'es', 's',
];

/**
 * Light suffix stripper. Not a full Porter stemmer — it is intentionally
 * conservative so that domain tokens ("options", "hedging", "drawdowns") collapse
 * onto a shared root without mangling short words or tickers.
 */
export function stem(word: string): string {
  if (word.length <= 4) return word;
  for (const suffix of SUFFIXES) {
    if (word.length - suffix.length >= 3 && word.endsWith(suffix)) {
      let root = word.slice(0, word.length - suffix.length);
      // restore a dropped 'e' ("positioning" -> "position", "valuing" -> "value")
      if (root.length >= 3 && /[^aeiou]{2}$/.test(root) && (suffix === 'ing' || suffix === 'ed')) {
        return root;
      }
      if (root.endsWith('i') && root.length > 3) root = root.slice(0, -1) + 'y';
      return root;
    }
  }
  return word;
}

/** Split raw text into normalized, stopword-filtered, stemmed tokens. */
export function tokenize(text: string, opts: { keepStopwords?: boolean; stemming?: boolean } = {}): string[] {
  const { keepStopwords = false, stemming = true } = opts;
  if (!text) return [];
  const normalized = text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    // keep % and . inside numbers (1.5%, 0.25) and / inside pairs (xau/usd)
    .replace(/[^a-z0-9%./\s_-]/g, ' ');

  const out: string[] = [];
  for (const rawToken of normalized.split(/[\s_]+/)) {
    let token = rawToken.replace(/^[-./]+|[-./]+$/g, '');
    if (!token || token.length < 2) continue;
    if (token.length > 40) token = token.slice(0, 40);
    if (!keepStopwords && STOPWORDS.has(token)) continue;
    out.push(stemming ? stem(token) : token);
  }
  return out;
}

/** Character bigrams of a string — used for fuzzy title matching and typo tolerance. */
export function bigrams(value: string): Set<string> {
  const clean = value.toLowerCase().replace(/\s+/g, ' ').trim();
  const grams = new Set<string>();
  for (let i = 0; i < clean.length - 1; i++) grams.add(clean.slice(i, i + 2));
  return grams;
}

/** Dice coefficient over character bigrams. Returns 0..1. */
export function fuzzySimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ga = bigrams(a);
  const gb = bigrams(b);
  if (ga.size === 0 || gb.size === 0) return 0;
  let shared = 0;
  for (const gram of ga) if (gb.has(gram)) shared++;
  return (2 * shared) / (ga.size + gb.size);
}

/** Stable, fast, non-cryptographic hash (FNV-1a 32-bit) rendered as base36. */
export function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export interface TextChunk {
  index: number;
  text: string;
  /** Nearest preceding markdown heading, when one exists. */
  heading?: string;
  startOffset: number;
}

export interface ChunkOptions {
  /** Target characters per chunk. */
  size?: number;
  /** Characters of trailing context repeated at the start of the next chunk. */
  overlap?: number;
  /** Hard ceiling on produced chunks (protects against 100MB pastes). */
  maxChunks?: number;
}

/**
 * Structure-aware chunker.
 *
 * Splits on markdown headings first, then packs paragraphs up to `size`. This
 * keeps a rule block or a definition intact instead of slicing it in half,
 * which is what made the old naive `content.slice(0, 10000)` approach useless
 * for anything past the first page of a document.
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const { size = 1100, overlap = 140, maxChunks = 400 } = options;
  if (!text || !text.trim()) return [];

  const chunks: TextChunk[] = [];
  const lines = text.split(/\r?\n/);

  let currentHeading = '';
  let buffer = '';
  let bufferStart = 0;
  let offset = 0;
  let previousTail = '';

  const flush = () => {
    const body = buffer.trim();
    if (body.length === 0) {
      buffer = '';
      return;
    }
    if (chunks.length >= maxChunks) {
      buffer = '';
      return;
    }
    chunks.push({
      index: chunks.length,
      text: previousTail ? `${previousTail}\n${body}` : body,
      heading: currentHeading || undefined,
      startOffset: bufferStart,
    });
    previousTail = overlap > 0 ? body.slice(-overlap) : '';
    buffer = '';
  };

  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    const isSectionBreak = headingMatch || /^={3,}$|^-{3,}$/.test(line.trim());

    // Start a new chunk at a section break — but not if the current buffer is
    // only a heading or a stray line. A chunk containing nothing but "# Title"
    // is a retrieval hit with no information in it, which reads to the user as
    // the assistant quoting something meaningless back at them.
    const minChunk = Math.min(120, Math.floor(size / 2));
    if (isSectionBreak && buffer.trim().length >= minChunk) flush();
    if (headingMatch) {
      currentHeading = headingMatch[2].trim().slice(0, 120);
      previousTail = '';
    }

    if (buffer.length === 0) bufferStart = offset;
    buffer += line + '\n';
    offset += line.length + 1;

    // A single line can be longer than the whole target chunk (minified text,
    // a CSV row, a paragraph with no newlines). Hard-split on word boundaries
    // so one giant line cannot become one giant chunk.
    while (buffer.length > size * 1.8) {
      const window = buffer.slice(0, size);
      const breakAt = Math.max(window.lastIndexOf(' '), window.lastIndexOf('\n'));
      const cut = breakAt > size * 0.5 ? breakAt : size;
      const head = buffer.slice(0, cut);
      const tail = buffer.slice(cut);
      buffer = head;
      flush();
      buffer = tail.replace(/^\s+/, '');
      bufferStart = offset - buffer.length;
    }

    if (buffer.length >= size) {
      // prefer to break at the last blank line so paragraphs stay whole
      const breakAt = buffer.lastIndexOf('\n\n');
      if (breakAt > size * 0.45) {
        const head = buffer.slice(0, breakAt);
        const tail = buffer.slice(breakAt);
        buffer = head;
        flush();
        buffer = tail.replace(/^\n+/, '');
        bufferStart = offset - buffer.length;
      } else {
        flush();
      }
    }
  }
  flush();

  return chunks;
}

/** Collapse whitespace and trim to a readable preview of `max` characters. */
export function summarizeSnippet(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

export function formatBytesShort(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 100 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
