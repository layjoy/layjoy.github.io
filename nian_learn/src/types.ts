export type AgeBandId = "pre" | "g1" | "g2" | "g3" | "g4" | "g5" | "g6";

export type ModuleId = "english" | "math" | "chinese" | "emotion" | "habits" | "together";

export type Screen =
  | "home"
  | "english"
  | "math"
  | "chinese"
  | "emotion"
  | "habits"
  | "together"
  | "parent"
  | "lock";

export interface AgeBand {
  id: AgeBandId;
  label: string;
  ages: string;
  enabled: boolean;
}

export interface ModuleRules {
  dailyLimitMinutes: number;
  sessionLimitMinutes: number;
  restMinutes: number;
  modulesEnabled: Record<ModuleId, boolean>;
}

export interface UsageState {
  date: string;
  secondsToday: number;
  sessionSeconds: number;
  restUntil: number | null;
}

export interface HabitState {
  streak: number;
  lastDate: string | null;
  total: number;
}

export interface ProgressState {
  counts: Record<ModuleId, number>;
  today: Partial<Record<ModuleId, number>>;
  habits: Record<string, HabitState>;
}

export interface VaultData {
  version: 1;
  ageBand: AgeBandId;
  voiceOn: boolean;
  rules: ModuleRules;
  usage: UsageState;
  progress: ProgressState;
}

export interface EnglishWord {
  id: string;
  en: string;
  zh: string;
  emoji: string;
}

export interface HanziItem {
  id: string;
  char: string;
  pinyin: string;
  words: string[];
}

export interface PinyinItem {
  id: string;
  group: "声母" | "韵母" | "整体认读";
  show: string;
  speak: string;
}

export interface EmotionItem {
  id: string;
  label: string;
  emoji: string;
  line: string;
}

export interface HabitItem {
  id: string;
  label: string;
  emoji: string;
  hint: string;
}

export interface ColorChoice {
  id: string;
  label: string;
  swatch: string;
}

export interface TogetherPack {
  countByBand: Record<string, number>;
  colors: ColorChoice[];
  praises: { child: string[]; parent: string[] };
  lines: {
    colorsAsk: string;
    colorsHeard: string;
    countAsk: string;
    praiseAsk: string;
  };
}

export interface MathBandConfig {
  max: number;
  choices: number;
}

export interface ChinesePack {
  characters: HanziItem[];
  pinyin: PinyinItem[];
  bands: Record<string, string[] | "all">;
}

export interface PackManifest {
  id: string;
  title: string;
  quarter: string;
  parts: {
    english: string;
    chinese: string;
    emotions: string;
    habits: string;
    together: string;
    math: string;
  };
}

export interface ContentPack {
  id: string;
  title: string;
  english: EnglishWord[];
  chinese: ChinesePack;
  emotions: EmotionItem[];
  habits: HabitItem[];
  together: TogetherPack;
  math: Record<string, MathBandConfig>;
}

export interface LockState {
  reason: "daily" | "session";
  until: number | null;
}

export interface RulePayload {
  rules: ModuleRules;
  ageBand: AgeBandId;
  voiceOn: boolean;
}

export interface MetaFile {
  version: 1;
  iterations: number;
  salt: string;
  wrapIv: string;
  wrappedDek: string;
}

export interface CipherFile {
  iv: string;
  ciphertext: string;
}

export interface RulePackageFile {
  format: "nian-learn-rules";
  version: 1;
  kdf: { name: "PBKDF2"; hash: "SHA-256"; iterations: number; salt: string };
  cipher: "AES-GCM";
  iv: string;
  ciphertext: string;
}
