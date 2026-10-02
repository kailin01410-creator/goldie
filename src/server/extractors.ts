/**
 * Server-side document text extraction.
 *
 * The old pipeline did `buffer.toString('utf-8')` on everything. For a PDF or a
 * Word file that produces a few kilobytes of mojibake, which was then stored as
 * "knowledge" and fed to the model — actively worse than storing nothing,
 * because the model treats it as real content.
 *
 * This module extracts genuine text per format:
 *   - PDF    : inflate content streams, parse text-showing operators
 *   - DOCX   : unzip, read word/document.xml, preserve paragraph breaks
 *   - XLSX   : unzip, resolve the shared-string table, emit CSV per sheet
 *   - PPTX   : unzip, read every slide's text runs
 *   - CSV/TSV: parse, report shape, keep a bounded sample
 *   - JSON   : validate, summarise structure, keep it readable
 *   - text   : BOM/encoding detection
 *   - other  : printable-string salvage, clearly labelled as partial
 *
 * No new runtime dependency: PDF uses Node's zlib, the OOXML formats are zip
 * archives that JSZip already handles.
 */

import zlib from 'zlib';
import JSZip from 'jszip';

export interface ExtractionResult {
  text: string;
  /** Format actually detected, which may differ from the extension. */
  format: string;
  /** True when the text is complete and trustworthy. */
  complete: boolean;
  /** Human-readable explanation when extraction was partial or failed. */
  note?: string;
  /** Extra structured facts worth keeping (row counts, sheet names, page count). */
  meta?: Record<string, string | number>;
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'rst', 'log', 'csv', 'tsv', 'json', 'jsonl', 'ndjson', 'xml', 'yaml', 'yml',
  'html', 'htm', 'css', 'scss', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'py', 'rb', 'go', 'rs', 'java',
  'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sql', 'sh', 'bash', 'zsh', 'ps1', 'ini', 'cfg', 'conf', 'toml',
  'env', 'properties', 'r', 'm', 'jl', 'lua', 'pl', 'swift', 'kt', 'dart', 'vue', 'svelte',
  'mq4', 'mq5', 'mqh', 'pine', 'tex', 'srt', 'vtt', 'gitignore', 'dockerfile', 'makefile',
]);

export function extensionOf(fileName: string): string {
  const base = fileName.split('/').pop() ?? fileName;
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return base.toLowerCase();
  return base.slice(dot + 1).toLowerCase();
}

export function isTextExtension(fileName: string): boolean {
  return TEXT_EXTENSIONS.has(extensionOf(fileName));
}

/* ------------------------------------------------------------------ */
/* Encoding                                                            */
/* ------------------------------------------------------------------ */

/** Decode a buffer, honouring BOMs and falling back to latin1 for binary-ish data. */
export function decodeText(buffer: Buffer): { text: string; encoding: string } {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return { text: buffer.subarray(3).toString('utf-8'), encoding: 'utf-8-bom' };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { text: buffer.subarray(2).toString('utf16le'), encoding: 'utf-16le' };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    // UTF-16BE: swap bytes, then decode as LE.
    const swapped = Buffer.from(buffer.subarray(2));
    swapped.swap16();
    return { text: swapped.toString('utf16le'), encoding: 'utf-16be' };
  }

  const utf8 = buffer.toString('utf-8');
  // U+FFFD density is a reliable signal that this was not UTF-8.
  const replacements = (utf8.match(/\uFFFD/g) ?? []).length;
  if (replacements > 0 && replacements / Math.max(utf8.length, 1) > 0.01) {
    return { text: buffer.toString('latin1'), encoding: 'latin1' };
  }
  return { text: utf8, encoding: 'utf-8' };
}

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

/** Decode a PDF literal string, handling escapes and octal codes. */
function decodePdfLiteral(raw: string): string {
  let out = '';
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char !== '\\') {
      out += char;
      continue;
    }
    const next = raw[++i];
    switch (next) {
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      case 'b': out += '\b'; break;
      case 'f': out += '\f'; break;
      case '(': out += '('; break;
      case ')': out += ')'; break;
      case '\\': out += '\\'; break;
      case '\n': break; // line continuation
      default:
        if (next >= '0' && next <= '7') {
          let octal = next;
          while (octal.length < 3 && raw[i + 1] >= '0' && raw[i + 1] <= '7') octal += raw[++i];
          out += String.fromCharCode(parseInt(octal, 8));
        } else if (next !== undefined) {
          out += next;
        }
    }
  }
  return out;
}

