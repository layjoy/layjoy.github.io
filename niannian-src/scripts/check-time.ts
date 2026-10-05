import { blockReason, dayIndex, inWindows } from "../src/rules/time.ts";

function assert(ok: boolean, message: string): void {
  if (!ok) {
    console.error(message);
    process.exit(1);
  }
}

const night = new Date(2026, 9, 5, 0, 24);
assert(inWindows(night, [{ start: "00:00", end: "23:59" }]), "全天应可玩");
assert(blockReason(night, { windows: [{ start: "03:00", end: "03:20" }], dailyMinutes: 40 }, 0) === "window", "时段外应休息");
assert(blockReason(night, { windows: [{ start: "00:00", end: "23:59" }], dailyMinutes: 40 }, 0) === null, "默认应可玩");
assert(blockReason(night, { windows: [{ start: "00:00", end: "23:59" }], dailyMinutes: 40 }, 40 * 60_000) === "budget", "分钟用完应休息");
assert(blockReason(new Date(2026, 9, 5, 22, 30), { windows: [{ start: "21:00", end: "07:00" }], dailyMinutes: 40 }, 0) === null, "跨午夜时段应可玩");
assert(dayIndex(7, 0, new Date(2026, 0, 1)) === 1, "1 月 1 日序号");
assert(dayIndex(7, 1, new Date(2026, 0, 1)) === 2, "偏移后的序号");
console.log("time ok");
