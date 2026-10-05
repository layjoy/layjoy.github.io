import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(buf) {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size, paint) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = paint(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

function face(x, y, size) {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2 + size * 0.04;
  const dx = x - cx;
  const dy = y - cy;
  const r = size * 0.34;
  if (dx * dx + dy * dy > r * r) return [246, 243, 234, 255];
  const eye = size * 0.045;
  const eyeY = cy - size * 0.06;
  for (const ex of [cx - size * 0.1, cx + size * 0.1]) {
    const exd = x - ex;
    const eyd = y - eyeY;
    if (exd * exd + eyd * eyd <= eye * eye) return [255, 253, 248, 255];
  }
  const mouthY = cy + size * 0.08;
  const mouthX = Math.abs(x - cx);
  if (mouthX < size * 0.12 && Math.abs(y - (mouthY + mouthX * 0.25)) < size * 0.018) {
    return [255, 253, 248, 255];
  }
  return [61, 122, 106, 255];
}

writeFileSync(new URL("../public/icon-192.png", import.meta.url), png(192, face));
writeFileSync(new URL("../public/icon-512.png", import.meta.url), png(512, face));
