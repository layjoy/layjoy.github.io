import { createHash, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import pg from "pg";

loadEnv(resolve(process.cwd(), ".env"));

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("缺少环境变量 DATABASE_URL。");
  console.error("本地可复制 .env.example 为 .env，再用 docker compose up -d 启动 PostgreSQL。");
  console.error("云数据库把厂商给的连接串放进 DATABASE_URL，不要写进代码。");
  process.exit(1);
}

const port = Number(process.env.PORT || 8787);
const pool = new pg.Pool({ connectionString: databaseUrl });
const schema = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
const kinds = new Set(["rules", "usage", "activity", "habit", "emotion"]);
const familyIdPattern = /^NL[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const forbiddenKeys = new Set(["passphrase", "password", "answer", "prompt", "plain", "plaintext"]);

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function sameText(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function hasForbidden(value, depth = 0) {
  if (!value || typeof value !== "object" || depth > 5) return false;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key.toLowerCase())) return true;
    if (hasForbidden(child, depth + 1)) return true;
  }
  return false;
}

function isCipher(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 50000 && !value.includes(" ") && !value.startsWith("{") && !value.startsWith("[");
}

function send(res, status, body) {
  const raw = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(raw),
    "cache-control": "no-store",
  });
  res.end(raw);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("太大"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (chunks.length === 0) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("格式"));
      }
    });
    req.on("error", reject);
  });
}

async function authenticate(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const familyId = String(req.headers["x-family-id"] || "");
  if (!token || !familyIdPattern.test(familyId)) return null;
  const result = await pool.query("SELECT token_hash FROM families WHERE id = $1", [familyId]);
  const row = result.rows[0];
  if (!row || !sameText(row.token_hash, tokenHash(token))) return null;
  return { familyId };
}

function recordError(record) {
  if (!record || typeof record !== "object") return "记录格式不对";
  if (typeof record.id !== "string" || !/^[A-Za-z0-9:_-]{1,80}$/.test(record.id)) return "记录格式不对";
  if (!kinds.has(record.kind)) return "记录格式不对";
  if (!isCipher(record.ciphertext) || !isCipher(record.iv)) return "不要上传明文";
  if (!Number.isFinite(record.updatedAt)) return "记录格式不对";
  return null;
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "Origin");
  }
  res.setHeader("access-control-allow-headers", "content-type, authorization, x-family-id");
  res.setHeader("access-control-allow-methods", "GET, POST, PUT, OPTIONS");
  const path = (req.url || "/").split("?")[0];
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  try {
    if (req.method === "GET" && path === "/health") {
      await pool.query("SELECT 1");
      send(res, 200, { ok: true });
      console.log("GET /health 200");
      return;
    }
    if (req.method === "POST" && path === "/api/families") {
      const body = await readBody(req);
      if (hasForbidden(body)) {
        send(res, 400, { error: "不要把口令或答案发给后端" });
        console.log("POST /api/families 400");
        return;
      }
      const familyId = String(body.familyId || "");
      const hash = String(body.tokenHash || "");
      if (!familyIdPattern.test(familyId) || !/^[a-f0-9]{64}$/.test(hash)) {
        send(res, 400, { error: "家庭码格式不对" });
        console.log("POST /api/families 400");
        return;
      }
      const inserted = await pool.query(
        "INSERT INTO families (id, token_hash) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING RETURNING id",
        [familyId, hash],
      );
      if (inserted.rowCount === 0) {
        const existing = await pool.query("SELECT token_hash FROM families WHERE id = $1", [familyId]);
        if (!existing.rows[0] || !sameText(existing.rows[0].token_hash, hash)) {
          send(res, 409, { error: "这个家庭码已经被用过" });
          console.log("POST /api/families 409");
          return;
        }
      }
      send(res, 200, { ok: true });
      console.log("POST /api/families 200");
      return;
    }
    const auth = await authenticate(req);
    if (!auth) {
      send(res, 401, { error: "口令或家庭码不对" });
      console.log(`${req.method} ${path} 401`);
      return;
    }
    if (req.method === "PUT" && path === "/api/families/token") {
      const body = await readBody(req);
      if (hasForbidden(body)) {
        send(res, 400, { error: "不要把口令或答案发给后端" });
        console.log("PUT /api/families/token 400");
        return;
      }
      const hash = String(body.tokenHash || "");
      if (!/^[a-f0-9]{64}$/.test(hash)) {
        send(res, 400, { error: "记录格式不对" });
        console.log("PUT /api/families/token 400");
        return;
      }
      await pool.query("UPDATE families SET token_hash = $2 WHERE id = $1", [auth.familyId, hash]);
      send(res, 200, { ok: true });
      console.log("PUT /api/families/token 200");
      return;
    }
    if (req.method === "GET" && path === "/api/records") {
      const result = await pool.query(
        "SELECT id, kind, ciphertext, iv, updated_at FROM records WHERE family_id = $1 ORDER BY updated_at ASC",
        [auth.familyId],
      );
      send(res, 200, {
        records: result.rows.map((row) => ({
          id: row.id,
          kind: row.kind,
          ciphertext: row.ciphertext,
          iv: row.iv,
          updatedAt: Number(row.updated_at),
        })),
      });
      console.log("GET /api/records 200");
      return;
    }
    if (req.method === "PUT" && path === "/api/records") {
      const body = await readBody(req);
      if (hasForbidden(body)) {
        send(res, 400, { error: "不要把口令或答案发给后端" });
        console.log("PUT /api/records 400");
        return;
      }
      const records = Array.isArray(body.records) ? body.records : null;
      if (!records || records.length > 200) {
        send(res, 400, { error: "记录格式不对" });
        console.log("PUT /api/records 400");
        return;
      }
      for (const record of records) {
        const problem = recordError(record);
        if (problem) {
          send(res, 400, { error: problem });
          console.log("PUT /api/records 400");
          return;
        }
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const record of records) {
          await client.query(
            `INSERT INTO records (id, family_id, kind, ciphertext, iv, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (family_id, id) DO UPDATE
             SET kind = EXCLUDED.kind,
                 ciphertext = EXCLUDED.ciphertext,
                 iv = EXCLUDED.iv,
                 updated_at = EXCLUDED.updated_at
             WHERE records.updated_at <= EXCLUDED.updated_at`,
            [record.id, auth.familyId, record.kind, record.ciphertext, record.iv, Math.round(record.updatedAt)],
          );
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
      send(res, 200, { ok: true, stored: records.length });
      console.log("PUT /api/records 200");
      return;
    }
    send(res, 404, { error: "没有这个地址" });
    console.log(`${req.method} ${path} 404`);
  } catch (error) {
    send(res, 500, { error: "后端暂时没有完成" });
    console.error(`${req.method} ${path} 500`);
  }
});

try {
  await pool.query(schema);
} catch (error) {
  console.error("数据库连不上，或还没有建表。请检查 DATABASE_URL。");
  process.exit(1);
}

server.listen(port, "127.0.0.1", () => {
  let where = "已连接";
  try {
    const url = new URL(databaseUrl);
    where = `${url.hostname}:${url.port || "5432"}${url.pathname}`;
  } catch {
    where = "已连接";
  }
  console.log(`年年学后端已启动：http://127.0.0.1:${port}`);
  console.log(`数据库 ${where}（连接串来自 DATABASE_URL，日志不打印密码）`);
});
