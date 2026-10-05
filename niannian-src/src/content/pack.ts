import type { Activity, AgeBand, Choice, Round } from "../types";
import { registerSubject } from "../extensions/subjects";

const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十"];

function cn(n: number): string {
  return CN[n] ?? String(n);
}

function near(answer: number): [number, number] {
  const left = answer - 1 >= 0 ? answer - 1 : answer + 2;
  let right = answer + 1 <= 20 ? answer + 1 : answer - 2;
  if (right === left) right = answer + 2 <= 20 ? answer + 2 : answer - 2;
  return [left, right];
}

function arith(a: number, op: "+" | "-", b: number): Round {
  const answer = op === "+" ? a + b : a - b;
  const [w1, w2] = near(answer);
  const speech = `${cn(a)}${op === "+" ? "加" : "减"}${cn(b)}等于多少？`;
  return {
    prompt: speech,
    speech,
    lang: "zh-CN",
    art: `${a} ${op} ${b} = ？`,
    choices: [answer, w1, w2].map((n) => ({ id: `n${n}`, label: String(n), correct: n === answer })),
    explain: `${cn(a)}${op === "+" ? "加" : "减"}${cn(b)}等于${cn(answer)}。`,
  };
}

function logic(prompt: string, art: string, ok: Choice, rest: Choice[], explain: string): Round {
  return {
    prompt,
    speech: prompt,
    lang: "zh-CN",
    art,
    choices: [{ ...ok, correct: true }, ...rest],
    explain,
  };
}

function scene(
  band: AgeBand,
  index: number,
  prompt: string,
  ok: Choice,
  bad: [Choice, Choice],
  explain: string,
): Activity {
  return {
    kind: "rounds",
    id: `${band}-school-${index}`,
    moduleId: "school",
    title: "上学的一天",
    ageBands: [band],
    rounds: [
      {
        prompt,
        speech: prompt,
        lang: "zh-CN",
        choices: [{ ...ok, correct: true }, bad[0], bad[1]],
        explain,
      },
    ],
  };
}

function opt(id: string, label: string, art: string): Choice {
  return { id, label, art };
}

const school56: Activity[] = [
  scene("5-6", 1, "早上起床，先做什么？", opt("brush", "刷牙", "🦷"), [opt("sleep", "继续睡觉", "😴"), opt("run", "跑出门", "🏃")], "起床后先刷牙。"),
  scene("5-6", 2, "去上学，要带什么？", opt("bag", "书包", "🎒"), [opt("pillow", "枕头", "🛏️"), opt("pot", "小锅", "🍲")], "背上书包再出门。"),
  scene("5-6", 3, "见到老师，怎么说？", opt("hi", "老师好", "👋"), [opt("quiet", "不说话", "🤐"), opt("yell", "大叫", "📢")], "看见老师可以说老师好。"),
  scene("5-6", 4, "上课了，怎么做？", opt("sit", "安静坐好", "🪑"), [opt("run", "在教室跑", "🏃"), opt("knock", "敲桌子", "👊")], "上课时安静坐好。"),
  scene("5-6", 5, "想回答问题，怎么做？", opt("hand", "先举手", "✋"), [opt("shout", "抢着喊", "📣"), opt("hide", "不理", "🙈")], "想说话可以先举手。"),
  scene("5-6", 6, "放学了，在哪里等？", opt("door", "在门口等", "🚪"), [opt("far", "走到很远", "🛣️"), opt("box", "躲起来", "📦")], "在约好的地方等家人。"),
  scene("5-6", 7, "吃饭前做什么？", opt("wash", "洗手", "🧼"), [opt("dirty", "用脏手抓", "🤲"), opt("tv", "先看电视", "📺")], "吃饭前先洗手。"),
];

