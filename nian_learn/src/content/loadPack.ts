import type {
  ChinesePack,
  ContentPack,
  EmotionItem,
  EnglishWord,
  HabitItem,
  MathBandConfig,
  PackManifest,
  TogetherPack,
} from "../types";
import { readPackCache, writePackCache } from "../lib/storage";
import manifestJson from "./packs/2026-q4/manifest.json";
import englishJson from "./packs/2026-q4/english.json";
import chineseJson from "./packs/2026-q4/chinese.json";
import emotionsJson from "./packs/2026-q4/emotions.json";
import habitsJson from "./packs/2026-q4/habits.json";
import togetherJson from "./packs/2026-q4/together.json";
import mathJson from "./packs/2026-q4/math.json";

const PACK_ID = /^[0-9]{4}-q[1-4]$/;

interface CacheShape {
  packId: string;
  pack: ContentPack;
}

function bundledPack(): ContentPack {
  return assemble("2026-q4", manifestJson.title, {
    english: englishJson as EnglishWord[],
    chinese: chineseJson as unknown as ChinesePack,
    emotions: emotionsJson as EmotionItem[],
    habits: habitsJson as HabitItem[],
    together: togetherJson as TogetherPack,
    math: mathJson as Record<string, MathBandConfig>,
  });
}

function assemble(
  id: string,
  title: string,
  parts: Omit<ContentPack, "id" | "title">,
): ContentPack {
  const pack: ContentPack = { id, title, ...parts };
  assertPack(pack);
  return pack;
}

export function assertPack(pack: ContentPack): void {
  if (!pack.english || pack.english.length < 24) throw new Error("英语内容不足 24 个词");
  if (!pack.chinese?.characters || pack.chinese.characters.length < 20) throw new Error("汉字不足 20 个");
  const groups = new Set(pack.chinese.pinyin.map((item) => item.group));
  const need = ["声母", "韵母", "整体认读"] as const;
  for (const name of need) {
    if (!groups.has(name)) throw new Error(`拼音缺少${name}`);
  }
  if (!pack.emotions?.length || !pack.habits?.length || !pack.together) throw new Error("内容包不完整");
  if (!pack.math?.pre || !pack.math?.g1) throw new Error("数学难度缺少学前或一年级");
}

async function readCurrentId(): Promise<string> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}content/packs/current.json`, { cache: "no-store" });
    if (!res.ok) return "2026-q4";
    const json = (await res.json()) as { packId?: string };
    if (json.packId && PACK_ID.test(json.packId)) return json.packId;
  } catch {
    /* 离线时用内置季度包 */
  }
  return "2026-q4";
}

async function fetchPack(packId: string): Promise<ContentPack> {
  if (!PACK_ID.test(packId)) throw new Error("内容包编号不正确");
  const base = `${import.meta.env.BASE_URL}content/packs/${packId}/`;
  const manifest = (await (await fetch(`${base}manifest.json`)).json()) as PackManifest;
  if (!manifest?.parts) throw new Error("内容包清单不完整");
  const load = async <T>(file: string): Promise<T> => {
    const res = await fetch(`${base}${file}`);
    if (!res.ok) throw new Error(`缺少 ${file}`);
    return (await res.json()) as T;
  };
  return assemble(manifest.id || packId, manifest.title || packId, {
    english: await load<EnglishWord[]>(manifest.parts.english),
    chinese: await load<ChinesePack>(manifest.parts.chinese),
    emotions: await load<EmotionItem[]>(manifest.parts.emotions),
    habits: await load<HabitItem[]>(manifest.parts.habits),
    together: await load<TogetherPack>(manifest.parts.together),
    math: await load<Record<string, MathBandConfig>>(manifest.parts.math),
  });
}

/** 读取当季内容包。换季时改 current.json 的 packId，或直接调用并传入编号。 */
export async function loadContentPack(packId?: string): Promise<ContentPack> {
  const id = packId && PACK_ID.test(packId) ? packId : await readCurrentId();
  try {
    const pack = await fetchPack(id);
    writePackCache({ packId: id, pack } satisfies CacheShape);
    return pack;
  } catch {
    const cached = readPackCache<CacheShape>();
    if (cached?.packId === id && cached.pack) {
      assertPack(cached.pack);
      return cached.pack;
    }
    if (id === "2026-q4") return bundledPack();
    if (cached?.pack) {
      assertPack(cached.pack);
      return cached.pack;
    }
    return bundledPack();
  }
}

export function bundledPackIds(): string[] {
  return ["2026-q4"];
}
