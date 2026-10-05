import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadContentPack } from "../content/loadPack";
import { createAccount, decryptJson, encryptJson, openRules, passphraseError, rewrapAccount, sealRules, unlockAccount } from "../lib/crypto";
import { defaultVault, sanitizeAgeBand, sanitizeRules, shiftDate, todayStamp } from "../lib/defaults";
import { growthPorts, socialPorts, syncAdapters } from "../lib/extensions";
import { setVoiceEnabled } from "../lib/speech";
import { readDek, readMeta, readVaultFile, writeDek, writeMeta, writeVaultFile } from "../lib/storage";
import { addActiveSeconds, applyDateRollover, clearExpiredRest, getLock, withRules } from "../lib/time";
import type { AgeBandId, ContentPack, HabitState, LockState, ModuleId, ModuleRules, VaultData } from "../types";

interface AppApi {
  ready: boolean;
  needsSetup: boolean;
  needsUnlock: boolean;
  pack: ContentPack | null;
  packError: string | null;
  data: VaultData | null;
  lock: LockState | null;
  banner: string | null;
  setup: (passphrase: string) => Promise<string | null>;
  unlock: (passphrase: string) => Promise<string | null>;
  enterParent: (passphrase: string) => Promise<string | null>;
  leaveParent: () => void;
  parentAuthed: boolean;
  saveRules: (rules: ModuleRules | ((current: ModuleRules) => ModuleRules)) => void;
  setAgeBand: (ageBand: AgeBandId) => void;
  setVoice: (on: boolean) => void;
  record: (id: ModuleId) => void;
  markHabit: (habitId: string) => HabitState;
  exportRules: () => Promise<string | null>;
  importRules: (file: unknown) => Promise<string | null>;
  changePass: (next: string) => Promise<string | null>;
  setCounting: (on: boolean) => void;
  extensions: { syncAdapters: typeof syncAdapters; growthPorts: typeof growthPorts; socialPorts: typeof socialPorts };
}

const Ctx = createContext<AppApi | null>(null);

function isVault(value: unknown): value is VaultData {
  if (!value || typeof value !== "object") return false;
  const v = value as VaultData;
  return v.version === 1 && !!v.rules && !!v.usage && !!v.progress?.counts;
}

