import type { LockState, ModuleRules, VaultData } from "../types";
import { todayStamp } from "./defaults";

export function applyDateRollover(data: VaultData, now = Date.now()): VaultData {
  const today = todayStamp(now);
  if (data.usage.date === today) return data;
  return {
    ...data,
    usage: { date: today, secondsToday: 0, sessionSeconds: 0, restUntil: null },
    progress: { ...data.progress, today: {} },
  };
}

export function getLock(data: VaultData, now = Date.now()): LockState | null {
  if (data.usage.date !== todayStamp(now)) return null;
  const dailyCap = data.rules.dailyLimitMinutes * 60;
  if (data.usage.secondsToday >= dailyCap) return { reason: "daily", until: null };
  if (data.usage.restUntil && now < data.usage.restUntil) {
    return { reason: "session", until: data.usage.restUntil };
  }
  return null;
}

export function addActiveSeconds(data: VaultData, delta: number, now = Date.now()): VaultData {
  if (delta <= 0) return data;
  const dailyCap = data.rules.dailyLimitMinutes * 60;
  const sessionCap = data.rules.sessionLimitMinutes * 60;
  let secondsToday = data.usage.secondsToday + delta;
  let sessionSeconds = data.usage.sessionSeconds + delta;
  let restUntil = data.usage.restUntil;
  if (secondsToday >= dailyCap) {
    secondsToday = dailyCap;
  } else if (sessionSeconds >= sessionCap) {
    sessionSeconds = sessionCap;
    restUntil = now + data.rules.restMinutes * 60 * 1000;
  }
  if (sessionSeconds > sessionCap) sessionSeconds = sessionCap;
  return { ...data, usage: { ...data.usage, secondsToday, sessionSeconds, restUntil } };
}

export function clearExpiredRest(data: VaultData, now = Date.now()): VaultData {
  if (!data.usage.restUntil || now < data.usage.restUntil) return data;
  if (data.usage.secondsToday >= data.rules.dailyLimitMinutes * 60) {
    return { ...data, usage: { ...data.usage, restUntil: null } };
  }
  return {
    ...data,
    usage: { ...data.usage, restUntil: null, sessionSeconds: 0 },
  };
}

export function withRules(data: VaultData, rules: ModuleRules, now = Date.now()): VaultData {
  const usage = { ...data.usage };
  const dailyCap = rules.dailyLimitMinutes * 60;
  const sessionCap = rules.sessionLimitMinutes * 60;
  if (usage.secondsToday < dailyCap && usage.sessionSeconds < sessionCap) {
    usage.restUntil = null;
  } else if (usage.secondsToday >= dailyCap) {
    usage.restUntil = null;
  } else if (!usage.restUntil || usage.restUntil <= now) {
    usage.restUntil = now + rules.restMinutes * 60 * 1000;
  }
  return { ...data, rules, usage };
}

export function remainingSeconds(data: VaultData): number {
  const dailyLeft = data.rules.dailyLimitMinutes * 60 - data.usage.secondsToday;
  const sessionLeft = data.rules.sessionLimitMinutes * 60 - data.usage.sessionSeconds;
  return Math.max(0, Math.min(dailyLeft, sessionLeft));
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m} 分 ${`${s}`.padStart(2, "0")} 秒`;
}
