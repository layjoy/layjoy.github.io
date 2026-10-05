import type { Rules } from "../types";
import { asBuffer, b64ToBytes, b64UrlToBytes, bytesToB64, bytesToB64Url } from "../storage/b64";
import { normalizeRules } from "./model";

const ITERATIONS = 60_000;
const PREFIX = "NIANPACK1.";

export type PinRecord = { salt: string; hash: string; iterations: number };

export type RulePackFile = {
  product: "年年";
  format: "nian-rule-pack";
  formatVersion: 1;
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function deriveBits(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: asBuffer(salt), iterations },
    key,
    256,
  );
  return bytesToB64(new Uint8Array(bits));
}

async function deriveAes(pin: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: asBuffer(salt), iterations },
    key,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function createPinRecord(pin: string): Promise<PinRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveBits(pin, salt, ITERATIONS);
  return { salt: bytesToB64(salt), hash, iterations: ITERATIONS };
}

export async function verifyPinRecord(pin: string, record: PinRecord): Promise<boolean> {
  if (!record?.salt || !record.hash || !record.iterations) return false;
  const hash = await deriveBits(pin, b64ToBytes(record.salt), record.iterations);
  return safeEqual(hash, record.hash);
}

export async function sealRules(rules: Rules, pin: string): Promise<RulePackFile> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAes(pin, salt, ITERATIONS);
  const plain = new TextEncoder().encode(JSON.stringify({ kind: "nian-rules", rules: normalizeRules(rules) }));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: asBuffer(iv) }, key, plain);
  return {
    product: "年年",
    format: "nian-rule-pack",
    formatVersion: 1,
    kdf: "PBKDF2-SHA-256",
    iterations: ITERATIONS,
    salt: bytesToB64(salt),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(cipher)),
  };
}

export function toPayload(file: RulePackFile): string {
  return PREFIX + bytesToB64Url(new TextEncoder().encode(JSON.stringify(file)));
}

export function parsePack(text: string): RulePackFile {
  const raw = text.trim();
  let json = raw;
  if (raw.startsWith(PREFIX)) {
    json = new TextDecoder().decode(b64UrlToBytes(raw.slice(PREFIX.length)));
  }
  let file: RulePackFile;
  try {
    file = JSON.parse(json) as RulePackFile;
  } catch {
    throw new Error("这个包打不开。请换文件或粘贴完整载荷。");
  }
  if (!file || file.format !== "nian-rule-pack" || file.formatVersion !== 1 || file.kdf !== "PBKDF2-SHA-256") {
    throw new Error("这个包不是年年的规则。");
  }
  if (file.iterations < 10_000 || file.iterations > 400_000 || !file.salt || !file.iv || !file.ciphertext) {
    throw new Error("这个包的加密参数不认识。");
  }
  return file;
}

export async function openRules(text: string, pin: string): Promise<Rules> {
  const file = parsePack(text);
  const key = await deriveAes(pin, b64ToBytes(file.salt), file.iterations);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: asBuffer(b64ToBytes(file.iv)) },
      key,
      asBuffer(b64ToBytes(file.ciphertext)),
    );
    const obj = JSON.parse(new TextDecoder().decode(plain)) as { kind?: string; rules?: unknown };
    if (!obj || obj.kind !== "nian-rules") throw new Error("这个包不是年年的规则。");
    return normalizeRules(obj.rules);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("这个包")) throw error;
    throw new Error("这个包打不开。请核对封包口令。");
  }
}
