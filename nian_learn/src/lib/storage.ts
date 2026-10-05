import type { CipherFile, MetaFile } from "../types";

const META_KEY = "nian-learn.meta.v1";
const VAULT_KEY = "nian-learn.vault.v1";
const PACK_KEY = "nian-learn.pack-cache.v1";
const IDB_NAME = "nian-learn";
const IDB_STORE = "secrets";
const DEK_ID = "dek";

function canStore(): boolean {
  return typeof localStorage !== "undefined";
}

export function readMeta(): MetaFile | null {
  if (!canStore()) return null;
  const raw = localStorage.getItem(META_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as MetaFile;
    if (parsed?.version !== 1 || !parsed.wrappedDek || !parsed.salt) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMeta(meta: MetaFile): void {
  localStorage.setItem(META_KEY, JSON.stringify(meta));
}

export function readVaultFile(): CipherFile | null {
  if (!canStore()) return null;
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CipherFile;
    if (!parsed?.iv || !parsed?.ciphertext) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeVaultFile(file: CipherFile): void {
  localStorage.setItem(VAULT_KEY, JSON.stringify(file));
}

export function readPackCache<T>(): T | null {
  if (!canStore()) return null;
  const raw = localStorage.getItem(PACK_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writePackCache(value: unknown): void {
  try {
    localStorage.setItem(PACK_KEY, JSON.stringify(value));
  } catch {
    /* 内容包缓存失败时仍可使用内置包 */
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function readDek(): Promise<CryptoKey | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(DEK_ID);
      req.onsuccess = () => resolve((req.result as CryptoKey | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function writeDek(key: CryptoKey): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(key, DEK_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
