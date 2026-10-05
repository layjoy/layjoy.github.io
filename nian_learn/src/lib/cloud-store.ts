import type { ModuleId, UsageState, VaultData } from "../types";
import { apiConfigured, apiRequest } from "./api";
import { createFamilyId, decryptJson, deriveSession, encryptJson, normalizeFamilyId, unlockAccount } from "./crypto";
import { MODULE_IDS } from "./defaults";
import { foldRecords, type Envelope, type PlainRecord, type RecordKind } from "./records";
import {
  clearLegacyVault,
  deleteOutbox,
  putCache,
  putOutbox,
  readCache,
  readDek,
  readMeta,
  readOutbox,
  readSession,
  readVaultFile,
  replaceCache,
  writeSession,
  type OutboxItem,
} from "./storage";

export interface SyncStatus {
  mode: "ready" | "offline" | "syncing" | "error" | "unconfigured";
  familyId: string | null;
  detail: string;
}

export type LoadResult =
  | { kind: "unconfigured" }
  | { kind: "setup" }
  | { kind: "unlock" }
  | { kind: "ready"; vault: VaultData; familyId: string };

interface Session {
  aesKey: CryptoKey;
  authToken: string;
  familyId: string;
  tokenHash: string;
}

const listeners = new Set<(status: SyncStatus) => void>();
let onVault: ((vault: VaultData) => void) | null = null;
let session: Session | null = null;
let status: SyncStatus = { mode: "syncing", familyId: null, detail: "正在连接后端" };
let persistGen = 0;
let usageTimer: number | null = null;
let pendingUsage: UsageState | null = null;
let loops = false;
let chain = Promise.resolve();
const plain = new Map<string, PlainRecord>();