function decodePdfHex(raw: string): string {
  const hex = raw.replace(/[^0-9a-fA-F]/g, '');
  let out = '';
  // Two-byte sequences are usually UTF-16BE from an embedded font.
  if (hex.length % 4 === 0 && /^(00|[0-9a-fA-F]{2})/.test(hex)) {
    for (let i = 0; i + 3 < hex.length; i += 4) {
      const code = parseInt(hex.slice(i, i + 4), 16);
      if (code > 0) out += String.fromCharCode(code);
    }
    if (out.replace(/[^\x20-\x7e]/g, '').length > out.length * 0.6) return out;
    out = '';
  }
  for (let i = 0; i + 1 < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code >= 9) out += String.fromCharCode(code);
  }
  return out;
}

/** Pull the text-showing operators out of one decoded content stream. */
function textFromPdfContentStream(content: string): string {
  const pieces: string[] = [];
  // Matches: (literal) Tj | <hex> Tj | [ ... ] TJ | (literal) ' | (literal) "
  const operatorPattern = /(\((?:\\.|[^\\()])*\)|<[0-9a-fA-F\s]*>|\[(?:[^\]\\]|\\.)*\])\s*(TJ|Tj|'|")/g;
  let match: RegExpExecArray | null;

  while ((match = operatorPattern.exec(content)) !== null) {
    const [, operand, operator] = match;
    if (operand.startsWith('[')) {
      // TJ array: strings interleaved with kerning numbers. A large negative
      // kern means a word space the font did not encode explicitly.
      const inner = operand.slice(1, -1);
      const partPattern = /(\((?:\\.|[^\\()])*\))|(<[0-9a-fA-F\s]*>)|(-?\d+(?:\.\d+)?)/g;
      let part: RegExpExecArray | null;
      let line = '';
      while ((part = partPattern.exec(inner)) !== null) {
        if (part[1]) line += decodePdfLiteral(part[1].slice(1, -1));
        else if (part[2]) line += decodePdfHex(part[2].slice(1, -1));
        else if (part[3] && parseFloat(part[3]) < -180) line += ' ';
      }
      pieces.push(line);
    } else if (operand.startsWith('<')) {
      pieces.push(decodePdfHex(operand.slice(1, -1)));
    } else {
      pieces.push(decodePdfLiteral(operand.slice(1, -1)));
    }
    if (operator === "'" || operator === '"') pieces.push('\n');
  }

  // Line breaks also come from the text-positioning operators.
  return pieces.join('').replace(/[ \t]{3,}/g, '  ');
}