const school78: Activity[] = [
  scene("7-8", 1, "到了教室，书包放哪？", opt("desk", "放在位子上", "🪑"), [opt("floor", "扔在地上", "📦"), opt("hide", "藏起来", "🙈")], "书包放在自己的位子。"),
  scene("7-8", 2, "铅笔怎么收？", opt("box", "放进铅笔盒", "✏️"), [opt("toss", "洒一地", "🌀"), opt("bin", "扔掉", "🗑️")], "笔用完放回盒子。"),
  scene("7-8", 3, "明天要带什么，记在哪？", opt("note", "写在本子上", "📒"), [opt("mind", "只放在心里", "💭"), opt("hand", "写在手上", "✋")], "写在本子上就不容易忘。"),
  scene("7-8", 4, "同学没带橡皮，怎么做？", opt("lend", "借一块", "🤝"), [opt("laugh", "笑话他", "😝"), opt("hide", "藏起自己的", "🙈")], "可以借一块，用完还回去。"),
  scene("7-8", 5, "体育课前做什么？", opt("shoe", "换好鞋子", "👟"), [opt("chase", "在走廊追", "🏃"), opt("skip", "不去", "🚪")], "换好鞋子再去操场。"),
  scene("7-8", 6, "小组一起做事，怎么做？", opt("share", "每人做一点", "🧩"), [opt("all", "一个人全包", "😤"), opt("none", "谁也不做", "🙈")], "每人做一点，事情就完成了。"),
  scene("7-8", 7, "回到家，先做什么？", opt("rest", "喝水再休息", "💧"), [opt("toss", "扔掉书包", "🎒"), opt("play", "不吃饭一直玩", "🎮")], "先喝水，休息一下。"),
];

const school912: Activity[] = [
  scene("9-12", 1, "明天要朗读，今晚怎么安排？", opt("read", "先读一遍", "📖"), [opt("late", "玩到很晚", "🌙"), opt("hide", "把书藏起来", "📦")], "先读一遍，再去做别的。"),
  scene("9-12", 2, "小组海报，怎么开始？", opt("plan", "先说好谁画谁写", "🗣️"), [opt("take", "拿走所有的笔", "✏️"), opt("quit", "不做了", "🚪")], "先商量，再动手。"),
  scene("9-12", 3, "上课没听懂，怎么做？", opt("ask", "下课问老师", "🙋"), [opt("fake", "假装全会", "😶"), opt("blame", "怪同学", "😠")], "没听懂可以下课再问。"),
  scene("9-12", 4, "和同学想法不一样，怎么做？", opt("turn", "轮流说理由", "💬"), [opt("loud", "大声压过别人", "📣"), opt("gone", "生气就走", "🚪")], "轮流说，再一起选。"),
  scene("9-12", 5, "作业有点多，怎么做？", opt("bit", "先做一小部分", "📝"), [opt("night", "全部留到半夜", "🌙"), opt("copy", "拿同学的来抄", "🙈")], "先做一小部分，做完歇一歇。"),
  scene("9-12", 6, "值日的时候，怎么做？", opt("part", "把自己那份做完", "🧹"), [opt("hide", "躲开", "🙈"), opt("boss", "只指挥别人", "📣")], "把自己的那一份做完。"),
  scene("9-12", 7, "第二天有早读，今晚怎么做？", opt("sleep", "早点休息", "🛏️"), [opt("late", "熬到很晚", "🌙"), opt("skip", "完全不看", "🙈")], "看一会儿，早点休息。"),
];

function han(band: AgeBand, rows: [string, string][]): Activity[] {
  return rows.map(([ch, py], index) => {
    const a = rows[(index + 1) % rows.length];
    const b = rows[(index + 2) % rows.length];
    const read: Round = {
      prompt: "这个字读什么？",
      speech: "这个字读什么？",
      lang: "zh-CN",
      art: ch,
      listen: { text: ch, lang: "zh-CN" },
      choices: [
        { id: py, label: py, correct: true },
        { id: a[1], label: a[1] },
        { id: b[1], label: b[1] },
      ],
      explain: `${ch}读作${py}。`,
    };
    const pick: Round = {
      prompt: "哪个字是这个拼音？",
      speech: "哪个字是这个拼音？",
      lang: "zh-CN",
      art: py,
      listen: { text: py, lang: "zh-CN" },
      choices: [
        { id: ch, label: ch, correct: true },
        { id: a[0], label: a[0] },
        { id: b[0], label: b[0] },
      ],
      explain: `${py}是${ch}。`,
    };
    return {
      kind: "rounds",
      id: `${band}-zh-${index + 1}`,
      moduleId: "chinese",
      title: "拼音识字",
      ageBands: [band],
      rounds: [read, pick],
    };
  });
}

