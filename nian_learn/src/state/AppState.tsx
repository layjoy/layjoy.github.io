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
import {
  bindVaultListener,
  changePassphrase,
  getFamilyId,
  joinFamily,
  loadAccount,
  migrateLegacy,
  persistDiff,
  setupFamily,
  subscribeSync,
  verifyPassphrase,
  type SyncStatus,
} from "../lib/cloud-store";
import { familyIdError, openRules, passphraseError, sealRules } from "../lib/crypto";
import { defaultVault, sanitizeAgeBand, sanitizeRules, shiftDate, todayStamp } from "../lib/defaults";
import { growthPorts, socialPorts, syncAdapters } from "../lib/extensions";
import { setVoiceEnabled } from "../lib/speech";
import { addActiveSeconds, applyDateRollover, clearExpiredRest, getLock, withRules } from "../lib/time";
import type { AgeBandId, ContentPack, HabitState, LockState, ModuleId, ModuleRules, VaultData } from "../types";

interface AppApi {
  ready: boolean;
  needsSetup: boolean;
  needsUnlock: boolean;
  backendMissing: boolean;
  pack: ContentPack | null;
  packError: string | null;
  data: VaultData | null;
  lock: LockState | null;
  banner: string | null;
  familyId: string | null;
  sync: SyncStatus;
  setup: (passphrase: string) => Promise<string | null>;
  join: (familyId: string, passphrase: string) => Promise<string | null>;
  unlock: (passphrase: string) => Promise<string | null>;
  enterParent: (passphrase: string) => Promise<string | null>;
  leaveParent: () => void;
  parentAuthed: boolean;
  saveRules: (rules: ModuleRules | ((current: ModuleRules) => ModuleRules)) => void;
  setAgeBand: (ageBand: AgeBandId) => void;
  setVoice: (on: boolean) => void;
  record: (id: ModuleId, detail?: { emotionId?: string }) => void;
  markHabit: (habitId: string) => HabitState;
  exportRules: () => Promise<string | null>;
  importRules: (file: unknown) => Promise<string | null>;
  changePass: (next: string) => Promise<string | null>;
  setCounting: (on: boolean) => void;
  extensions: { syncAdapters: typeof syncAdapters; growthPorts: typeof growthPorts; socialPorts: typeof socialPorts };
}

const Ctx = createContext<AppApi | null>(null);

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
  const banner: string | null = null;
  const [parentAuthed, setParentAuthed] = useState(false);
  const [backendMissing, setBackendMissing] = useState(false);
  const [sync, setSync] = useState<SyncStatus>({ mode: "syncing", familyId: null, detail: "正在连接后端" });
  const dataRef = useRef<VaultData | null>(null);
  const passRef = useRef<string | null>(null);
  const countingRef = useRef(false);

  const update = useCallback((mutator: (current: VaultData) => VaultData, detail?: { emotionId?: string }) => {
    const cur = dataRef.current;
    if (!cur) return;
    const next = mutator(cur);
    if (next === cur) return;
    dataRef.current = next;
    setData(next);
    persistDiff(next, cur, detail);
  }, []);

  useEffect(() => subscribeSync(setSync), []);

  useEffect(() => {
    let cancel = false;
    bindVaultListener((vault) => {
      if (cancel) return;
      const next = normalize(vault);
      dataRef.current = next;
      setData(next);
      setVoiceEnabled(next.voiceOn);
    });
    (async () => {
      const packTask = loadContentPack()
        .then((loaded) => {
          if (!cancel) setPack(loaded);
        })
        .catch(() => {
          if (!cancel) setPackError("内容包没有加载出来");
        });
      const result = await loadAccount();
      if (cancel) return;
      if (result.kind === "unconfigured") setBackendMissing(true);
      else if (result.kind === "setup") setNeedsSetup(true);
      else if (result.kind === "unlock") setNeedsUnlock(true);
      else {
        const vault = normalize(result.vault);
        dataRef.current = vault;
        setData(vault);
        setVoiceEnabled(vault.voiceOn);
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

  const acceptVault = useCallback((vault: VaultData) => {
    const next = normalize(vault);
    dataRef.current = next;
    setData(next);
    setVoiceEnabled(next.voiceOn);
  }, []);

  const setup = useCallback(async (passphrase: string) => {
    const err = passphraseError(passphrase);
    if (err) return err;
    try {
      const vault = await setupFamily(passphrase, defaultVault());
      acceptVault(vault);
      setNeedsSetup(false);
      return null;
    } catch {
      return "没能连上后端。请确认服务器已经启动，并允许浏览器保存本站数据。";
    }
  }, [acceptVault]);

  const join = useCallback(async (familyId: string, passphrase: string) => {
    const idErr = familyIdError(familyId);
    if (idErr) return idErr;
    const err = passphraseError(passphrase);
    if (err) return err;
    try {
      acceptVault(await joinFamily(familyId, passphrase));
      setNeedsSetup(false);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "没有加入这个家庭";
    }
  }, [acceptVault]);

  const unlock = useCallback(async (passphrase: string) => {
    try {
      acceptVault(await migrateLegacy(passphrase));
      setNeedsUnlock(false);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "数据读不出来。请再试一次。";
    }
  }, [acceptVault]);

  const enterParent = useCallback(async (passphrase: string) => {
    const ok = await verifyPassphrase(passphrase);
    if (!ok) return "口令不对";
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
    (id: ModuleId, detail?: { emotionId?: string }) => {
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
      }, detail);
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
    if (!passRef.current) return "请先进入家长后台";
    try {
      await changePassphrase(next);
      passRef.current = next;
      return null;
    } catch {
      return "口令没有改成。请确认后端连着，再试一次。";
    }
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
      backendMissing,
      pack,
      packError,
      data,
      lock,
      banner,
      familyId: sync.familyId ?? getFamilyId(),
      sync,
      setup,
      join,
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
      backendMissing,
      pack,
      packError,
      data,
      lock,
      banner,
      sync,
      setup,
      join,
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