export function extractPdf(buffer: Buffer): ExtractionResult {
  const raw = buffer.toString('latin1');
  const pageCount = (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length || undefined;

  if (/\/Encrypt\b/.test(raw)) {
    return {
      text: '',
      format: 'pdf',
      complete: false,
      note: 'This PDF is encrypted or password protected, so no text could be extracted. Export an unprotected copy and upload that.',
      meta: pageCount ? { pages: pageCount } : undefined,
    };
  }

  const chunks: string[] = [];
  let inflateFailures = 0;
  let streamCount = 0;

  // Walk every stream object. Byte offsets are used rather than a regex over
  // the whole file because stream payloads are binary and will contain
  // anything, including the literal text "endstream" in compressed form.
  let cursor = 0;
  while (cursor < buffer.length) {
    const start = buffer.indexOf('stream', cursor);
    if (start === -1) break;
    const dictionaryStart = Math.max(0, raw.lastIndexOf('<<', start));
    const dictionary = raw.slice(dictionaryStart, start);

    let payloadStart = start + 'stream'.length;
    if (buffer[payloadStart] === 0x0d) payloadStart++;
    if (buffer[payloadStart] === 0x0a) payloadStart++;

    const end = buffer.indexOf('endstream', payloadStart);
    if (end === -1) break;

    const payload = buffer.subarray(payloadStart, end);
    cursor = end + 'endstream'.length;
    streamCount++;

    // Skip anything that is obviously not a content stream.
    if (/\/Subtype\s*\/Image|\/Type\s*\/XObject[^]*?\/Subtype\s*\/Image|\/Type\s*\/Font|\/FontFile/.test(dictionary)) {
      continue;
    }

    let decoded: string | null = null;
    if (/\/FlateDecode/.test(dictionary)) {
      try {
        decoded = zlib.inflateSync(payload).toString('latin1');
      } catch {
        try {
          decoded = zlib.inflateRawSync(payload).toString('latin1');
        } catch {
          inflateFailures++;
        }
      }
    } else if (!/\/Filter/.test(dictionary)) {
      decoded = payload.toString('latin1');
    }

    if (!decoded) continue;
    if (!/(TJ|Tj|'|")\s/.test(decoded) && !/BT\s/.test(decoded)) continue;

    const text = textFromPdfContentStream(decoded);
    if (text.trim()) chunks.push(text);
  }

  const text = chunks
    .join('\n')
    .replace(/\u0000/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!text) {
    return {
      text: '',
      format: 'pdf',
      complete: false,
      note:
        streamCount === 0
          ? 'No readable streams found — the file may not be a valid PDF.'
          : 'No extractable text layer. This is almost certainly a scanned PDF (images of text), which needs OCR rather than text extraction.',
      meta: { streams: streamCount, pages: pageCount ?? 0 },
    };
  }

  return {
    text,
    format: 'pdf',
    complete: inflateFailures === 0,
    note: inflateFailures > 0 ? `${inflateFailures} stream(s) could not be decompressed; some text may be missing.` : undefined,
    meta: { pages: pageCount ?? 0, streams: streamCount, characters: text.length },
  };
}

/* ------------------------------------------------------------------ */
/* OOXML (docx / xlsx / pptx)                                          */
/* ------------------------------------------------------------------ */

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<w:p\b[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/a:p>/g, '\n')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .replace(/<w:tab\b[^>]*\/>/g, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const main = zip.file('word/document.xml');
    if (!main) {
      return { text: '', format: 'docx', complete: false, note: 'No word/document.xml inside the archive — not a valid .docx.' };
    }
    const xml = await main.async('text');
    let text = stripXmlTags(xml).replace(/\n{3,}/g, '\n\n').trim();

    // Footnotes and endnotes carry real content in research documents.
    for (const extra of ['word/footnotes.xml', 'word/endnotes.xml']) {
      const file = zip.file(extra);
      if (!file) continue;
      const extraText = stripXmlTags(await file.async('text')).trim();
      if (extraText.length > 40) text += `\n\n--- ${extra.split('/').pop()} ---\n${extraText}`;
    }

    return {
      text,
      format: 'docx',
      complete: true,
      meta: { characters: text.length, words: text.split(/\s+/).filter(Boolean).length },
    };
  } catch (error) {
    return { text: '', format: 'docx', complete: false, note: `Could not open the .docx archive: ${(error as Error).message}` };
  }
}

export async function extractXlsx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const zip = await JSZip.loadAsync(buffer);

    // Shared strings are stored once and referenced by index from each cell.
    const sharedStrings: string[] = [];
    const sharedFile = zip.file('xl/sharedStrings.xml');
    if (sharedFile) {
      const xml = await sharedFile.async('text');
      for (const match of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
        sharedStrings.push(stripXmlTags(match[1]).replace(/\s+/g, ' ').trim());
      }
    }

    const sheetNames = new Map<string, string>();
    const workbook = zip.file('xl/workbook.xml');
    if (workbook) {
      const xml = await workbook.async('text');
      let ordinal = 1;
      for (const match of xml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*\/>/g)) {
        sheetNames.set(`sheet${ordinal++}`, match[1]);
      }
    }

    const sheetFiles = Object.keys(zip.files)
      .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .sort();

    const sections: string[] = [];
    let totalRows = 0;

    for (const sheetFile of sheetFiles) {
      const key = sheetFile.replace('xl/worksheets/', '').replace('.xml', '');
      const label = sheetNames.get(key) ?? key;
      const xml = await zip.files[sheetFile].async('text');
      const rows: string[] = [];

      for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
        const cells: string[] = [];
        for (const cellMatch of rowMatch[1].matchAll(/<c[^>]*?(?:\st="(\w+)")?[^>]*>([\s\S]*?)<\/c>/g)) {
          const type = cellMatch[1];
          const inner = cellMatch[2];
          const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(inner);
          const inlineMatch = /<is>([\s\S]*?)<\/is>/.exec(inner);
          let value = '';
          if (inlineMatch) value = stripXmlTags(inlineMatch[1]).trim();
          else if (valueMatch) {
            value = valueMatch[1];
            if (type === 's') value = sharedStrings[Number(value)] ?? '';
          }
          cells.push(value.replace(/[\r\n,]+/g, ' ').trim());
        }
        if (cells.some((cell) => cell !== '')) {
          rows.push(cells.join(','));
          totalRows++;
        }
        if (rows.length >= 5000) break;
      }

      if (rows.length > 0) sections.push(`--- Sheet: ${label} (${rows.length} rows) ---\n${rows.join('\n')}`);
    }

    const text = sections.join('\n\n');
    return {
      text,
      format: 'xlsx',
      complete: totalRows < 5000,
      note: totalRows >= 5000 ? 'Large workbook — the first 5,000 rows per sheet were kept.' : undefined,
      meta: { sheets: sheetFiles.length, rows: totalRows },
    };
  } catch (error) {
    return { text: '', format: 'xlsx', complete: false, note: `Could not open the .xlsx archive: ${(error as Error).message}` };
  }
}

