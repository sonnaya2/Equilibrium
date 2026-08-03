import { SOLVER_SCHEMA_VERSION, type SerializableSolverRequest } from "./serializable";
import type { SolverProgress } from "./protocol";

const DB_NAME = "eq-revolution-solver";
const DB_VERSION = 1;
const STORE = "checkpoints";

export interface SolverCheckpoint {
  schemaVersion: number;
  savedAt: number;
  /** Stable key chosen by the host (e.g. profileId + seed). */
  key: string;
  request: SerializableSolverRequest;
  /** Opaque search state - only the solver module interprets this. */
  state: unknown;
  progress?: SolverProgress;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) {
          request.result.createObjectStore(STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function isCheckpoint(raw: unknown): raw is SolverCheckpoint {
  if (raw === null || typeof raw !== "object") return false;
  const c = raw as SolverCheckpoint;
  return (
    typeof c.schemaVersion === "number" &&
    typeof c.savedAt === "number" &&
    typeof c.key === "string" &&
    c.request !== undefined &&
    "state" in c
  );
}

/** Persist a checkpoint. No-ops when IndexedDB is unavailable. */
export async function saveCheckpoint(checkpoint: SolverCheckpoint): Promise<boolean> {
  if (checkpoint.schemaVersion !== SOLVER_SCHEMA_VERSION) return false;
  try {
    const db = await openDb();
    if (!db) return false;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(checkpoint);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Load a checkpoint by key. Rejects stale schema versions (returns null) so a
 * code bump never resumes against an incompatible payload.
 */
export async function loadCheckpoint(key: string): Promise<SolverCheckpoint | null> {
  try {
    const db = await openDb();
    if (!db) return null;
    const raw = await new Promise<unknown>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (!isCheckpoint(raw)) return null;
    if (raw.schemaVersion !== SOLVER_SCHEMA_VERSION) return null;
    if (raw.request.schemaVersion !== SOLVER_SCHEMA_VERSION) return null;
    return raw;
  } catch {
    return null;
  }
}

export async function deleteCheckpoint(key: string): Promise<void> {
  try {
    const db = await openDb();
    if (!db) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch {
    // optional store
  }
}