function normalize(data: VaultData): VaultData {
  const base = defaultVault();
  const merged: VaultData = {
    ...base,
    ...data,
    version: 1,
    ageBand: sanitizeAgeBand(data.ageBand, "pre"),
    voiceOn: data.voiceOn !== false,
    rules: sanitizeRules(data.rules, base.rules),
    usage: { ...base.usage, ...data.usage },
    progress: {
      counts: { ...base.progress.counts, ...data.progress?.counts },
      today: { ...(data.progress?.today ?? {}) },
      habits: { ...(data.progress?.habits ?? {}) },
    },
  };
  return applyDateRollover(merged);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [pack, setPack] = useState<ContentPack | null>(null);
  const [packError, setPackError] = useState<string | null>(null);
  const [data, setData] = useState<VaultData | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [parentAuthed, setParentAuthed] = useState(false);
  const keyRef = useRef<CryptoKey | null>(null);
  const dataRef = useRef<VaultData | null>(null);
  const passRef = useRef<string | null>(null);
  const countingRef = useRef(false);
  const writeChain = useRef(Promise.resolve());

  const enqueueSave = useCallback(() => {
    writeChain.current = writeChain.current
      .then(async () => {
        const key = keyRef.current;
        const latest = dataRef.current;
        if (!key || !latest) return;
        writeVaultFile(await encryptJson(key, latest));
      })
      .catch(() => {
        setBanner("保存没有成功。请允许浏览器保存本站数据。");
      });
  }, []);

  const update = useCallback(
    (mutator: (current: VaultData) => VaultData) => {
      const cur = dataRef.current;
      if (!cur) return;
      const next = mutator(cur);
      if (next === cur) return;
      dataRef.current = next;
      setData(next);
      enqueueSave();
    },
    [enqueueSave],
  );

  useEffect(() => {
    let cancel = false;
    (async () => {
      const packTask = loadContentPack()
        .then((loaded) => {
          if (!cancel) setPack(loaded);
        })
        .catch(() => {
          if (!cancel) setPackError("内容包没有加载出来");
        });
      const meta = readMeta();
      if (!meta) {
        if (!cancel) {
          setNeedsSetup(true);
          setReady(true);
        }
        await packTask;
        return;
      }
      const dek = await readDek();
      if (!dek) {
        if (!cancel) {
          setNeedsUnlock(true);
          setReady(true);
        }
        await packTask;
        return;
      }
      keyRef.current = dek;
      try {
        const file = readVaultFile();
        const parsed = file ? await decryptJson<unknown>(dek, file) : null;
        if (!isVault(parsed)) throw new Error("vault");
        const vault = normalize(parsed);
        if (cancel) return;
        dataRef.current = vault;
        setData(vault);
        setVoiceEnabled(vault.voiceOn);
        if (vault !== parsed) writeVaultFile(await encryptJson(dek, vault));
      } catch {
        if (!cancel) setNeedsUnlock(true);
      }
      if (!cancel) setReady(true);
      await packTask;
    })();
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!ready || needsSetup || needsUnlock) return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const elapsed = Math.min(5, Math.floor((now - last) / 1000));
      last = now;
      update((latest) => {
        let next = clearExpiredRest(applyDateRollover(latest, now), now);
        const locked = getLock(next, now);
        if (countingRef.current && !locked && elapsed > 0) next = addActiveSeconds(next, elapsed, now);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [ready, needsSetup, needsUnlock, update]);

  const setup = useCallback(async (passphrase: string) => {
    const err = passphraseError(passphrase);
    if (err) return err;
    try {
      const { meta, dek } = await createAccount(passphrase);
      const initial = defaultVault();
      const file = await encryptJson(dek, initial);
      writeMeta(meta);
      writeVaultFile(file);
      try {
        await writeDek(dek);
      } catch {
        /* 密钥已包好。若浏览器不让保存密钥，下次进入需要再输口令。 */
      }
      keyRef.current = dek;
      dataRef.current = initial;
      setData(initial);
      setVoiceEnabled(true);
      setNeedsSetup(false);
      return null;
    } catch {
      return "没能保存。请关掉无痕模式，或换一个浏览器再试。";
    }
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    const meta = readMeta();
    if (!meta) return "还没有口令";
    const dek = await unlockAccount(passphrase, meta);
    if (!dek) return "口令不对";
    try {
      const file = readVaultFile();
      if (!file) throw new Error("empty");
      const parsed = await decryptJson<unknown>(dek, file);
      if (!isVault(parsed)) throw new Error("bad");
      await writeDek(dek);
      const vault = normalize(parsed);
      keyRef.current = dek;
      dataRef.current = vault;
      setData(vault);
      setVoiceEnabled(vault.voiceOn);
      setNeedsUnlock(false);
      return null;
    } catch {
      return "数据读不出来。请再试一次。清除浏览器数据会丢掉学习记录。";
    }
  }, []);

  const enterParent = useCallback(async (passphrase: string) => {
    const meta = readMeta();
    if (!meta) return "还没有口令";
    const key = await unlockAccount(passphrase, meta);
    if (!key) return "口令不对";
    passRef.current = passphrase;
    setParentAuthed(true);
    return null;
  }, []);

  const leaveParent = useCallback(() => {
    passRef.current = null;
    setParentAuthed(false);
  }, []);

  const saveRules = useCallback(
    (rules: ModuleRules | ((current: ModuleRules) => ModuleRules)) => {
      update((current) => {
        const next = typeof rules === "function" ? rules(current.rules) : rules;
        return withRules(current, sanitizeRules(next, current.rules));
      });
    },
    [update],
  );

  const setAgeBand = useCallback(
    (ageBand: AgeBandId) => {
      update((current) => ({ ...current, ageBand: sanitizeAgeBand(ageBand, current.ageBand) }));
    },
    [update],
  );

  const setVoice = useCallback(
    (on: boolean) => {
      setVoiceEnabled(on);
      update((current) => ({ ...current, voiceOn: on }));
    },
    [update],
  );

  const record = useCallback(
    (id: ModuleId) => {
      update((current) => {
        const rolled = applyDateRollover(current);
        return {
          ...rolled,
          progress: {
            ...rolled.progress,
            counts: { ...rolled.progress.counts, [id]: (rolled.progress.counts[id] ?? 0) + 1 },
            today: { ...rolled.progress.today, [id]: (rolled.progress.today[id] ?? 0) + 1 },
          },
        };
      });
    },
    [update],
  );

  const markHabit = useCallback(
    (habitId: string) => {
      let result: HabitState = { streak: 1, lastDate: todayStamp(), total: 1 };
      update((current) => {
        const rolled = applyDateRollover(current);
        const today = rolled.usage.date;
        const prev = rolled.progress.habits[habitId];
        if (prev?.lastDate === today) {
          result = prev;
          return rolled === current ? current : rolled;
        }
        result = {
          streak: prev?.lastDate === shiftDate(today, -1) ? prev.streak + 1 : 1,
          lastDate: today,
          total: (prev?.total ?? 0) + 1,
        };
        return {
          ...rolled,
          progress: {
            ...rolled.progress,
            habits: { ...rolled.progress.habits, [habitId]: result },
            counts: { ...rolled.progress.counts, habits: rolled.progress.counts.habits + 1 },
            today: { ...rolled.progress.today, habits: (rolled.progress.today.habits ?? 0) + 1 },
          },
        };
      });
      return result;
    },
    [update],
  );

  const exportRules = useCallback(async () => {
    const pass = passRef.current;
    const current = dataRef.current;
    if (!pass || !current) return "请先进入家长后台";
    const file = await sealRules(pass, {
      rules: current.rules,
      ageBand: current.ageBand,
      voiceOn: current.voiceOn,
    });
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nian-learn-rules.json";
    link.click();
    URL.revokeObjectURL(url);
    return null;
  }, []);

  const importRules = useCallback(
    async (file: unknown) => {
      const pass = passRef.current;
      if (!pass || !dataRef.current) return "请先进入家长后台";
      try {
        const payload = await openRules(pass, file);
        update((current) => {
          const rules = sanitizeRules(payload.rules, current.rules);
          return {
            ...withRules(current, rules),
            ageBand: sanitizeAgeBand(payload.ageBand, current.ageBand),
            voiceOn: payload.voiceOn !== false,
          };
        });
        if (dataRef.current) setVoiceEnabled(dataRef.current.voiceOn);
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : "导入没有成功";
      }
    },
    [update],
  );

  const changePass = useCallback(async (next: string) => {
    const err = passphraseError(next);
    if (err) return err;
    const meta = readMeta();
    const current = passRef.current;
    if (!meta || !current) return "请先进入家长后台";
    const wrapped = await rewrapAccount(current, next, meta);
    if (!wrapped) return "口令没有改成";
    writeMeta(wrapped);
    passRef.current = next;
    return null;
  }, []);

  const setCounting = useCallback((on: boolean) => {
    countingRef.current = on;
  }, []);

  const lock = data ? getLock(clearExpiredRest(applyDateRollover(data), Date.now())) : null;

  const api = useMemo<AppApi>(
    () => ({
      ready,
      needsSetup,
      needsUnlock,
      pack,
      packError,
      data,
      lock,
      banner,
      setup,
      unlock,
      enterParent,
      leaveParent,
      parentAuthed,
      saveRules,
      setAgeBand,
      setVoice,
      record,
      markHabit,
      exportRules,
      importRules,
      changePass,
      setCounting,
      extensions: { syncAdapters, growthPorts, socialPorts },
    }),
    [
      ready,
      needsSetup,
      needsUnlock,
      pack,
      packError,
      data,
      lock,
      banner,
      setup,
      unlock,
      enterParent,
      leaveParent,
      parentAuthed,
      saveRules,
      setAgeBand,
      setVoice,
      record,
      markHabit,
      exportRules,
      importRules,
      changePass,
      setCounting,
    ],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp(): AppApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("缺少应用状态");
  return ctx;
}