function word(band: AgeBand, index: number, wordText: string, emoji: string, zh: string, alts: string[]): Activity {
  const round: Round = {
    prompt: "听一听，点图片",
    speech: "听一听，点图片",
    lang: "zh-CN",
    art: wordText,
    listen: { text: wordText, lang: "en-US" },
    choices: [
      { id: wordText, art: emoji, label: "", correct: true },
      ...alts.map((art, i) => ({ id: `alt${i}`, art, label: "" })),
    ],
    explain: `${wordText} 是${zh}。`,
    follow: { speech: wordText, lang: "en-US", show: `${wordText} · ${zh}` },
  };
  return {
    kind: "rounds",
    id: `${band}-en-${index}`,
    moduleId: "english",
    title: "听音选图",
    ageBands: [band],
    rounds: [round],
  };
}

function enSet(band: AgeBand, rows: [string, string, string][]): Activity[] {
  return rows.map(([text, emoji, zh], index) => {
    const a = rows[(index + 1) % rows.length][1];
    const b = rows[(index + 2) % rows.length][1];
    return word(band, index + 1, text, emoji, zh, [a, b]);
  });
}

function mathPair(band: AgeBand, index: number, first: Round, second: Round): Activity {
  return {
    kind: "rounds",
    id: `${band}-math-${index}`,
    moduleId: "math",
    title: "加减和规律",
    ageBands: [band],
    rounds: [first, second],
  };
}

const math56: Activity[] = [
  mathPair("5-6", 1, arith(1, "+", 2), logic("后面该是什么？", "⭐🌙⭐🌙？", opt("star", "星星", "⭐"), [opt("moon", "月亮", "🌙"), opt("cloud", "云", "☁️")], "一个隔一个，下一个是星星。")),
  mathPair("5-6", 2, arith(3, "+", 2), logic("哪个不一样？", "🍎🍌🚗", opt("car", "汽车", "🚗"), [opt("apple", "苹果", "🍎"), opt("banana", "香蕉", "🍌")], "汽车不是水果。")),
  mathPair("5-6", 3, arith(4, "+", 1), logic("后面该是什么？", "🔴🔵🔴🔵？", opt("red", "红色", "🔴"), [opt("blue", "蓝色", "🔵"), opt("green", "绿色", "🟢")], "红蓝红蓝，下一个是红色。")),
  mathPair("5-6", 4, arith(5, "-", 2), logic("后面该是什么？", "🐱🐶🐱🐶？", opt("cat", "猫", "🐱"), [opt("dog", "狗", "🐶"), opt("fish", "鱼", "🐟")], "猫狗猫狗，下一个是猫。")),
  mathPair("5-6", 5, arith(3, "+", 3), logic("哪个是文具？", "✏️🍎⚽", opt("pen", "铅笔", "✏️"), [opt("apple", "苹果", "🍎"), opt("ball", "球", "⚽")], "铅笔是文具。")),
  mathPair("5-6", 6, arith(6, "-", 2), logic("后面该是什么？", "大小大小？", opt("big", "大", "大"), [opt("small", "小", "小"), opt("mid", "中", "中")], "大小大小，下一个是大。")),
  mathPair("5-6", 7, arith(4, "+", 2), logic("后面该是什么？", "1 2 1 2 ？", opt("one", "1", "1"), [opt("two", "2", "2"), opt("three", "3", "3")], "一二一二，下一个是一。")),
];

