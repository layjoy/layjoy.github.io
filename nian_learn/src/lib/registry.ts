import type { AgeBand, ModuleId, Screen } from "../types";

/**
 * 以后开放新年级：把 enabled 设为 true，并在当季内容包的 math、拼音 bands 里补上难度。
 * 未开放的年级不要做空页面。
 */
export const AGE_BANDS: AgeBand[] = [
  { id: "pre", label: "学前", ages: "约 5–6 岁", enabled: true },
  { id: "g1", label: "一年级", ages: "约 6–7 岁", enabled: true },
  { id: "g2", label: "二年级", ages: "约 7–8 岁", enabled: false },
  { id: "g3", label: "三年级", ages: "约 8–9 岁", enabled: false },
  { id: "g4", label: "四年级", ages: "约 9–10 岁", enabled: false },
  { id: "g5", label: "五年级", ages: "约 10–11 岁", enabled: false },
  { id: "g6", label: "六年级", ages: "约 11–12 岁", enabled: false },
];

export interface SubjectModule {
  id: string;
  title: string;
  short: string;
  emoji: string;
  available: boolean;
  screen?: Screen;
  moduleId?: ModuleId;
}

/** 未 available 的条目只留在注册表里，首页不显示，也不做占位页。 */
export const SUBJECTS: SubjectModule[] = [
  { id: "english", title: "英语", short: "单词和图", emoji: "🐱", available: true, screen: "english", moduleId: "english" },
  { id: "math", title: "数学", short: "算一算", emoji: "🔢", available: true, screen: "math", moduleId: "math" },
  { id: "chinese", title: "语文", short: "拼音汉字", emoji: "字", available: true, screen: "chinese", moduleId: "chinese" },
  { id: "emotion", title: "心情", short: "说说感觉", emoji: "😊", available: true, screen: "emotion", moduleId: "emotion" },
  { id: "habits", title: "习惯", short: "贴个星星", emoji: "⭐", available: true, screen: "habits", moduleId: "habits" },
  { id: "together", title: "一起玩", short: "和家人", emoji: "🤝", available: true, screen: "together", moduleId: "together" },
  { id: "science", title: "科学", short: "以后再加", emoji: "🌱", available: false },
  { id: "growth", title: "成长记录", short: "以后再加", emoji: "📒", available: false },
  { id: "social", title: "社交", short: "这一版不做联网聊天", emoji: "💬", available: false },
];

export function enabledAgeBands(): AgeBand[] {
  return AGE_BANDS.filter((band) => band.enabled);
}

export function playableSubjects(): SubjectModule[] {
  return SUBJECTS.filter((item) => item.available && item.screen && item.moduleId);
}
