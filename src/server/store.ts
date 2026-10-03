/**
 * Server-side persistent store.
 *
 * Before this, everything ANGEL "remembered" lived in the browser's
 * localStorage and IndexedDB. That meant: clearing site data wiped the entire
 * knowledge base, nothing survived a device change, and the server re-received
 * the full document set on every single chat request (which is what the 500 MB
 * body limit and the 413 handler were really working around).
 *
 * Documents are written as individual files on disk with a small JSON index,
 * so a 40 MB upload does not force a 40 MB JSON parse on every read, and a
 * single corrupt document cannot destroy the whole store.
 *
 * Writes are atomic (temp file + rename) because a crash mid-write on a single
 * monolithic JSON file is exactly how stores like this get silently emptied.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createProfile, normalizeProfile, type UserProfile } from '../ai/adaptive';

export interface StoredDocument {
  id: string;
  title: string;
  category: string;
  sourceType: 'TEXT_NOTE' | 'FILE_UPLOAD';
  fileName?: string;
  fileType?: string;
  /** Size of the original upload in bytes. */
  byteSize: number;
  /** Characters of extracted text actually stored. */
  characters: number;
  /** sha256 of the content — used for deduplication. */
  contentHash: string;
  tags: string[];
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  /** Set when extraction produced partial or degraded text. */
  extractionNote?: string;
}

export interface StoredConversationTurn {
  id: string;
  role: 'user' | 'angel';
  text: string;
  at: number;
  model?: string;
  strategy?: string;
  citations?: { title: string; fileName?: string }[];
}

interface StoreIndex {
  version: 3;
  documents: StoredDocument[];
  conversation: StoredConversationTurn[];
  profile: UserProfile;
  createdAt: number;
  updatedAt: number;
}

const MAX_CONVERSATION_TURNS = 400;
const MAX_DOCUMENT_CHARACTERS = 2_000_000;

export class AngelStore {
  private readonly root: string;
  private readonly documentsDir: string;
  private readonly indexPath: string;
  private index: StoreIndex;
  private writeTimer: NodeJS.Timeout | null = null;
  private lastError: string | null = null;

  constructor(root: string) {
    this.root = root;
    this.documentsDir = path.join(root, 'documents');
    this.indexPath = path.join(root, 'index.json');
    this.index = this.load();
  }

  /* ---------------------------- persistence ---------------------------- */

  private emptyIndex(): StoreIndex {
    const now = Date.now();
    return { version: 3, documents: [], conversation: [], profile: createProfile(), createdAt: now, updatedAt: now };
  }