const math78: Activity[] = [
  mathPair("7-8", 1, arith(9, "+", 7), logic("后面该是什么？", "2、4、6、8、？", opt("ten", "10", "10"), [opt("nine", "9", "9"), opt("twelve", "12", "12")], "每次加二，下一个是十。")),
  mathPair("7-8", 2, arith(15, "-", 6), logic("哪个不会飞？", "🐦✈️🐟", opt("fish", "鱼", "🐟"), [opt("bird", "鸟", "🐦"), opt("plane", "飞机", "✈️")], "鱼在水里，不会飞。")),
  mathPair("7-8", 3, arith(8, "+", 8), logic("后面该是什么？", "🔺🔵🔺🔵？", opt("tri", "三角", "🔺"), [opt("dot", "圆点", "🔵"), opt("star", "星", "⭐")], "三角和圆点轮流，下一个是三角。")),
  mathPair("7-8", 4, arith(12, "-", 4), logic("哪个是车？", "🚌📚🏠", opt("bus", "巴士", "🚌"), [opt("book", "书", "📚"), opt("house", "房子", "🏠")], "巴士是车。")),
  mathPair("7-8", 5, arith(7, "+", 9), logic("后面该是什么？", "5、10、15、？", opt("twenty", "20", "20"), [opt("sixteen", "16", "16"), opt("twentyfive", "25", "25")], "每次加五，下一个是二十。")),
  mathPair("7-8", 6, arith(18, "-", 9), logic("后面该是什么？", "春、夏、秋、？", opt("winter", "冬", "冬"), [opt("spring", "春", "春"), opt("day", "日", "日")], "春夏秋冬，下一个是冬。")),
  mathPair("7-8", 7, arith(6, "+", 13), logic("后面该是什么？", "方圆方圆？", opt("fang", "方", "方"), [opt("yuan", "圆", "圆"), opt("star", "星", "⭐")], "方圆方圆，下一个是方。")),
];

const miss = (prompt: string, art: string, answer: number, wrongs: number[], explain: string): Round => ({
  prompt,
  speech: prompt,
  lang: "zh-CN",
  art,
  choices: [answer, ...wrongs].map((n) => ({ id: `n${n}`, label: String(n), correct: n === answer })),
  explain,
});

const math912: Activity[] = [
  mathPair("9-12", 1, miss("几加六等于十四？", "? + 6 = 14", 8, [7, 9], "八加六等于十四。"), logic("后面该是什么？", "3、6、9、？", opt("twelve", "12", "12"), [opt("ten", "10", "10"), opt("fifteen", "15", "15")], "每次加三，下一个是十二。")),
  mathPair("9-12", 2, arith(20, "-", 7), logic("哪个是交通工具？", "🚲📚🥄", opt("bike", "自行车", "🚲"), [opt("book", "书", "📚"), opt("spoon", "勺子", "🥄")], "自行车是交通工具。")),
  mathPair("9-12", 3, arith(11, "+", 8), logic("后面该是什么？", "🔺🔺🔵🔺🔺🔵？", opt("tri", "三角", "🔺"), [opt("dot", "圆点", "🔵"), opt("star", "星", "⭐")], "两个三角、一个圆点，下一个是三角。")),
  mathPair("9-12", 4, arith(16, "-", 8), logic("哪个是季节？", "春天  苹果  铅笔", opt("spring", "春天", "春天"), [opt("apple", "苹果", "苹果"), opt("pen", "铅笔", "铅笔")], "春天是季节。")),
  mathPair("9-12", 5, miss("几加五等于十二？", "? + 5 = 12", 7, [6, 8], "七加五等于十二。"), logic("后面该是什么？", "10、8、6、？", opt("four", "4", "4"), [opt("five", "5", "5"), opt("two", "2", "2")], "每次减二，下一个是四。")),
  mathPair("9-12", 6, arith(17, "-", 9), logic("哪个不在天上？", "🐦🐟✈️", opt("fish", "鱼", "🐟"), [opt("bird", "鸟", "🐦"), opt("plane", "飞机", "✈️")], "鱼不在天上。")),
  mathPair("9-12", 7, arith(9, "+", 9), logic("后面该是什么？", "白天、黑夜、白天、黑夜、？", opt("day", "白天", "白天"), [opt("night", "黑夜", "黑夜"), opt("noon", "中午", "中午")], "白天黑夜轮流，下一个是白天。")),
];

