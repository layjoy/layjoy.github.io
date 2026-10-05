import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Rules } from "./types";
import { defaultRules, normalizeRules } from "./rules/model";
import { createPinRecord, openRules, sealRules, toPayload, verifyPinRecord, type PinRecord } from "./rules/seal";
import { isMemoryOnly, loadJson, saveJson } from "./storage/db";
import { todayKey } from "./rules/time";

type AppContextValue = {
  ready: boolean;
  encrypted: boolean;
  pinSet: boolean;
  rules: Rules;
  usageMs: number;
  habits: Record<string, boolean>;
  saveRules: (rules: Rules) => Promise<void>;
  setNewPin: (pin: string) => Promise<void>;
  checkPin: (pin: string) => Promise<boolean>;
  addUsage: (ms: number) => void;
  toggleHabit: (id: string) => void;
  exportPack: (pin: string, rules: Rules) => Promise<{ json: string; payload: string }>;
  importPack: (text: string, pin: string) => Promise<Rules>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppState({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [encrypted, setEncrypted] = useState(true);
  const [pinSet, setPinSet] = useState(false);
  const [rules, setRules] = useState<Rules>(defaultRules);
  const [usageMs, setUsageMs] = useState(0);
  const [habits, setHabits] = useState<Record<string, boolean>>({});
  const usageRef = useRef(0);
  const usageDate = useRef(todayKey());
  const saveTimer = useRef(0);

  useEffect(() => {
    let cancel = false;
    void (async () => {
      const [storedRules, pin, usage, storedHabits] = await Promise.all([
        loadJson<unknown>("rules"),
        loadJson<PinRecord>("pin"),
        loadJson<{ date: string; ms: number }>("usage"),
        loadJson<{ date: string; checks: Record<string, boolean> }>("habits"),
      ]);
      if (cancel) return;
      const today = todayKey();
      const nextRules = normalizeRules(storedRules ?? undefined);
      const ms = usage?.date === today ? usage.ms : 0;
      usageRef.current = ms;
      usageDate.current = today;
      setRules(nextRules);
      setPinSet(Boolean(pin?.hash));
      setUsageMs(ms);
      setHabits(storedHabits?.date === today ? storedHabits.checks : {});
      setEncrypted(!isMemoryOnly());
      setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const saveRules = useCallback(async (next: Rules) => {
    const normalized = normalizeRules({ ...next, updatedAt: Date.now() });
    await saveJson("rules", normalized);
    setRules(normalized);
  }, []);

  const setNewPin = useCallback(async (pin: string) => {
    await saveJson("pin", await createPinRecord(pin));
    setPinSet(true);
  }, []);

  const checkPin = useCallback(async (pin: string) => {
    const record = await loadJson<PinRecord>("pin");
    if (!record) return false;
    return verifyPinRecord(pin, record);
  }, []);

  const addUsage = useCallback((ms: number) => {
    if (ms < 250) return;
    const today = todayKey();
    if (usageDate.current !== today) {
      usageDate.current = today;
      usageRef.current = 0;
    }
    usageRef.current += ms;
    setUsageMs(usageRef.current);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveJson("usage", { date: usageDate.current, ms: usageRef.current });
    }, 400);
  }, []);

  const toggleHabit = useCallback((id: string) => {
    setHabits((prev) => {
      const checks = { ...prev, [id]: !prev[id] };
      void saveJson("habits", { date: todayKey(), checks });
      return checks;
    });
  }, []);

  const exportPack = useCallback(async (pin: string, current: Rules) => {
    const file = await sealRules(current, pin);
    return { json: JSON.stringify(file, null, 2), payload: toPayload(file) };
  }, []);

  const importPack = useCallback(async (text: string, pin: string) => {
    const next = await openRules(text, pin);
    await saveJson("rules", next);
    setRules(next);
    return next;
  }, []);

  const value = useMemo(
    () => ({
      ready,
      encrypted,
      pinSet,
      rules,
      usageMs,
      habits,
      saveRules,
      setNewPin,
      checkPin,
      addUsage,
      toggleHabit,
      exportPack,
      importPack,
    }),
    [ready, encrypted, pinSet, rules, usageMs, habits, saveRules, setNewPin, checkPin, addUsage, toggleHabit, exportPack, importPack],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error("年年还没准备好");
  return value;
}