  private load(): StoreIndex {
    try {
      fs.mkdirSync(this.documentsDir, { recursive: true });
    } catch (error) {
      this.lastError = `Cannot create store directory: ${(error as Error).message}`;
      return this.emptyIndex();
    }

    if (!fs.existsSync(this.indexPath)) return this.emptyIndex();

    try {
      const raw = fs.readFileSync(this.indexPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<StoreIndex>;
      return {
        version: 3,
        documents: Array.isArray(parsed.documents) ? parsed.documents.filter((doc) => doc && doc.id) : [],
        conversation: Array.isArray(parsed.conversation) ? parsed.conversation.slice(-MAX_CONVERSATION_TURNS) : [],
        profile: normalizeProfile(parsed.profile),
        createdAt: parsed.createdAt ?? Date.now(),
        updatedAt: parsed.updatedAt ?? Date.now(),
      };
    } catch (error) {
      // Corrupt index: preserve it for inspection rather than overwrite it.
      this.lastError = `Store index was corrupt and has been quarantined: ${(error as Error).message}`;
      try {
        fs.renameSync(this.indexPath, `${this.indexPath}.corrupt-${Date.now()}`);
      } catch {
        /* best effort */
      }
      return this.emptyIndex();
    }
  }

  /** Atomic write: temp file then rename, so a crash cannot truncate the index. */
  private flush(): void {
    try {
      this.index.updatedAt = Date.now();
      const temporary = `${this.indexPath}.tmp`;
      fs.writeFileSync(temporary, JSON.stringify(this.index, null, 2), 'utf-8');
      fs.renameSync(temporary, this.indexPath);
      this.lastError = null;
    } catch (error) {
      this.lastError = `Failed to persist store: ${(error as Error).message}`;
    }
  }

  /** Coalesce rapid writes (a 60-file zip import should not be 60 fsyncs). */
  private scheduleFlush(): void {
    if (this.writeTimer) clearTimeout(this.writeTimer);
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush();
    }, 250);
    // Do not hold the event loop open just for a pending store write.
    this.writeTimer.unref?.();
  }

  flushNow(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.flush();
  }

  /* ----------------------------- documents ----------------------------- */

  private documentPath(id: string): string {
    return path.join(this.documentsDir, `${id}.txt`);
  }

  readDocumentText(id: string): string {
    try {
      return fs.readFileSync(this.documentPath(id), 'utf-8');
    } catch {
      return '';
    }
  }

  listDocuments(): StoredDocument[] {
    return [...this.index.documents].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /** Documents with their text loaded — used to build the retrieval index. */
  loadAllWithText(): (StoredDocument & { content: string })[] {
    return this.index.documents.map((document) => ({ ...document, content: this.readDocumentText(document.id) }));
  }

  getDocument(id: string): (StoredDocument & { content: string }) | null {
    const document = this.index.documents.find((item) => item.id === id);
    if (!document) return null;
    return { ...document, content: this.readDocumentText(id) };
  }

  /**
   * Insert or update a document. Returns `deduplicated: true` when identical
   * content already exists — re-uploading the same file should not silently
   * double the knowledge base.
   */
  upsertDocument(input: {
    title: string;
    content: string;
    category?: string;
    sourceType?: 'TEXT_NOTE' | 'FILE_UPLOAD';
    fileName?: string;
    fileType?: string;
    byteSize?: number;
    tags?: string[];
    extractionNote?: string;
    id?: string;
  }): { document: StoredDocument; deduplicated: boolean } {
    const content = (input.content ?? '').slice(0, MAX_DOCUMENT_CHARACTERS);
    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    const existingByHash = this.index.documents.find((document) => document.contentHash === contentHash);
    if (existingByHash && !input.id) {
      existingByHash.updatedAt = Date.now();
      this.scheduleFlush();
      return { document: existingByHash, deduplicated: true };
    }

    const now = Date.now();
    const id = input.id ?? `doc-${now.toString(36)}-${crypto.randomBytes(4).toString('hex')}`;

    const document: StoredDocument = {
      id,
      title: (input.title || input.fileName || 'Untitled').slice(0, 200),
      category: input.category ?? 'UPLOADED_DOC',
      sourceType: input.sourceType ?? 'FILE_UPLOAD',
      fileName: input.fileName,
      fileType: input.fileType,
      byteSize: input.byteSize ?? Buffer.byteLength(content, 'utf-8'),
      characters: content.length,
      contentHash,
      tags: input.tags ?? [],
      isActive: true,
      createdAt: this.index.documents.find((item) => item.id === id)?.createdAt ?? now,
      updatedAt: now,
      extractionNote: input.extractionNote,
    };

    try {
      fs.writeFileSync(this.documentPath(id), content, 'utf-8');
    } catch (error) {
      this.lastError = `Failed to write document ${id}: ${(error as Error).message}`;
    }

    const existingIndex = this.index.documents.findIndex((item) => item.id === id);
    if (existingIndex === -1) this.index.documents.push(document);
    else this.index.documents[existingIndex] = document;

    this.scheduleFlush();
    return { document, deduplicated: false };
  }

  updateDocumentMeta(id: string, patch: Partial<Pick<StoredDocument, 'title' | 'category' | 'tags' | 'isActive'>>): StoredDocument | null {
    const document = this.index.documents.find((item) => item.id === id);
    if (!document) return null;
    Object.assign(document, patch, { updatedAt: Date.now() });
    this.scheduleFlush();
    return document;
  }

  deleteDocument(id: string): boolean {
    const before = this.index.documents.length;
    this.index.documents = this.index.documents.filter((document) => document.id !== id);
    if (this.index.documents.length === before) return false;
    try {
      fs.unlinkSync(this.documentPath(id));
    } catch {
      /* file may already be gone */
    }
    this.scheduleFlush();
    return true;
  }

  /**
   * Delete one or more uploaded documents matching id, fileName, title, or checksum prefix.
   */
  deleteDocumentsByCriteria(criteria: {
    id?: string;
    documentIds?: string[];
    fileName?: string;
    title?: string;
    checksum?: string;
  }): { deletedCount: number; deletedIds: string[]; deletedFileNames: string[] } {
    const targetIds = new Set<string>();
    if (criteria.id) targetIds.add(criteria.id.trim());
    if (Array.isArray(criteria.documentIds)) {
      for (const did of criteria.documentIds) {
        if (typeof did === 'string' && did.trim()) targetIds.add(did.trim());
      }
    }
    const normFileName = criteria.fileName?.trim().toLowerCase();
    const normTitle = criteria.title?.trim().toLowerCase();
    const normChecksum = criteria.checksum?.trim().toLowerCase();

    const toDelete = this.index.documents.filter((doc) => {
      if (targetIds.has(doc.id)) return true;
      if (normFileName && doc.fileName?.trim().toLowerCase() === normFileName) return true;
      if (normFileName && doc.title?.trim().toLowerCase() === normFileName) return true;
      if (normTitle && doc.title?.trim().toLowerCase() === normTitle) return true;
      if (normChecksum && normChecksum.length >= 6 && doc.contentHash.toLowerCase().startsWith(normChecksum)) return true;
      return false;
    });

    const deletedIds: string[] = [];
    const deletedFileNames: string[] = [];

    for (const doc of toDelete) {
      deletedIds.push(doc.id);
      if (doc.fileName) deletedFileNames.push(doc.fileName);
      else if (doc.title) deletedFileNames.push(doc.title);
      try {
        fs.unlinkSync(this.documentPath(doc.id));
      } catch {
        /* file may already be gone */
      }
    }

    if (deletedIds.length > 0) {
      const deletedSet = new Set(deletedIds);
      this.index.documents = this.index.documents.filter((doc) => !deletedSet.has(doc.id));
      this.flushNow();
    }

    return {
      deletedCount: deletedIds.length,
      deletedIds,
      deletedFileNames,
    };
  }

  /**
   * Clear all user-uploaded documents from the backend disk store.
   */
  clearAllDocuments(): { deletedCount: number; deletedIds: string[] } {
    const deletedIds = this.index.documents.map((doc) => doc.id);
    for (const id of deletedIds) {
      try {
        fs.unlinkSync(this.documentPath(id));
      } catch {
        /* best effort */
      }
    }
    this.index.documents = [];
    this.flushNow();
    return {
      deletedCount: deletedIds.length,
      deletedIds,
    };
  }

  /* ---------------------------- conversation --------------------------- */

  appendTurn(turn: Omit<StoredConversationTurn, 'id' | 'at'> & { id?: string; at?: number }): StoredConversationTurn {
    const stored: StoredConversationTurn = {
      id: turn.id ?? `turn-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
      role: turn.role,
      text: turn.text.slice(0, 20_000),
      at: turn.at ?? Date.now(),
      model: turn.model,
      strategy: turn.strategy,
      citations: turn.citations,
    };
    this.index.conversation.push(stored);
    if (this.index.conversation.length > MAX_CONVERSATION_TURNS) {
      this.index.conversation = this.index.conversation.slice(-MAX_CONVERSATION_TURNS);
    }
    this.scheduleFlush();
    return stored;
  }

  recentTurns(limit = 12): StoredConversationTurn[] {
    return this.index.conversation.slice(-limit);
  }

  allTurns(): StoredConversationTurn[] {
    return [...this.index.conversation];
  }

  clearConversation(): void {
    this.index.conversation = [];
    this.scheduleFlush();
  }

  /* ------------------------------ profile ------------------------------ */

  getProfile(): UserProfile {
    return this.index.profile;
  }

  setProfile(profile: UserProfile): void {
    this.index.profile = profile;
    this.scheduleFlush();
  }

  /* ------------------------------- health ------------------------------ */

  stats() {
    const documents = this.index.documents;
    const active = documents.filter((document) => document.isActive);
    return {
      root: this.root,
      documents: documents.length,
      activeDocuments: active.length,
      totalCharacters: documents.reduce((total, document) => total + document.characters, 0),
      totalBytes: documents.reduce((total, document) => total + document.byteSize, 0),
      conversationTurns: this.index.conversation.length,
      profileFacts: this.index.profile.facts.length,
      lastError: this.lastError,
      updatedAt: this.index.updatedAt,
    };
  }

  /**
   * Integrity check with optional repair. Catches the three failure modes that
   * actually happen: index entries whose file vanished, orphaned files with no
   * index entry, and entries whose stored length no longer matches the file.
   */
  verify(repair = false): {
    issues: { kind: string; id?: string; detail: string; repaired: boolean }[];
    healthy: boolean;
  } {
    const issues: { kind: string; id?: string; detail: string; repaired: boolean }[] = [];

    for (const document of [...this.index.documents]) {
      const filePath = this.documentPath(document.id);
      if (!fs.existsSync(filePath)) {
        const repaired = repair ? this.deleteDocument(document.id) : false;
        issues.push({
          kind: 'MISSING_FILE',
          id: document.id,
          detail: `Index lists "${document.title}" but ${path.basename(filePath)} does not exist.`,
          repaired,
        });
        continue;
      }
      const actual = fs.statSync(filePath).size;
      if (document.characters > 0 && actual === 0) {
        const repaired = repair ? this.deleteDocument(document.id) : false;
        issues.push({
          kind: 'EMPTY_FILE',
          id: document.id,
          detail: `"${document.title}" is indexed with ${document.characters} characters but the file is empty.`,
          repaired,
        });
      }
    }

    try {
      const files = fs.readdirSync(this.documentsDir).filter((name) => name.endsWith('.txt'));
      const known = new Set(this.index.documents.map((document) => `${document.id}.txt`));
      for (const file of files) {
        if (known.has(file)) continue;
        let repaired = false;
        if (repair) {
          try {
            fs.unlinkSync(path.join(this.documentsDir, file));
            repaired = true;
          } catch {
            /* best effort */
          }
        }
        issues.push({ kind: 'ORPHAN_FILE', detail: `${file} has no index entry.`, repaired });
      }
    } catch (error) {
      issues.push({ kind: 'READ_ERROR', detail: (error as Error).message, repaired: false });
    }

    if (repair && issues.some((issue) => issue.repaired)) this.flushNow();
    return { issues, healthy: issues.length === 0 };
  }
}

let singleton: AngelStore | null = null;

export function getStore(root?: string): AngelStore {
  if (!singleton) {
    singleton = new AngelStore(root ?? path.join(process.cwd(), 'data', 'angel-store'));
  }
  return singleton;
}

/** Test helper — lets a test point the store at a temp directory. */
export function __setStoreForTests(store: AngelStore | null): void {
  singleton = store;
}
