/**
 * localStorage access that fails loudly enough to be noticed.
 *
 * The app previously wrapped every localStorage call in a try block with an
 * empty handler.
 * That is fine for a read of corrupt JSON, but it is not fine for a write:
 * when the quota is exhausted (easy to do here — memory documents, alerts and
 * projects all live in localStorage) every subsequent save silently fails and
 * the user loses work without ever being told.
 *
 * These helpers keep the call sites short, but record what went wrong so the
 * UI and the diagnostics endpoint can surface it.
 */

export interface StorageFailure {
  key: string;
  operation: 'read' | 'write' | 'remove';
  message: string;
  /** True when the browser reported a quota/space problem. */
  quotaExceeded: boolean;
  at: number;
}

let lastFailure: StorageFailure | null = null;
const listeners = new Set<(failure: StorageFailure) => void>();

/** The most recent storage failure, or null if everything has worked. */
export function getLastStorageFailure(): StorageFailure | null {
  return lastFailure;
}

/** Subscribe to storage failures (e.g. to show a "storage full" banner). */
export function onStorageFailure(listener: (failure: StorageFailure) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  // Browsers disagree on the name; check all the spellings in the wild.
  const name = (error as DOMException).name ?? '';
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    /quota|storage is full|exceeded/i.test(error.message)
  );
}

function report(key: string, operation: StorageFailure['operation'], error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const failure: StorageFailure = {
    key,
    operation,
    message,
    quotaExceeded: isQuotaError(error),
    at: Date.now(),
  };
  lastFailure = failure;

  // One console line per failure, with the detail needed to act on it.
  if (failure.quotaExceeded) {
    console.error(
      `[storage] Browser storage is full — "${key}" was not saved. ` +
        'Delete some documents in the Documents tab, or export and clear them. ' +
        'Documents uploaded to the server are unaffected.',
    );
  } else {
    console.warn(`[storage] ${operation} of "${key}" failed: ${message}`);
  }

  for (const listener of listeners) {
    try {
      listener(failure);
    } catch {
      // A broken listener must not break storage.
    }
  }
}

function storage(): Storage | null {
  try {
    // Accessing localStorage throws in some privacy modes.
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** Read a raw string. Returns null when absent or unreadable. */
export function readString(key: string): string | null {
  const store = storage();
  if (!store) return null;
  try {
    return store.getItem(key);
  } catch (error) {
    report(key, 'read', error);
    return null;
  }
}

/** Write a raw string. Returns false when the write did not happen. */
export function writeString(key: string, value: string): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.setItem(key, value);
    return true;
  } catch (error) {
    report(key, 'write', error);
    return false;
  }
}

/** Remove a key. Returns false when the removal did not happen. */
export function removeKey(key: string): boolean {
  const store = storage();
  if (!store) return false;
  try {
    store.removeItem(key);
    return true;
  } catch (error) {
    report(key, 'remove', error);
    return false;
  }
}

/**
 * Read and parse JSON. Corrupt data is treated as absent (and logged once),
 * because throwing here would take the whole app down on load.
 */
export function readJson<T>(key: string, fallback: T, validate?: (value: unknown) => boolean): T {
  const raw = readString(key);
  if (raw === null || raw === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (validate && !validate(parsed)) {
      console.warn(`[storage] "${key}" held unexpected data; using the default instead.`);
      return fallback;
    }
    return parsed as T;
  } catch (error) {
    console.warn(`[storage] "${key}" held invalid JSON; using the default instead.`, error);
    return fallback;
  }
}

/** Serialise and write JSON. Returns false when the write did not happen. */
export function writeJson(key: string, value: unknown): boolean {
  try {
    return writeString(key, JSON.stringify(value));
  } catch (error) {
    // Circular structures and BigInt both land here.
    report(key, 'write', error);
    return false;
  }
}
