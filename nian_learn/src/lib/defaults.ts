import type { AgeBandId, ModuleId, ModuleRules, VaultData } from "../types";

export const MODULE_IDS: ModuleId[] = ["english", "math", "chinese", "emotion", "habits", "together"];

export const MODULE_LABEL: Record<ModuleId, string> = {
  english: "英语",
  math: "数学",
  chinese: "语文",
  emotion: "心情",
  habits: "习惯",
  together: "一起玩",
};

export function todayStamp(now = Date.now()): string {
  const d = new Date(now);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  return todayStamp(dt.getTime());
}

export function defaultRules(): ModuleRules {
  return {
    dailyLimitMinutes: 25,
    sessionLimitMinutes: 15,
    restMinutes: 5,
    modulesEnabled: {
      english: true,
      math: true,
      chinese: true,
      emotion: true,
      habits: true,
      together: true,
    },
  };
}

export function defaultVault(ageBand: AgeBandId = "pre"): VaultData {
  return {
    version: 1,
    ageBand,
    voiceOn: true,
    rules: defaultRules(),
    usage: {
      date: todayStamp(),
      secondsToday: 0,
      sessionSeconds: 0,
      restUntil: null,
    },
    progress: {
      counts: { english: 0, math: 0, chinese: 0, emotion: 0, habits: 0, together: 0 },
      today: {},
      habits: {},
    },
  };
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function sanitizeRules(input: Partial<ModuleRules> | undefined, fallback: ModuleRules): ModuleRules {
  const enabled = { ...fallback.modulesEnabled };
  for (const id of MODULE_IDS) {
    const value = input?.modulesEnabled?.[id];
    if (typeof value === "boolean") enabled[id] = value;
  }
  return {
    dailyLimitMinutes: clamp(input?.dailyLimitMinutes ?? fallback.dailyLimitMinutes, 1, 180),
    sessionLimitMinutes: clamp(input?.sessionLimitMinutes ?? fallback.sessionLimitMinutes, 1, 120),
    restMinutes: clamp(input?.restMinutes ?? fallback.restMinutes, 1, 60),
    modulesEnabled: enabled,
  };
}

export function sanitizeAgeBand(value: unknown, fallback: AgeBandId): AgeBandId {
  if (value === "pre" || value === "g1") return value;
  return fallback;
}