const en56 = enSet("5-6", [
  ["cat", "🐱", "猫"],
  ["dog", "🐶", "狗"],
  ["book", "📘", "书"],
  ["apple", "🍎", "苹果"],
  ["sun", "☀️", "太阳"],
  ["water", "💧", "水"],
  ["milk", "🥛", "牛奶"],
]);

const en78 = enSet("7-8", [
  ["bird", "🐦", "鸟"],
  ["fish", "🐟", "鱼"],
  ["school", "🏫", "学校"],
  ["pen", "✏️", "笔"],
  ["friend", "🧒", "朋友"],
  ["family", "👨‍👩‍👧", "家人"],
  ["moon", "🌙", "月亮"],
]);

const en912 = enSet("9-12", [
  ["Good morning", "🌅", "早上好"],
  ["Thank you", "🙏", "谢谢"],
  ["Let's read", "📖", "我们读书"],
  ["Good night", "🌙", "晚安"],
  ["How are you", "😊", "你好吗"],
  ["I like milk", "🥛", "我喜欢牛奶"],
  ["See you", "👋", "再见"],
]);

const zh56 = han("5-6", [
  ["妈", "mā"],
  ["爸", "bà"],
  ["水", "shuǐ"],
  ["火", "huǒ"],
  ["山", "shān"],
  ["日", "rì"],
  ["月", "yuè"],
]);

const zh78 = han("7-8", [
  ["人", "rén"],
  ["口", "kǒu"],
  ["手", "shǒu"],
  ["天", "tiān"],
  ["木", "mù"],
  ["土", "tǔ"],
  ["大", "dà"],
]);

const zh912 = han("9-12", [
  ["学", "xué"],
  ["校", "xiào"],
  ["明", "míng"],
  ["林", "lín"],
  ["花", "huā"],
  ["草", "cǎo"],
  ["风", "fēng"],
]);

const emotionPrompts = [
  "今天感觉怎么样？",
  "选一个像现在的脸。",
  "你现在是什么心情？",
  "点一个最像的表情。",
  "心情没有对错，选一个吧。",
  "小星想听你的感觉。",
  "选一张脸，我们说说。",
];

function emotion(
  band: AgeBand,
  lines: { happy: [string, string]; sad: [string, string]; angry: [string, string]; scared: [string, string] },
): Activity {
  const map = {
    happy: { id: "happy", label: "开心", emoji: "😊" },
    sad: { id: "sad", label: "难过", emoji: "😢" },
    angry: { id: "angry", label: "生气", emoji: "😠" },
    scared: { id: "scared", label: "害怕", emoji: "😟" },
  } as const;
  return {
    kind: "emotion",
    id: `${band}-emotion`,
    moduleId: "emotion",
    title: "说说感觉",
    ageBands: [band],
    prompts: emotionPrompts,
    emotions: (Object.keys(map) as (keyof typeof map)[]).map((key) => ({
      ...map[key],
      soothe: lines[key][0],
      action: lines[key][1],
    })),
  };
}

const habits: Activity = {
  kind: "habits",
  id: "habits-week",
  moduleId: "habits",
  title: "今日习惯",
  ageBands: ["5-6", "7-8", "9-12"],
  tips: [
    "刷刷牙，牙齿亮晶晶。",
    "打开一本书，看一页就好。",
    "喝一小口水吧。",
    "牙刷用完，放回杯子。",
    "读书时用手指点一行。",
    "水杯空了，可以再接一点。",
    "做完一件小事，点点头。",
  ],
  items: [
    { id: "brush", label: "刷牙", emoji: "🦷" },
    { id: "read", label: "阅读", emoji: "📖" },
    { id: "water", label: "喝水", emoji: "💧" },
  ],
};