export async function extractPptx(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slides = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const number = (name: string) => Number(/slide(\d+)\.xml/.exec(name)?.[1] ?? 0);
        return number(a) - number(b);
      });

    const sections: string[] = [];
    for (const slide of slides) {
      const xml = await zip.files[slide].async('text');
      const text = stripXmlTags(xml).replace(/\n{2,}/g, '\n').trim();
      if (text) sections.push(`--- Slide ${/slide(\d+)/.exec(slide)?.[1]} ---\n${text}`);
    }

    return {
      text: sections.join('\n\n'),
      format: 'pptx',
      complete: true,
      meta: { slides: slides.length },
    };
  } catch (error) {
    return { text: '', format: 'pptx', complete: false, note: `Could not open the .pptx archive: ${(error as Error).message}` };
  }
}

/* ------------------------------------------------------------------ */
/* Tabular & structured text                                           */
/* ------------------------------------------------------------------ */

/** RFC-4180-ish CSV splitter that respects quotes. */
export function parseDelimited(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === delimiter) {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') field += char;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((entry) => entry.some((cell) => cell.trim() !== ''));
}

export function extractCsv(text: string, fileName: string): ExtractionResult {
  const delimiter = fileName.toLowerCase().endsWith('.tsv') ? '\t' : ',';
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) return { text: '', format: 'csv', complete: false, note: 'The file contained no parseable rows.' };

  const header = rows[0];
  const body = rows.slice(1);

  // A header plus a numeric profile makes the dataset genuinely useful to the
  // model — otherwise it only ever sees the first few hundred raw lines.
  const numericColumns: string[] = [];
  const profiles: string[] = [];
  header.forEach((name, column) => {
    const values = body
      .map((entry) => Number(String(entry[column] ?? '').replace(/[,$%\s]/g, '')))
      .filter((value) => Number.isFinite(value));
    if (values.length >= Math.max(3, body.length * 0.6)) {
      numericColumns.push(name);
      const sum = values.reduce((total, value) => total + value, 0);
      const mean = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      profiles.push(`  ${name || `col${column + 1}`}: n=${values.length}, min=${min}, max=${max}, mean=${mean.toFixed(4)}, sum=${sum.toFixed(2)}`);
    }
  });

  const sampleLimit = 400;
  const sample = rows.slice(0, sampleLimit).map((entry) => entry.join(delimiter === '\t' ? '\t' : ','));

  const summary = [
    `Dataset: ${fileName}`,
    `Shape: ${body.length} data rows × ${header.length} columns`,
    `Columns: ${header.join(', ')}`,
    numericColumns.length > 0 ? `Numeric column statistics:\n${profiles.join('\n')}` : '',
    '',
    body.length > sampleLimit ? `First ${sampleLimit} rows (of ${rows.length} total):` : 'Full contents:',
    sample.join('\n'),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    text: summary,
    format: 'csv',
    complete: rows.length <= sampleLimit,
    note: rows.length > sampleLimit ? `Large dataset — column statistics cover all ${body.length} rows, but only the first ${sampleLimit} rows are stored verbatim.` : undefined,
    meta: { rows: body.length, columns: header.length, numericColumns: numericColumns.length },
  };
}

