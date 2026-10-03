/** 4-player 飞行棋. 15×15 cross, 52-track, 6-cell home stretch, 4 planes. */
export const COLORS = ["red", "blue", "yellow", "green"];
export const NAMES = { red: "年年", blue: "小星", yellow: "小芽", green: "小月" };
export const COLOR_ZH = { red: "红", blue: "蓝", yellow: "黄", green: "绿" };
export const NEXT = { red: "blue", blue: "yellow", yellow: "green", green: "red" };
export const GOAL = 57;

/** row, col. Row 0 is the top. Shared track, clockwise. */
export const PATH = [
  [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7], [0, 8], [1, 8], [2, 8], [3, 8], [4, 8],
  [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13],
  [6, 14], [7, 14], [8, 14], [8, 13], [8, 12], [8, 11],
  [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8],
  [13, 8], [14, 8], [14, 7], [14, 6], [13, 6], [12, 6],
  [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3],
  [8, 2], [8, 1], [8, 0], [7, 0]
];

export const START = { red: 0, blue: 13, yellow: 26, green: 39 };
export const SAFE = new Set([0, 13, 26, 39]);

/** Six colored squares into the middle. Index 5 touches the center. Progress 57 lands there. */
export const HOME = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  blue: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  green: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]]
};

export const YARD = {
  red: [[2, 2], [2, 4], [4, 2], [4, 4]],
  blue: [[2, 10], [2, 12], [4, 10], [4, 12]],
  yellow: [[10, 10], [10, 12], [12, 10], [12, 12]],
  green: [[10, 2], [10, 4], [12, 2], [12, 4]]
};

export const CENTER = [7, 7];

export function freshPieces() {
  return { red: [-1, -1, -1, -1], blue: [-1, -1, -1, -1], yellow: [-1, -1, -1, -1], green: [-1, -1, -1, -1] };
}

export function absIndex(color, pos) {
  if (pos < 0 || pos > 51) return -1;
  return (START[color] + pos) % 52;
}

export function cellOf(color, pos, index) {
  if (pos < 0) return YARD[color][index];
  if (pos <= 51) return PATH[absIndex(color, pos)];
  if (pos <= GOAL) return HOME[color][pos - 52];
  return CENTER;
}

export function legalMoves(pieces, color, roll) {
  const mine = pieces[color];
  const moves = [];
  mine.forEach((pos, index) => {
    if (pos === GOAL) return;
    if (pos < 0) {
      if (roll === 6) moves.push({ index, to: 0, launch: true, finish: false });
      return;
    }
    const to = pos + roll;
    if (to > GOAL) return;
    moves.push({ index, to, launch: false, finish: to === GOAL });
  });
  return moves;
}

export function applyMove(pieces, color, move) {
  const next = {};
  for (const c of COLORS) next[c] = pieces[c].slice();
  next[color][move.index] = move.to;
  let captured = 0;
  if (move.to <= 51) {
    const land = absIndex(color, move.to);
    if (!SAFE.has(land)) {
      const [lr, lc] = PATH[land];
      for (const c of COLORS) {
        if (c === color) continue;
        next[c] = next[c].map((p) => {
          if (p < 0 || p > 51) return p;
          const [r, col] = PATH[absIndex(c, p)];
          if (r === lr && col === lc) {
            captured += 1;
            return -1;
          }
          return p;
        });
      }
    }
  }
  const winner = next[color].every((p) => p === GOAL) ? color : "";
  return { pieces: next, captured, winner };
}

export function scoreMove(pieces, color, move) {
  const after = applyMove(pieces, color, move);
  let score = move.to * 3;
  if (move.launch) score += 80;
  if (move.finish) score += 1000;
  score += after.captured * 240;
  return score;
}

