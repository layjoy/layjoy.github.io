import { asBuffer, b64ToBytes, bytesToB64 } from "./b64";

const DB_NAME = "niannian";
const DB_VERSION = 1;

let database: IDBDatabase | null = null;
let opening: Promise<IDBDatabase> | null = null;
let keyPromise: Promise<CryptoKey> | null = null;
let memoryOnly = false;
const memory = new Map<string, unknown>();

export function isMemoryOnly(): boolean {
  return memoryOnly;
}

function reqToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openDb(): Promise<IDBDatabase> {
  if (database) return database;
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    const timer = window.setTimeout(() => reject(new Error("timeout")), 2500);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
      if (!db.objectStoreNames.contains("keys")) db.createObjectStore("keys");
    };
    request.onsuccess = () => {
      window.clearTimeout(timer);
      database = request.result;
      database.onversionchange = () => database?.close();
      resolve(database);
    };
    request.onerror = () => {
      window.clearTimeout(timer);
      reject(request.error);
    };
  });
  try {
    return await opening;
  } catch (error) {
    opening = null;
    throw error;
  }
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  const tx = db.transaction(store, "readonly");
  return reqToPromise(tx.objectStore(store).get(key) as IDBRequest<T | undefined>);
}

async function idbSet(store: string, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value, key);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deviceKey(): Promise<CryptoKey> {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const existing = await idbGet<CryptoKey>("keys", "device");
    if (existing) return existing;
    const created = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await idbSet("keys", "device", created);
    return created;
  })();
  try {
    return await keyPromise;
  } catch (error) {
    keyPromise = null;
    throw error;
  }
}

function useMemory(): void {
  memoryOnly = true;
}

export async function loadJson<T>(key: string): Promise<T | null> {
  if (memoryOnly || !globalThis.crypto?.subtle) {
    useMemory();
    return (memory.get(key) as T) ?? null;
  }
  try {
    const row = await idbGet<{ iv: string; data: string }>("kv", key);
    if (!row) return null;
    const cryptoKey = await deviceKey();
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asBuffer(b64ToBytes(row.iv)) },
      cryptoKey,
      asBuffer(b64ToBytes(row.data)),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    return null;
  }
}

export async function saveJson(key: string, value: unknown): Promise<void> {
  if (memoryOnly || !globalThis.crypto?.subtle) {
    useMemory();
    memory.set(key, value);
    return;
  }
  try {
    const cryptoKey = await deviceKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: asBuffer(iv) },
      cryptoKey,
      new TextEncoder().encode(JSON.stringify(value)),
    );
    await idbSet("kv", key, { iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(cipher)) });
  } catch {
    useMemory();
    memory.set(key, value);
  }
}

export async function wipeAll(): Promise<void> {
  memory.clear();
  memoryOnly = false;
  keyPromise = null;
  opening = null;
  if (database) {
    database.close();
    database = null;
  }
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
