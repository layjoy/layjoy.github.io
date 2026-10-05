export type AgeBand = "5-6" | "7-8" | "9-12";

export type TimeWindow = { start: string; end: string };

export type Rules = {
  version: 1;
  ageBand: AgeBand;
  dailyMinutes: number;
  windows: TimeWindow[];
  modules: Record<string, boolean>;
  updatedAt: number;
};

export type Choice = {
  id: string;
  label: string;
  art?: string;
  correct?: boolean;
};

export type SpeechLine = { text: string; lang: "zh-CN" | "en-US" };

export type Round = {
  prompt: string;
  speech: string;
  lang: "zh-CN" | "en-US";
  art?: string;
  listen?: SpeechLine;
  choices: Choice[];
  explain: string;
  follow?: { speech: string; lang: "zh-CN" | "en-US"; show: string };
};

export type Activity =
  | {
      kind: "rounds";
      id: string;
      moduleId: string;
      title: string;
      ageBands: AgeBand[];
      rounds: Round[];
    }
  | {
      kind: "emotion";
      id: string;
      moduleId: "emotion";
      title: string;
      ageBands: AgeBand[];
      prompts: string[];
      emotions: { id: string; label: string; emoji: string; soothe: string; action: string }[];
    }
  | {
      kind: "habits";
      id: string;
      moduleId: "habits";
      title: string;
      ageBands: AgeBand[];
      tips: string[];
      items: { id: string; label: string; emoji: string }[];
    }
  | {
      kind: "together";
      id: string;
      moduleId: "together";
      title: string;
      ageBands: AgeBand[];
      prompt: string;
      speech: string;
      detail: string;
    };

export type ModuleMeta = {
  id: string;
  title: string;
  blurb: string;
  emoji: string;
  tone: string;
};

export type GrowthEvent = {
  at: number;
  moduleId: string;
  activityId: string;
  outcome: "done";
  ageBand: AgeBand;
};

export type TogetherSession = {
  activityId: string;
  confirmedByParent: boolean;
  at: number;
};