export function chooseMove(pieces, color, moves, rand = Math.random) {
  const ranked = moves.map((move) => ({ move, score: scoreMove(pieces, color, move) + rand() }));
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0].move;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function reduceMotion() {
  return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

export function mountLudo(root, host) {
  let pieces = freshPieces();
  let turn = "red";
  let roll = 0;
  let phase = "roll";
  let moves = [];
  let bonus = false;
  let busy = false;
  let winner = "";
  let status = "你是红色，左上机库。点「掷骰子」。";
  let ended = false;
  const key = (r, c) => `${r},${c}`;

  const cellMap = () => {
    const map = new Map();
    const put = (r, c, kind) => {
      const id = key(r, c);
      const prev = map.get(id);
      map.set(id, prev ? { ...prev, ...kind } : { r, c, ...kind });
    };
    for (let r = 0; r < 6; r += 1) for (let c = 0; c < 6; c += 1) put(r, c, { base: "red" });
    for (let r = 0; r < 6; r += 1) for (let c = 9; c < 15; c += 1) put(r, c, { base: "blue" });
    for (let r = 9; r < 15; r += 1) for (let c = 9; c < 15; c += 1) put(r, c, { base: "yellow" });
    for (let r = 9; r < 15; r += 1) for (let c = 0; c < 6; c += 1) put(r, c, { base: "green" });
    PATH.forEach(([r, c], i) => put(r, c, { track: true, safe: SAFE.has(i), start: Object.entries(START).find(([, v]) => v === i)?.[0] || "" }));
    for (const color of COLORS) HOME[color].forEach(([r, c]) => put(r, c, { home: color }));
    put(CENTER[0], CENTER[1], { center: true });
    return map;
  };
  const cells = cellMap();

  const destKey = (color, move) => {
    const [r, c] = cellOf(color, move.to, move.index);
    return key(r, c);
  };

  const paint = () => {
    const dest = new Set(phase === "pick" && turn === "red" ? moves.map((m) => destKey("red", m)) : []);
    const movable = new Set(phase === "pick" && turn === "red" ? moves.map((m) => m.index) : []);
    const occ = new Map();
    for (const color of COLORS) {
      pieces[color].forEach((pos, index) => {
        const [r, c] = cellOf(color, pos, index);
        const id = key(r, c);
        if (!occ.has(id)) occ.set(id, []);
        occ.get(id).push({ color, index, pos });
      });
    }
    const buttons = [];
    for (let r = 0; r < 15; r += 1) {
      for (let c = 0; c < 15; c += 1) {
        const info = cells.get(key(r, c));
        if (!info) {
          buttons.push(`<i class="lu-gap" style="grid-row:${r + 1};grid-column:${c + 1}"></i>`);
          continue;
        }
        const cls = ["lu-cell"];
        if (info.base) cls.push(`base-${info.base}`);
        if (info.track) cls.push("track");
        if (info.home) cls.push(`home-${info.home}`);
        if (info.center) cls.push("center");
        if (info.start) cls.push(`start-${info.start}`);
        if (info.safe) cls.push("safe");
        if (dest.has(key(r, c))) cls.push("hint");
        const piles = (occ.get(key(r, c)) || []).map((p) => {
          const on = p.color === "red" && movable.has(p.index) ? " can" : "";
          return `<button class="lu-piece ${p.color}${on}" data-fun="piece" data-color="${p.color}" data-i="${p.index}" aria-label="${NAMES[p.color]}的飞机">✈</button>`;
        }).join("");
        const core = info.center ? `<span class="lu-core">家</span>` : "";
        buttons.push(`<div class="${cls.join(" ")}" style="grid-row:${r + 1};grid-column:${c + 1}" data-fun="cell" data-r="${r}" data-c="${c}">${core}${piles}</div>`);
      }
    }
    const seats = COLORS.map((color) => {
      const home = pieces[color].filter((p) => p === GOAL).length;
      const out = pieces[color].filter((p) => p >= 0 && p < GOAL).length;
      return `<div class="lu-seat ${color} ${turn === color && !winner ? "now" : ""}"><b>${esc(NAMES[color])}</b><small>${esc(COLOR_ZH[color])} · 在飞 ${out} · 到家 ${home}/4</small></div>`;
    }).join("");
    const result = winner
      ? `<div class="fun-result"><h2>${winner === "red" ? "四架都到家啦！" : esc(NAMES[winner]) + "先到家"}</h2><p>${winner === "red" ? "你赢了。十字棋盘走完一整圈，再沿同色格子进中间。" : "下次掷到 6 就能起飞。"}</p><button class="btn primary wide" data-fun="lobby">回乐园</button></div>`
      : "";
    const canRoll = !winner && !busy && turn === "red" && phase === "roll";
    root.innerHTML = `<div class="fun-live ludo-live" data-ludo="board" data-players="4" data-track="52">
      <div class="fun-top">
        <button class="icon-btn" data-fun="exit" aria-label="结束这局">回</button>
        <h2>飞行棋</h2>
        <span class="pill">${turn === "red" ? "你的回合" : esc(NAMES[turn])}</span>
      </div>
      <p class="fun-status">${esc(status)}</p>
      <div class="lu-seats">${seats}</div>
      <div class="board-3d"><div class="ludo4 tilt">${buttons.join("")}</div></div>
      <div class="ddz-actions">
        <button class="btn primary" data-fun="roll" ${canRoll ? "" : "disabled"}>掷骰子${roll ? " " + roll : ""}</button>
        <button class="btn" data-fun="hint" ${phase === "pick" && turn === "red" && !busy ? "" : "disabled"}>提示</button>
      </div>
      <p class="fun-note">四个人，四架飞机。掷到 6 才能从机库起飞，也能再掷一次。踩到别人就送回家。带星的停机坪不能抓。要刚好走进中间。只记星星，不玩钱。</p>
      ${result}
    </div>`;
  };

  const finish = (who) => {
    winner = who;
    busy = false;
    phase = "done";
    if (ended) return;
    ended = true;
    if (who === "red") host.onWin();
    else host.onLose();
    host.audio && host.audio.play(who === "red" ? "fan" : "bad");
    paint();
  };

  const armTurn = (color) => {
    turn = color;
    bonus = false;
    roll = 0;
    moves = [];
    phase = "roll";
    busy = false;
  };

  const afterHumanGate = () => {
    if (!host.alive() || winner) return;
    if (turn === "red") {
      status = phase === "roll" ? (bonus ? "又掷到机会了，再掷一次" : "点「掷骰子」") : status;
      paint();
      return;
    }
    runAI();
  };

  const resolveRoll = (color, value) => {
    roll = value;
    const options = legalMoves(pieces, color, value);
    if (!options.length) {
      status = `${NAMES[color]}掷了 ${value}，这下走不了`;
      armTurn(NEXT[color]);
      paint();
      host.later(afterHumanGate, reduceMotion() ? 80 : 700);
      return;
    }
    if (color !== "red") {
      const move = chooseMove(pieces, color, options);
      commit(color, move, value);
      return;
    }
    moves = options;
    phase = "pick";
    busy = false;
    status = options.length > 1 ? `掷出 ${value}。点一架亮起来的飞机` : `掷出 ${value}。点亮起来的飞机`;
    host.audio && host.audio.play("tap");
    paint();
  };

  const commit = (color, move, value) => {
    const before = pieces[color][move.index];
    const applied = applyMove(pieces, color, move);
    pieces = applied.pieces;
    moves = [];
    phase = "roll";
    if (applied.winner) {
      status = color === "red" ? "四架飞机都到中间啦" : `${NAMES[color]}的飞机都到家了`;
      paint();
      finish(applied.winner);
      return;
    }
    const extra = value === 6 && !bonus;
    let line = move.launch ? `${NAMES[color]}起飞了` : move.finish ? `${NAMES[color]}有一架到家` : `${NAMES[color]}飞了 ${value} 格`;
    if (applied.captured) line += "，把别人送回家";
    if (extra) {
      bonus = true;
      roll = 0;
      busy = false;
      status = `${line}。掷到 6，可以再掷一次`;
      host.audio && host.audio.play(color === "red" ? "ok" : "tap");
      paint();
      if (color === "red") return;
      host.later(() => runAI(), reduceMotion() ? 80 : 650);
      return;
    }
    status = line;
    armTurn(NEXT[color]);
    host.audio && host.audio.play(color === "red" ? "ok" : "tap");
    paint();
    host.later(afterHumanGate, reduceMotion() ? 80 : 650);
    void before;
  };

  const runAI = () => {
    if (!host.alive() || winner || turn === "red") return;
    busy = true;
    const color = turn;
    status = `${NAMES[color]}在掷骰子`;
    paint();
    host.later(() => {
      if (!host.alive() || winner || turn !== color) return;
      const value = 1 + Math.floor(Math.random() * 6);
      busy = false;
      resolveRoll(color, value);
    }, reduceMotion() ? 60 : 520);
  };

  const rollHuman = () => {
    if (winner || busy || turn !== "red" || phase !== "roll") return;
    busy = true;
    status = "骰子在转";
    paint();
    host.later(() => {
      if (!host.alive() || winner) return;
      const value = 1 + Math.floor(Math.random() * 6);
      busy = false;
      resolveRoll("red", value);
    }, reduceMotion() ? 40 : 420);
  };

  root.onclick = (event) => {
    const node = event.target.closest("[data-fun]");
    if (!node || !host.alive()) return;
    const act = node.dataset.fun;
    if (act === "exit" || act === "lobby") {
      host.onExit();
      return;
    }
    if (winner || busy) return;
    if (act === "roll") {
      rollHuman();
      return;
    }
    if (act === "hint" && phase === "pick") {
      const best = chooseMove(pieces, "red", moves);
      const [r, c] = cellOf("red", best.to, best.index);
      status = `提示：走第 ${best.index + 1} 架，落到闪着的格子`;
      moves = [best];
      paint();
      const cell = root.querySelector(`[data-r="${r}"][data-c="${c}"]`);
      if (cell) cell.classList.add("hint");
      return;
    }
    if (turn !== "red" || phase !== "pick") return;
    if (act === "piece" && node.dataset.color === "red") {
      const index = Number(node.dataset.i);
      const found = moves.filter((m) => m.index === index);
      if (found.length === 1) commit("red", found[0], roll);
      return;
    }
    if (act === "cell") {
      const id = key(Number(node.dataset.r), Number(node.dataset.c));
      const found = moves.filter((m) => destKey("red", m) === id);
      if (found.length === 1) commit("red", found[0], roll);
      else if (found.length > 1) {
        status = "这格有两架都能进，请点飞机";
        paint();
      }
    }
  };

  paint();
}
