import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../niannian");
const assets = path.join(root, "assets");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const extras = ["sw.js", "workbox-*.js"].flatMap((pattern) => {
  if (!pattern.includes("*")) {
    const file = path.join(root, pattern);
    return fs.existsSync(file) ? [fs.readFileSync(file, "utf8")] : [];
  }
  return fs
    .readdirSync(root)
    .filter((name) => name.startsWith("workbox-") && name.endsWith(".js"))
    .map((name) => fs.readFileSync(path.join(root, name), "utf8"));
});
const blob = [html, ...extras].join("\n");
const keep = new Set();
for (const match of blob.matchAll(/assets\/([A-Za-z0-9._-]+)/g)) keep.add(match[1]);
if (keep.size < 2) {
  console.error("资源引用太少，停止清理");
  process.exit(1);
}
if (!fs.existsSync(assets)) process.exit(0);
for (const name of fs.readdirSync(assets)) {
  if (keep.has(name)) continue;
  fs.unlinkSync(path.join(assets, name));
  console.log("removed", name);
}