function setStatus(next: Partial<SyncStatus>) {
  status = { ...status, ...next, familyId: session?.familyId ?? status.familyId };
  listeners.forEach((listener) => listener(status));
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function subscribeSync(listener: (status: SyncStatus) => void): () => void {
  listeners.add(listener);
  listener(status);
  return () => listeners.delete(listener);
}

export function bindVaultListener(listener: (vault: VaultData) => void): void {
  onVault = listener;
}

export function getFamilyId(): string | null {
  return session?.familyId ?? null;
}

async function remember(record: PlainRecord) {
  plain.set(record.id, record);
}

async function seal(kind: RecordKind, id: string, payload: unknown, updatedAt = Date.now()): Promise<Envelope> {
  if (!session) throw new Error("还没有家庭");
  const file = await encryptJson(session.aesKey, payload);
  const record = { id, kind, payload, updatedAt };
  await remember(record);
  return { id, kind, ciphertext: file.ciphertext, iv: file.iv, updatedAt };
}

async function decryptEnvelope(envelope: Envelope): Promise<PlainRecord | null> {
  if (!session) return null;
  try {
    const payload = await decryptJson<unknown>(session.aesKey, { iv: envelope.iv, ciphertext: envelope.ciphertext });
    const record = { id: envelope.id, kind: envelope.kind, payload, updatedAt: envelope.updatedAt };
    plain.set(record.id, record);
    return record;
  } catch {
    return null;
  }
}

async function decryptAll(
  envelopes: Array<{ id: string; kind: string; ciphertext: string; iv: string; updatedAt: number }>,
): Promise<PlainRecord[]> {
  const records: PlainRecord[] = [];
  for (const envelope of envelopes) {
    const record = await decryptEnvelope({ ...envelope, kind: envelope.kind as RecordKind });
    if (record) records.push(record);
  }
  return records;
}

async function registerFamily() {
  if (!session) return;
  await apiRequest("/api/families", {
    method: "POST",
    body: { familyId: session.familyId, tokenHash: session.tokenHash },
  });
}

async function pushOne(envelope: Envelope) {
  await putCache(envelope);
  if (!navigator.onLine) {
    await putOutbox({ id: envelope.id, type: "record", envelope });
    setStatus({ mode: "offline", detail: "没有网络，先记在这台设备，连上后再送到后端" });
    return;
  }
  try {
    await apiRequest("/api/records", {
      method: "PUT",
      token: session?.authToken,
      familyId: session?.familyId,
      body: { records: [envelope] },
    });
    await deleteOutbox(envelope.id);
    setStatus({ mode: "ready", detail: "已写入后端" });
  } catch {
    await putOutbox({ id: envelope.id, type: "record", envelope });
    setStatus({
      mode: navigator.onLine ? "error" : "offline",
      detail: navigator.onLine ? "后端暂时没连上，先记在这台设备" : "没有网络，先记在这台设备，连上后再送到后端",
    });
  }
}

async function pushPending() {
  if (!session) return;
  const items = await readOutbox<OutboxItem>();
  const family = items.find((item) => item.type === "family");
  if (family && family.type === "family") {
    await registerFamily();
    await deleteOutbox("family");
  }
  const records = items.filter((item) => item.type === "record").map((item) => item.envelope);
  if (records.length === 0) return;
  await apiRequest("/api/records", {
    method: "PUT",
    token: session.authToken,
    familyId: session.familyId,
    body: { records },
  });
  for (const record of records) await deleteOutbox(record.id);
}

async function refreshFromServer() {
  if (!session || !navigator.onLine) return;
  const gen = persistGen;
  if (pendingUsage) return;
  const pending = await readOutbox();
  if (pending.length > 0) return;
  const remote = await apiRequest<{ records: Envelope[] }>("/api/records", {
    method: "GET",
    token: session.authToken,
    familyId: session.familyId,
  });
  if (gen !== persistGen || pendingUsage) return;
  const stillPending = await readOutbox();
  if (stillPending.length > 0) return;
  await replaceCache(remote.records);
  const records = await decryptAll(remote.records);
  onVault?.(foldRecords(records));
}

async function flushNow() {
  if (!session) return;
  if (!navigator.onLine) {
    setStatus({ mode: "offline", detail: "没有网络，先记在这台设备，连上后再送到后端" });
    return;
  }
  try {
    const usage = pendingUsage;
    pendingUsage = null;
    if (usage) await pushOne(await seal("usage", "usage", usage));
    const pending = await readOutbox();
    if (pending.length === 0) return;
    await pushPending();
    setStatus({ mode: "ready", detail: "已写入后端" });
  } catch {
    setStatus({ mode: "error", detail: "同步还没成功，会再试" });
  }
}

export function flush(): Promise<void> {
  return enqueue(flushNow);
}

function startLoops() {
  if (loops || typeof window === "undefined") return;
  loops = true;
  window.addEventListener("online", () => {
    void flush().then(() => refreshFromServer());
  });
  window.addEventListener("offline", () => {
    setStatus({ mode: "offline", detail: "没有网络，先记在这台设备，连上后再送到后端" });
  });
  window.addEventListener("focus", () => {
    void refreshFromServer();
  });
  window.setInterval(() => {
    void flush();
  }, 4000);
}

function scheduleUsage(usage: UsageState) {
  pendingUsage = usage;
  if (usageTimer !== null) return;
  usageTimer = window.setTimeout(() => {
    usageTimer = null;
    const next = pendingUsage;
    pendingUsage = null;
    if (!next) return;
    persistGen += 1;
    void enqueue(async () => {
      await pushOne(await seal("usage", "usage", next));
    });
  }, 5000);
}

async function adopt(next: Session) {
  session = next;
  await writeSession(next);
  setStatus({ mode: "syncing", familyId: next.familyId, detail: "正在连接后端" });
}

async function openRemote(): Promise<VaultData> {
  if (!session) return foldRecords([]);
  await pushPending();
  const remote = await apiRequest<{ records: Envelope[] }>("/api/records", {
    method: "GET",
    token: session.authToken,
    familyId: session.familyId,
  });
  await replaceCache(remote.records);
  clearLegacyVault();
  const records = await decryptAll(remote.records);
  setStatus({ mode: "ready", detail: "已从后端读回" });
  return foldRecords(records);
}

export async function loadAccount(): Promise<LoadResult> {
  if (!apiConfigured()) {
    setStatus({ mode: "unconfigured", detail: "还没有配置后端地址" });
    return { kind: "unconfigured" };
  }
  const stored = await readSession();
  if (!stored) {
    const meta = readMeta();
    if (meta) return { kind: "unlock" };
    return { kind: "setup" };
  }
  session = { ...stored, tokenHash: "" };
  const derivedHash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stored.authToken));
  session.tokenHash = [...new Uint8Array(derivedHash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  startLoops();
  if (navigator.onLine) {
    try {
      const vault = await enqueue(openRemote);
      return { kind: "ready", vault, familyId: stored.familyId };
    } catch {
      /* 后端暂时读不到时，用待同步缓存接着用 */
    }
  }
  const cached = await decryptAll(await readCache());
  setStatus({ mode: "offline", detail: "没有网络，先用这台设备上还没送走的记录" });
  return { kind: "ready", vault: foldRecords(cached), familyId: stored.familyId };
}

async function queueFamily() {
  if (!session) return;
  await putOutbox({ id: "family", type: "family", tokenHash: session.tokenHash });
}

async function saveInitial(vault: VaultData) {
  if (!session) return;
  try {
    await registerFamily();
  } catch {
    await queueFamily();
  }
  await pushOne(await seal("rules", "rules", { rules: vault.rules, ageBand: vault.ageBand, voiceOn: vault.voiceOn }));
  await pushOne(await seal("usage", "usage", vault.usage));
  for (const [habitId, state] of Object.entries(vault.progress.habits)) {
    await pushOne(await seal("habit", `habit:${habitId}`, { habitId, ...state }));
  }
  const yesterday = Date.now() - 86_400_000;
  for (const moduleId of MODULE_IDS) {
    const total = vault.progress.counts[moduleId] ?? 0;
    const todayCount = vault.progress.today[moduleId] ?? 0;
    const older = Math.max(0, total - todayCount);
    for (let i = 0; i < todayCount; i += 1) {
      if (moduleId === "emotion") await pushOne(await seal("emotion", `emo:${crypto.randomUUID()}`, { at: Date.now() }));
      else await pushOne(await seal("activity", `act:${crypto.randomUUID()}`, { module: moduleId, at: Date.now() }));
    }
    for (let i = 0; i < older; i += 1) {
      if (moduleId === "emotion") await pushOne(await seal("emotion", `emo:${crypto.randomUUID()}`, { at: yesterday }));
      else await pushOne(await seal("activity", `act:${crypto.randomUUID()}`, { module: moduleId, at: yesterday }));
    }
  }
}

export async function setupFamily(passphrase: string, vault: VaultData): Promise<VaultData> {
  const familyId = createFamilyId();
  const derived = await deriveSession(passphrase, familyId);
  await adopt({ ...derived, familyId });
  await enqueue(() => saveInitial(vault));
  startLoops();
  return vault;
}

export async function joinFamily(familyId: string, passphrase: string): Promise<VaultData> {
  const id = normalizeFamilyId(familyId);
  const derived = await deriveSession(passphrase, id);
  session = { ...derived, familyId: id };
  try {
    const vault = await openRemote();
    await writeSession(session);
    startLoops();
    return vault;
  } catch (error) {
    session = null;
    throw error;
  }
}

export async function migrateLegacy(passphrase: string): Promise<VaultData> {
  const meta = readMeta();
  if (!meta) throw new Error("没有旧的本地记录");
  const dek = await unlockAccount(passphrase, meta);
  if (!dek) throw new Error("口令不对");
  const storedDek = (await readDek()) ?? dek;
  const file = readVaultFile();
  if (!file) throw new Error("没有旧的本地记录");
  const vault = await decryptJson<VaultData>(storedDek, file);
  if (!vault?.rules || !vault.usage || !vault.progress) throw new Error("旧记录打不开");
  const familyId = createFamilyId();
  const derived = await deriveSession(passphrase, familyId);
  await adopt({ ...derived, familyId });
  await enqueue(() => saveInitial(vault));
  clearLegacyVault();
  startLoops();
  return vault;
}

function usageChanged(left: UsageState, right: UsageState): boolean {
  return (
    left.date !== right.date ||
    left.secondsToday !== right.secondsToday ||
    left.sessionSeconds !== right.sessionSeconds ||
    left.restUntil !== right.restUntil
  );
}

export function persistDiff(next: VaultData, prev: VaultData, detail?: { emotionId?: string }): void {
  if (!session) return;
  persistGen += 1;
  const jobs: Array<() => Promise<void>> = [];
  if (
    next.ageBand !== prev.ageBand ||
    next.voiceOn !== prev.voiceOn ||
    JSON.stringify(next.rules) !== JSON.stringify(prev.rules)
  ) {
    jobs.push(async () => {
      await pushOne(await seal("rules", "rules", { rules: next.rules, ageBand: next.ageBand, voiceOn: next.voiceOn }));
    });
  }
  for (const id of MODULE_IDS) {
    const added = (next.progress.counts[id] ?? 0) - (prev.progress.counts[id] ?? 0);
    if (id === "emotion") {
      for (let i = 0; i < added; i += 1) {
        const emotionId = detail?.emotionId;
        jobs.push(async () => {
          await pushOne(
            await seal("emotion", `emo:${crypto.randomUUID()}`, {
              at: Date.now(),
              ...(emotionId ? { emotionId } : {}),
            }),
          );
        });
      }
      continue;
    }
    for (let i = 0; i < added; i += 1) {
      const moduleId: ModuleId = id;
      jobs.push(async () => {
        await pushOne(await seal("activity", `act:${crypto.randomUUID()}`, { module: moduleId, at: Date.now() }));
      });
    }
  }
  for (const [habitId, state] of Object.entries(next.progress.habits)) {
    const old = prev.progress.habits[habitId];
    if (!old || old.streak !== state.streak || old.lastDate !== state.lastDate || old.total !== state.total) {
      jobs.push(async () => {
        await pushOne(await seal("habit", `habit:${habitId}`, { habitId, ...state }));
      });
    }
  }
  if (usageChanged(next.usage, prev.usage)) scheduleUsage(next.usage);
  if (jobs.length === 0) return;
  void enqueue(async () => {
    for (const job of jobs) await job();
  });
}

export async function verifyPassphrase(passphrase: string): Promise<boolean> {
  if (!session) return false;
  const derived = await deriveSession(passphrase, session.familyId);
  return derived.authToken === session.authToken;
}

export async function changePassphrase(nextPassphrase: string): Promise<void> {
  if (!session) throw new Error("还没有家庭");
  const current = session;
  await decryptAll(await readCache());
  const derived = await deriveSession(nextPassphrase, current.familyId);
  const remote = await apiRequest<{ records: Envelope[] }>("/api/records", {
    method: "GET",
    token: current.authToken,
    familyId: current.familyId,
  });
  if (remote.records.length > 0 && plain.size === 0) throw new Error("记录还没读出来");
  const envelopes: Envelope[] = [];
  for (const record of plain.values()) {
    const file = await encryptJson(derived.aesKey, record.payload);
    envelopes.push({
      id: record.id,
      kind: record.kind,
      ciphertext: file.ciphertext,
      iv: file.iv,
      updatedAt: Date.now(),
    });
  }
  const previous = await readCache();
  try {
    for (let i = 0; i < envelopes.length; i += 100) {
      await apiRequest("/api/records", {
        method: "PUT",
        token: current.authToken,
        familyId: current.familyId,
        body: { records: envelopes.slice(i, i + 100) },
      });
    }
    await apiRequest("/api/families/token", {
      method: "PUT",
      token: current.authToken,
      familyId: current.familyId,
      body: { tokenHash: derived.tokenHash },
    });
  } catch (error) {
    if (previous.length > 0) {
      await apiRequest("/api/records", {
        method: "PUT",
        token: current.authToken,
        familyId: current.familyId,
        body: { records: previous },
      }).catch(() => undefined);
    }
    throw error;
  }
  session = { ...derived, familyId: current.familyId };
  await writeSession(session);
  await replaceCache(envelopes);
  setStatus({ mode: "ready", detail: "已写入后端" });
}
