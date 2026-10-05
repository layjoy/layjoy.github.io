import type { CipherFile, MetaFile, RulePackageFile, RulePayload } from "../types";

export const KDF_ITERATIONS = 120_000;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function passphraseError(passphrase: string): string | null {
  if (passphrase.trim().length === 0) return "请输入口令";
  if ([...passphrase].length < 4) return "口令至少 4 个字符";
  if ([...passphrase].length > 64) return "口令太长了";
  return null;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveAesKey(
  passphrase: string,
  salt: Uint8Array,
  usages: KeyUsage[],
  iterations = KDF_ITERATIONS,
): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", textEncoder.encode(passphrase), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    usages,
  );
}

export async function createAccount(passphrase: string): Promise<{ meta: MetaFile; dek: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const kek = await deriveAesKey(passphrase, salt, ["wrapKey"]);
  const dek = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const wrapped = await crypto.subtle.wrapKey("raw", dek, kek, { name: "AES-GCM", iv: wrapIv });
  const localDek = await crypto.subtle.importKey(
    "raw",
    await crypto.subtle.exportKey("raw", dek),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  return {
    dek: localDek,
    meta: {
      version: 1,
      iterations: KDF_ITERATIONS,
      salt: bytesToB64(salt),
      wrapIv: bytesToB64(wrapIv),
      wrappedDek: bytesToB64(new Uint8Array(wrapped)),
    },
  };
}

export async function unlockAccount(
  passphrase: string,
  meta: MetaFile,
  extractable = false,
): Promise<CryptoKey | null> {
  try {
    const kek = await deriveAesKey(passphrase, b64ToBytes(meta.salt), ["unwrapKey"], meta.iterations);
    return await crypto.subtle.unwrapKey(
      "raw",
      b64ToBytes(meta.wrappedDek) as BufferSource,
      kek,
      { name: "AES-GCM", iv: b64ToBytes(meta.wrapIv) as BufferSource },
      { name: "AES-GCM", length: 256 },
      extractable,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}

export async function rewrapAccount(passphrase: string, nextPassphrase: string, meta: MetaFile): Promise<MetaFile | null> {
  const current = await unlockAccount(passphrase, meta, true);
  if (!current) return null;
  const raw = await crypto.subtle.exportKey("raw", current);
  const extractable = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));
  const kek = await deriveAesKey(nextPassphrase, salt, ["wrapKey"]);
  const wrapped = await crypto.subtle.wrapKey("raw", extractable, kek, { name: "AES-GCM", iv: wrapIv });
  return {
    version: 1,
    iterations: KDF_ITERATIONS,
    salt: bytesToB64(salt),
    wrapIv: bytesToB64(wrapIv),
    wrappedDek: bytesToB64(new Uint8Array(wrapped)),
  };
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<CipherFile> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(JSON.stringify(value)),
  );
  return { iv: bytesToB64(iv), ciphertext: bytesToB64(new Uint8Array(cipher)) };
}

export async function decryptJson<T>(key: CryptoKey, file: CipherFile): Promise<T> {
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64ToBytes(file.iv) as BufferSource },
    key,
    b64ToBytes(file.ciphertext) as BufferSource,
  );
  return JSON.parse(textDecoder.decode(plain)) as T;
}

export async function sealRules(passphrase: string, payload: RulePayload): Promise<RulePackageFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt, ["encrypt"]);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(JSON.stringify(payload)),
  );
  return {
    format: "nian-learn-rules",
    version: 1,
    kdf: { name: "PBKDF2", hash: "SHA-256", iterations: KDF_ITERATIONS, salt: bytesToB64(salt) },
    cipher: "AES-GCM",
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(cipher)),
  };
}

export async function openRules(passphrase: string, file: unknown): Promise<RulePayload> {
  if (!file || typeof file !== "object") throw new Error("这个文件不是规则包");
  const pkg = file as Partial<RulePackageFile>;
  if (pkg.format !== "nian-learn-rules" || pkg.version !== 1 || !pkg.kdf || !pkg.iv || !pkg.ciphertext) {
    throw new Error("这个文件不是规则包");
  }
  try {
    const key = await deriveAesKey(
      passphrase,
      b64ToBytes(pkg.kdf.salt ?? ""),
      ["decrypt"],
      pkg.kdf.iterations,
    );
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(pkg.iv) as BufferSource },
      key,
      b64ToBytes(pkg.ciphertext) as BufferSource,
    );
    return JSON.parse(textDecoder.decode(plain)) as RulePayload;
  } catch {
    throw new Error("口令不对，或文件已损坏");
  }
}
