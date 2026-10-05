import type { TimeWindow } from "../types";

export type BlockReason = "window" | "budget";

export function hmToMinutes(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function inWindows(date: Date, windows: TimeWindow[]): boolean {
  if (!windows.length) return true;
  const mins = date.getHours() * 60 + date.getMinutes();
  return windows.some((w) => {
    const start = hmToMinutes(w.start);
    const end = hmToMinutes(w.end);
    if (start < end) return mins >= start && mins <= end;
    return mins >= start || mins <= end;
  });
}

export function blockReason(
  date: Date,
  rules: { windows: TimeWindow[]; dailyMinutes: number },
  usedMs: number,
): BlockReason | null {
  if (!inWindows(date, rules.windows)) return "window";
  if (usedMs >= rules.dailyMinutes * 60_000) return "budget";
  return null;
}

export function dayIndex(len: number, offset = 0, now = new Date()): number {
  if (len <= 0) return 0;
  const start = Date.UTC(now.getFullYear(), 0, 0);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const day = Math.floor((today - start) / 86_400_000);
  return ((day + offset) % len + len) % len;
}

export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const REST_COPY: Record<BlockReason, string> = {
  window: "现在是休息时间。小星等你，到了可以玩的时候再来。",
  budget: "今天玩够啦。休息一下，明天再来找小星。",
};
