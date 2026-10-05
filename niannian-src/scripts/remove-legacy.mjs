import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const assets = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../niannian/assets");
const legacy = ["index-park4.js", "index-park4.css", "router-park4.js", "router-park4.css", "ludo4.js"];
if (!fs.existsSync(assets)) process.exit(0);
for (const name of legacy) {
  const file = path.join(assets, name);
  if (!fs.existsSync(file)) continue;
  fs.unlinkSync(file);
  console.log("removed legacy", name);
}