export function extractJson(text: string, fileName: string): ExtractionResult {
  try {
    const parsed = JSON.parse(text);
    const describe = (value: unknown, depth = 0): string => {
      if (depth > 3) return '…';
      if (Array.isArray(value)) {
        return `array(${value.length})${value.length > 0 ? ` of ${describe(value[0], depth + 1)}` : ''}`;
      }
      if (value && typeof value === 'object') {
        const keys = Object.keys(value as object).slice(0, 12);
        return `{ ${keys.join(', ')}${Object.keys(value as object).length > 12 ? ', …' : ''} }`;
      }
      return typeof value;
    };

    const pretty = JSON.stringify(parsed, null, 2);
    const summary = `JSON document: ${fileName}\nTop-level shape: ${describe(parsed)}\n\n${pretty.length > 150_000 ? pretty.slice(0, 150_000) + '\n… [truncated]' : pretty}`;
    return {
      text: summary,
      format: 'json',
      complete: pretty.length <= 150_000,
      meta: { characters: pretty.length },
    };
  } catch (error) {
    return {
      text,
      format: 'json',
      complete: false,
      note: `File has a .json extension but is not valid JSON (${(error as Error).message}). Stored as plain text.`,
    };
  }
}

/* ------------------------------------------------------------------ */
/* Binary salvage                                                      */
/* ------------------------------------------------------------------ */

/** Pull readable ASCII runs out of an unknown binary, like `strings(1)`. */
export function salvagePrintable(buffer: Buffer, minimumRun = 6): string {
  const out: string[] = [];
  let run = '';
  for (const byte of buffer) {
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126)) {
      run += String.fromCharCode(byte);
    } else {
      if (run.length >= minimumRun) out.push(run);
      run = '';
    }
  }
  if (run.length >= minimumRun) out.push(run);
  return out.join('\n');
}

/* ------------------------------------------------------------------ */
/* Dispatcher                                                          */
/* ------------------------------------------------------------------ */

function sniffFormat(buffer: Buffer, fileName: string): string {
  const extension = extensionOf(fileName);
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    // Zip container — the extension decides which OOXML dialect it is.
    if (extension === 'docx') return 'docx';
    if (extension === 'xlsx' || extension === 'xlsm') return 'xlsx';
    if (extension === 'pptx') return 'pptx';
    return 'zip';
  }
  if (buffer.length >= 8 && buffer.subarray(0, 4).toString('hex') === '89504e47') return 'image';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8) return 'image';
  if (extension === 'doc' || extension === 'xls' || extension === 'ppt') return 'legacy-office';
  return extension;
}

export interface ExtractFileInput {
  fileName: string;
  buffer: Buffer;
  mimeType?: string;
}

