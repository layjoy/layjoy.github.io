import { MODULE_IDS, defaultVault, sanitizeAgeBand, sanitizeRules, todayStamp } from "./defaults";
import type { AgeBandId, HabitState, ModuleId, ModuleRules, UsageState, VaultData } from "../types";

export type RecordKind = "rules" | "usage" | "activity" | "habit" | "emotion";

export interface Envelope {
  id: string;
  kind: RecordKind;
  ciphertext: string;
  iv: string;
  updatedAt: number;
}

export interface PlainRecord {
  id: string;
  kind: RecordKind;
  payload: unknown;
  updatedAt: number;
}

interface RulesPayload {
  rules: ModuleRules;
  ageBand: AgeBandId;
  voiceOn: boolean;
}

interface ActivityPayload {
  module?: ModuleId;
  at?: number;
}

interface EmotionPayload {
  at?: number;
}

interface HabitPayload extends HabitState {
  habitId?: string;
}

function isModule(value: unknown): value is ModuleId {
  return MODULE_IDS.includes(value as ModuleId);
}

export function foldRecords(items: PlainRecord[], now = Date.now()): VaultData {
  const today = todayStamp(now);
  const base = defaultVault();
  let vault: VaultData = base;
  const rules = [...items].reverse().find((item) => item.kind === "rules");
  if (rules) {
    const payload = rules.payload as Partial<RulesPayload>;
    vault = {
      ...vault,
      ageBand: sanitizeAgeBand(payload.ageBand, vault.ageBand),
      voiceOn: payload.voiceOn !== false,
      rules: sanitizeRules(payload.rules, vault.rules),
    };
  }
  const usage = [...items].reverse().find((item) => item.kind === "usage");
  if (usage) {
    const payload = usage.payload as Partial<UsageState>;
    const sameDay = payload.date === today;
    vault = {
      ...vault,
      usage: {
        date: today,
        secondsToday: sameDay ? Number(payload.secondsToday) || 0 : 0,
        sessionSeconds: sameDay ? Number(payload.sessionSeconds) || 0 : 0,
        restUntil: sameDay ? payload.restUntil ?? null : null,
      },
    };
  }
  const counts = { ...vault.progress.counts };
  const todayCounts = { ...vault.progress.today };
  const habits = { ...vault.progress.habits };
  for (const item of items) {
    if (item.kind === "activity") {
      const payload = item.payload as ActivityPayload;
      if (!isModule(payload.module) || payload.module === "emotion") continue;
      counts[payload.module] += 1;
      if (payload.at && todayStamp(payload.at) === today) {
        todayCounts[payload.module] = (todayCounts[payload.module] ?? 0) + 1;
      }
    } else if (item.kind === "emotion") {
      const payload = item.payload as EmotionPayload;
      counts.emotion += 1;
      if (payload.at && todayStamp(payload.at) === today) {
        todayCounts.emotion = (todayCounts.emotion ?? 0) + 1;
      }
    } else if (item.kind === "habit") {
      const payload = item.payload as HabitPayload;
      const habitId = payload.habitId || item.id.replace(/^habit:/, "");
      if (!habitId) continue;
      habits[habitId] = {
        streak: payload.streak ?? 0,
        lastDate: payload.lastDate ?? null,
        total: payload.total ?? 0,
      };
    }
  }
  return { ...vault, progress: { counts, today: todayCounts, habits } };
}
