import type { GrowthEvent } from "../types";
import { loadJson, saveJson } from "../storage/db";
import { todayKey } from "../rules/time";

/**
 * 成长记录只留结构和本地追加。
 * 本阶段没有完整档案页面。
 */
export interface GrowthLog {
  append(event: GrowthEvent): Promise<void>;
  readRecent(limit: number): Promise<GrowthEvent[]>;
}

async function append(event: GrowthEvent): Promise<void> {
  const list = (await loadJson<GrowthEvent[]>("growth")) ?? [];
  const day = todayKey(new Date(event.at));
  const exists = list.some(
    (item) => item.activityId === event.activityId && todayKey(new Date(item.at)) === day && item.outcome === "done",
  );
  if (exists) return;
  list.push(event);
  await saveJson("growth", list.slice(-80));
}

async function readRecent(limit: number): Promise<GrowthEvent[]> {
  const list = (await loadJson<GrowthEvent[]>("growth")) ?? [];
  return list.slice(-Math.max(0, limit));
}

export const growthLog: GrowthLog = { append, readRecent };