export async function extractFile(input: ExtractFileInput): Promise<ExtractionResult> {
  const { fileName, buffer } = input;
  const format = sniffFormat(buffer, fileName);
  const extension = extensionOf(fileName);

  switch (format) {
    case 'pdf':
      return extractPdf(buffer);
    case 'docx':
      return extractDocx(buffer);
    case 'xlsx':
      return extractXlsx(buffer);
    case 'pptx':
      return extractPptx(buffer);
    case 'image':
      return {
        text: `[Image file: ${fileName}, ${buffer.length.toLocaleString()} bytes]\nNo text was extracted. This terminal does not run OCR or vision models, so the contents of this image are not available to ANGEL. Describe what it shows if you want it discussed.`,
        format: 'image',
        complete: false,
        note: 'Images are catalogued but not read. ANGEL will not pretend to know what is in them.',
        meta: { bytes: buffer.length },
      };
    case 'legacy-office':
      return {
        text: salvagePrintable(buffer).slice(0, 100_000),
        format: 'legacy-office',
        complete: false,
        note: `Legacy binary Office format (.${extension}). Only loose text fragments could be recovered — re-save as .docx/.xlsx or export to PDF for a clean import.`,
      };
    default:
      break;
  }

  if (isTextExtension(fileName) || (input.mimeType ?? '').startsWith('text/')) {
    const { text, encoding } = decodeText(buffer);
    if (extension === 'csv' || extension === 'tsv') return extractCsv(text, fileName);
    if (extension === 'json') return extractJson(text, fileName);
    return {
      text,
      format: extension || 'text',
      complete: true,
      meta: { encoding, characters: text.length, lines: text.split('\n').length },
    };
  }

  // Unknown binary: salvage what is readable and be explicit that it is partial.
  const salvaged = salvagePrintable(buffer);
  const ratio = salvaged.length / Math.max(buffer.length, 1);
  if (salvaged.length > 200 && ratio > 0.2) {
    return {
      text: salvaged.slice(0, 120_000),
      format: extension || 'binary',
      complete: false,
      note: `Unrecognised format (.${extension}). Recovered ${salvaged.length.toLocaleString()} characters of readable text; structure and formatting are lost.`,
    };
  }

  return {
    text: `[Binary file: ${fileName}, ${buffer.length.toLocaleString()} bytes, type .${extension}]\nNo readable text could be extracted from this format.`,
    format: extension || 'binary',
    complete: false,
    note: `No text extractor exists for .${extension}. The file is catalogued by name only — ANGEL cannot read its contents.`,
    meta: { bytes: buffer.length },
  };
}

/* ------------------------------------------------------------------ */
/* Archives                                                            */
/* ------------------------------------------------------------------ */

export interface ArchiveEntryResult extends ExtractionResult {
  path: string;
  fileName: string;
  bytes: number;
}

const SKIP_IN_ARCHIVE = /(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db|node_modules|\.git)(\/|$)/;

export async function extractArchive(
  buffer: Buffer,
  options: { maxEntries?: number; maxTotalCharacters?: number } = {},
): Promise<{ entries: ArchiveEntryResult[]; skipped: number; note?: string }> {
  const { maxEntries = 300, maxTotalCharacters = 20_000_000 } = options;
  const zip = await JSZip.loadAsync(buffer);
  const entries: ArchiveEntryResult[] = [];
  let skipped = 0;
  let totalCharacters = 0;

  const names = Object.keys(zip.files).sort();
  for (const name of names) {
    const entry = zip.files[name];
    if (entry.dir || SKIP_IN_ARCHIVE.test(name)) continue;
    if (entries.length >= maxEntries || totalCharacters >= maxTotalCharacters) {
      skipped++;
      continue;
    }

    const baseName = name.split('/').pop() ?? name;
    try {
      const content = await entry.async('nodebuffer');
      // Nested archives are listed rather than recursed — unbounded recursion
      // on a zip bomb is a real denial-of-service vector.
      if (baseName.toLowerCase().endsWith('.zip')) {
        entries.push({
          path: name,
          fileName: baseName,
          bytes: content.length,
          text: `[Nested archive: ${baseName}, ${content.length.toLocaleString()} bytes]\nUpload it separately to index its contents.`,
          format: 'zip',
          complete: false,
          note: 'Nested archives are not unpacked automatically.',
        });
        continue;
      }

      const result = await extractFile({ fileName: baseName, buffer: content });
      totalCharacters += result.text.length;
      entries.push({ ...result, path: name, fileName: baseName, bytes: content.length });
    } catch (error) {
      skipped++;
      entries.push({
        path: name,
        fileName: baseName,
        bytes: 0,
        text: '',
        format: 'error',
        complete: false,
        note: `Could not read this entry: ${(error as Error).message}`,
      });
    }
  }

  return {
    entries,
    skipped,
    note: skipped > 0 ? `${skipped} entr${skipped === 1 ? 'y was' : 'ies were'} skipped (limit of ${maxEntries} files or ${(maxTotalCharacters / 1_000_000).toFixed(0)}M characters reached).` : undefined,
  };
}