function together(band: AgeBand, lines: string[]): Activity[] {
  return lines.map((prompt, index) => ({
    kind: "together" as const,
    id: `${band}-together-${index + 1}`,
    moduleId: "together" as const,
    title: "和家人一起",
    ageBands: [band],
    prompt,
    speech: prompt,
    detail: "做完了，请家长来确认。",
  }));
}

const togetherYoung = together("5-6", [
  "和家人一起指出三样红色的东西。",
  "和家人一起读一页书。",
  "和家人一起把玩具送回原处。",
  "和家人一起轻轻拍手数到五。",
  "和家人一起说一件今天高兴的小事。",
  "和家人一起看窗外，找一朵云或一棵树。",
  "和家人一起看一眼明天的书包。",
]).map((item) => ({ ...item, ageBands: ["5-6", "7-8"] as AgeBand[] }));

const togetherOlder = together("9-12", [
  "和家人一起把书桌收拾整齐。",
  "和家人一起读一页，说出一个新词。",
  "和家人一起商量明天第一件要做的事。",
  "和家人一起听一首歌，说说你的心情。",
  "和家人一起走一走，数一数看到几种绿色。",
  "和家人一起回忆今天帮过别人的一件小事。",
  "和家人一起看看铅笔和水杯在不在书包里。",
]);

registerSubject({ id: "school", title: "幼小衔接", blurb: "上学的一天", emoji: "🏫", tone: "leaf" }, [...school56, ...school78, ...school912]);
registerSubject({ id: "chinese", title: "语文", blurb: "拼音和识字", emoji: "字", tone: "coral" }, [...zh56, ...zh78, ...zh912]);
registerSubject({ id: "math", title: "数学", blurb: "加减和找规律", emoji: "＋", tone: "orange" }, [...math56, ...math78, ...math912]);
registerSubject({ id: "english", title: "英语", blurb: "听一听，点图片", emoji: "A", tone: "blue" }, [...en56, ...en78, ...en912]);
registerSubject(
  { id: "emotion", title: "情绪", blurb: "给感受起个名字", emoji: "😊", tone: "grape" },
  [
    emotion("5-6", {
      happy: ["你现在是开心。可以跳一跳。", "跳一跳"],
      sad: ["你现在是难过。可以抱一抱。", "抱一抱"],
      angry: ["你现在是生气。先慢慢吹气。", "慢慢吹气"],
      scared: ["你现在是害怕。可以靠一靠家人。", "靠一靠"],
    }),
    emotion("7-8", {
      happy: ["你现在是开心。把高兴分一点给旁边的人。", "跳一跳"],
      sad: ["你现在是难过。难过的时候可以抱一抱软的东西。", "抱一抱"],
      angry: ["你现在是生气。离开吵的地方，慢慢吹气。", "慢慢吹气"],
      scared: ["你现在是害怕。可以靠在家人身边。", "靠一靠"],
    }),
    emotion("9-12", {
      happy: ["你现在是开心。开心可以留一分钟，再去做下一件事。", "跳一跳"],
      sad: ["你现在是难过。难过也会过去，可以先抱一抱，再喝口水。", "抱一抱"],
      angry: ["你现在是生气。先不说话，慢慢吹完一口气。", "慢慢吹气"],
      scared: ["你现在是害怕。可以说出来，再靠一靠信任的人。", "靠一靠"],
    }),
  ],
);
registerSubject({ id: "habits", title: "习惯", blurb: "今天的小事", emoji: "★", tone: "sun" }, [habits]);
registerSubject({ id: "together", title: "亲子", blurb: "和家人一起", emoji: "🤝", tone: "sky" }, [...togetherYoung, ...togetherOlder]);
