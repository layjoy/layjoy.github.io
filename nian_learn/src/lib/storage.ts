import type { CipherFile, MetaFile } from "../types";

const META_KEY = "nian-learn.meta.v1";
const VAULT_KEY = "nian-learn.vault.v1";
const PACK_KEY = "nian-learn.pack-cache.v1";
const IDB_NAME = "nian-learn";
const IDB_STORE = "secrets";
const DEK_ID = "dek";
const DB_VERSION = 2;

export interface CachedRecord {
  id: string;
  kind: string;
  ciphertext: string;
  iv: string;
  updatedAt: number;
}

export type OutboxItem =
  | { id: string; type: "record"; envelope: CachedRecord }
  | { id: "family"; type: "family"; tokenHash: string };

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
    const req = indexedDB.open(IDB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      if (!db.objectStoreNames.contains("outbox")) db.createObjectStore("outbox", { keyPath: "id" });
      if (!db.objectStoreNames.contains("cache")) db.createObjectStore("cache", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(db: IDBDatabase, tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function readDek(): Promise<CryptoKey | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(DEK_ID);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as CryptoKey | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function writeDek(key: CryptoKey): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(IDB_STORE, "readwrite");
  tx.objectStore(IDB_STORE).put(key, DEK_ID);
  await txDone(db, tx);
}

export function clearLegacyVault(): void {
  if (!canStore()) return;
  localStorage.removeItem(META_KEY);
  localStorage.removeItem(VAULT_KEY);
}

export async function readSession(): Promise<{ aesKey: CryptoKey; authToken: string; familyId: string } | null> {
  const aesKey = await readDek();
  const authToken = await readSecret<string>("authToken");
  const familyId = await readSecret<string>("familyId");
  if (!aesKey || !authToken || !familyId) return null;
  return { aesKey, authToken, familyId };
}

export async function writeSession(session: { aesKey: CryptoKey; authToken: string; familyId: string }): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(IDB_STORE, "readwrite");
  const store = tx.objectStore(IDB_STORE);
  store.put(session.aesKey, DEK_ID);
  store.put(session.authToken, "authToken");
  store.put(session.familyId, "familyId");
  await txDone(db, tx);
}

async function readSecret<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => {
        db.close();
        resolve((req.result as T | undefined) ?? null);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function putOutbox(item: OutboxItem): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("outbox", "readwrite");
  tx.objectStore("outbox").put(item);
  await txDone(db, tx);
}

export async function deleteOutbox(id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("outbox", "readwrite");
  tx.objectStore("outbox").delete(id);
  await txDone(db, tx);
}

export async function readOutbox<T = OutboxItem>(): Promise<T[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("outbox", "readonly");
    const req = tx.objectStore("outbox").getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as T[]) ?? []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function putCache(item: CachedRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("cache", "readwrite");
  tx.objectStore("cache").put(item);
  await txDone(db, tx);
}

export async function readCache(): Promise<CachedRecord[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cache", "readonly");
    const req = tx.objectStore("cache").getAll();
    req.onsuccess = () => {
      db.close();
      resolve((req.result as CachedRecord[]) ?? []);
    };
    req.onerror = () => {
      db.close();
      reject(req.error);
    };
  });
}

export async function replaceCache(items: CachedRecord[]): Promise<void> {
  const db = await openDb();
  const tx = db.transaction("cache", "readwrite");
  const store = tx.objectStore("cache");
  store.clear();
  for (const item of items) store.put(item);
  await txDone(db, tx);
}
