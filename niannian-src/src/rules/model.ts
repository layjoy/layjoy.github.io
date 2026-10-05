import type { AgeBand, Rules, TimeWindow } from "../types";

const BANDS: AgeBand[] = ["5-6", "7-8", "9-12"];

export const BUILTIN_MODULES = ["school", "chinese", "math", "english", "emotion", "habits", "together"] as const;

export function defaultRules(): Rules {
  return {
    version: 1,
    ageBand: "5-6",
    dailyMinutes: 40,
    windows: [{ start: "00:00", end: "23:59" }],
    modules: {
      school: true,
      chinese: true,
      math: true,
      english: true,
      emotion: true,
      habits: true,
      together: true,
    },
    updatedAt: 0,
  };
}

function isHm(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function parseWindow(value: unknown): TimeWindow | null {
  if (!value || typeof value !== "object") return null;
  const start = (value as { start?: unknown }).start;
  const end = (value as { end?: unknown }).end;
  if (!isHm(start) || !isHm(end) || start === end) return null;
  return { start, end };
}

export function normalizeRules(input: unknown): Rules {
  const base = defaultRules();
  if (!input || typeof input !== "object") return base;
  const raw = input as Record<string, unknown>;
  if (BANDS.includes(raw.ageBand as AgeBand)) base.ageBand = raw.ageBand as AgeBand;
  const mins = Number(raw.dailyMinutes);
  if (Number.isFinite(mins)) base.dailyMinutes = Math.min(180, Math.max(5, Math.round(mins)));
  if (Array.isArray(raw.windows)) {
    const windows = raw.windows.map(parseWindow).filter((item): item is TimeWindow => !!item);
    if (windows.length) base.windows = windows.slice(0, 4);
  }
  if (raw.modules && typeof raw.modules === "object") {
    const mods = raw.modules as Record<string, unknown>;
    for (const id of Object.keys(mods)) {
      if (typeof mods[id] === "boolean") base.modules[id] = mods[id];
    }
  }
  if (!Object.values(base.modules).some(Boolean)) base.modules.school = true;
  const updated = Number(raw.updatedAt);
  base.updatedAt = Number.isFinite(updated) ? updated : Date.now();
  base.version = 1;
  return base;
}
