import type { Activity, AgeBand, ModuleMeta, SpeechLine } from "../types";
import { dayIndex } from "../rules/time";

const metas: ModuleMeta[] = [];
const activities: Activity[] = [];

/** 新学科从这里登记。登记后会出现在乐园首页。 */
export function registerSubject(meta: ModuleMeta, items: Activity[]): void {
  if (!metas.some((item) => item.id === meta.id)) metas.push(meta);
  activities.push(...items);
}

export function modules(): ModuleMeta[] {
  return metas;
}

export function moduleEnabled(rules: { modules: Record<string, boolean> }, id: string): boolean {
  return rules.modules[id] !== false;
}

export function activityAt(moduleId: string, band: AgeBand, offset = 0): Activity | null {
  const list = activities.filter((item) => item.moduleId === moduleId && item.ageBands.includes(band));
  if (!list.length) return null;
  return list[dayIndex(list.length, offset)];
}

export function openingLine(activity: Activity | null): SpeechLine | null {
  if (!activity) return null;
  if (activity.kind === "rounds") return { text: activity.rounds[0].speech, lang: activity.rounds[0].lang };
  if (activity.kind === "emotion") return { text: activity.prompts[dayIndex(activity.prompts.length)], lang: "zh-CN" };
  if (activity.kind === "habits") return { text: activity.tips[dayIndex(activity.tips.length)], lang: "zh-CN" };
  return { text: activity.speech, lang: "zh-CN" };
}
