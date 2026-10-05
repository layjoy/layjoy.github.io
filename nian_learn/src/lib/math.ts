import type { MathBandConfig } from "../types";

export interface MathOption {
  id: string;
  label: string;
  emoji?: string;
  correct: boolean;
}

export interface MathQuestion {
  kind: "add" | "sub" | "cmp" | "pattern" | "class";
  prompt: string;
  speak: string;
  options: MathOption[];
}

const ANIMALS = [
  { label: "小猫", emoji: "🐱" },
  { label: "小狗", emoji: "🐶" },
  { label: "小鸟", emoji: "🐦" },
  { label: "小鱼", emoji: "🐟" },
];

const THINGS = [
  { label: "书", emoji: "📘" },
  { label: "球", emoji: "⚽" },
  { label: "杯子", emoji: "🥤" },
  { label: "帽子", emoji: "🎩" },
];

function randInt(random: () => number, min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function numberOptions(answer: number, count: number, random: () => number, min: number, max: number): MathOption[] {
  const values = new Set<number>([answer]);
  let guard = 0;
  while (values.size < count && guard < 40) {
    guard += 1;
    values.add(randInt(random, min, Math.max(min, max)));
  }
  let extra = 1;
  while (values.size < count) {
    values.add(answer + extra);
    extra += 1;
  }
  return shuffle([...values], random).map((n) => ({
    id: `n-${n}`,
    label: String(n),
    correct: n === answer,
  }));
}

function makeAdd(band: MathBandConfig, random: () => number): MathQuestion {
  const a = randInt(random, 0, band.max);
  const b = randInt(random, 0, band.max - a);
  const answer = a + b;
  return {
    kind: "add",
    prompt: `${a} + ${b}`,
    speak: `${a} 加 ${b} 等于多少`,
    options: numberOptions(answer, band.choices, random, 0, band.max),
  };
}

function makeSub(band: MathBandConfig, random: () => number): MathQuestion {
  const a = randInt(random, 0, band.max);
  const b = randInt(random, 0, a);
  const answer = a - b;
  return {
    kind: "sub",
    prompt: `${a} - ${b}`,
    speak: `${a} 减 ${b} 等于多少`,
    options: numberOptions(answer, band.choices, random, 0, band.max),
  };
}

function makeCompare(band: MathBandConfig, random: () => number): MathQuestion {
  let a = randInt(random, 0, band.max);
  let b = randInt(random, 0, band.max);
  if (a === b) b = a === band.max ? a - 1 : a + 1;
  const bigger = Math.max(a, b);
  return {
    kind: "cmp",
    prompt: "点大的那个",
    speak: `${a} 和 ${b}，哪个大`,
    options: shuffle(
      [a, b].map((n) => ({ id: `c-${n}-${a}-${b}`, label: String(n), correct: n === bigger })),
      random,
    ),
  };
}

function makePattern(band: MathBandConfig, random: () => number): MathQuestion {
  const step = randInt(random, 1, band.max >= 20 ? 3 : 2);
  const startMax = Math.max(0, band.max - step * 3);
  const start = randInt(random, 0, startMax);
  const seq = [start, start + step, start + step * 2];
  const answer = start + step * 3;
  return {
    kind: "pattern",
    prompt: `${seq.join("、")}、？`,
    speak: "后面该是几",
    options: numberOptions(answer, band.choices, random, 0, Math.max(band.max, answer)),
  };
}

function makeClass(band: MathBandConfig, random: () => number): MathQuestion {
  const size = band.max >= 20 ? 4 : 3;
  const sameCount = size - 1;
  const same = shuffle(ANIMALS, random).slice(0, sameCount);
  const odd = shuffle(THINGS, random)[0];
  const options = shuffle(
    [
      ...same.map((item) => ({ ...item, correct: false })),
      { ...odd, correct: true },
    ],
    random,
  ).map((item, index) => ({
    id: `k-${index}-${item.label}`,
    label: item.label,
    emoji: item.emoji,
    correct: item.correct,
  }));
  return {
    kind: "class",
    prompt: "点不一样的",
    speak: "点不一样的那个",
    options,
  };
}

export function makeQuestion(band: MathBandConfig, random: () => number = Math.random): MathQuestion {
  const kinds = [makeAdd, makeSub, makeCompare, makePattern, makeClass];
  const maker = kinds[randInt(random, 0, kinds.length - 1)];
  return maker(band, random);
}
