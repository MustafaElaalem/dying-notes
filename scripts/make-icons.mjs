// Generates PWA PNG icons with zero dependencies (Node zlib + hand-rolled PNG chunks).
// Cobalt rounded square with a white mic glyph, matching the app's sticker style.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public");
mkdirSync(outDir, { recursive: true });

// ---------- PNG encoding ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function encodePNG(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// ---------- signed distance helpers (all in unit square coords) ----------
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => {
  const dx = Math.abs(x - cx) - (hw - r);
  const dy = Math.abs(y - cy) - (hh - r);
  const ax = Math.max(dx, 0), ay = Math.max(dy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(dx, dy), 0) - r;
};
const sdSegment = (x, y, ax, ay, bx, by) => {
  const pax = x - ax, pay = y - ay, bax = bx - ax, bay = by - ay;
  const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
};
const sdCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) - r;

// mic glyph micSDF < 0 inside; s scales glyph size, centered at (0.5, 0.52)
function micGlyph(x, y, s) {
  const bw = 0.085 * s;   // capsule half-width
  const top = 0.52 - 0.24 * s, bot = 0.52 - 0.02 * s;
  const capsule = sdRoundRect(x, y, 0.5, (top + bot) / 2, bw, (bot - top) / 2, bw);
  const arcCx = 0.5, arcCy = bot + 0.005 * s, arcR = 0.155 * s;
  const d = Math.hypot(x - arcCx, y - arcCy);
  const arc = Math.abs(d - arcR) - 0.018 * s;
  const inArcBand = y > top + 0.1 * s && d < arcR + 0.02 * s;
  const stem = sdSegment(x, y, 0.5, bot + 0.14 * s, 0.5, 0.52 + 0.16 * s) - 0.011 * s;
  const base = sdSegment(x, y, 0.5 - 0.1 * s, 0.52 + 0.175 * s, 0.5 + 0.1 * s, 0.52 + 0.175 * s) - 0.013 * s;
  let m = capsule;
  if (inArcBand) m = Math.min(m, arc);
  m = Math.min(m, stem, base);
  return m;
}

function render(size, { maskable = false, radius = 0.22 } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const bgR = 0x2b, bgG = 0x59, bgB = 0xe0; // cobalt
  const SS = 2; // supersampling
  const glyphScale = maskable ? 0.72 : 1; // keep inside maskable safe zone
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let aBg = 0, aFg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) / size;
          const y = (py + (sy + 0.5) / SS) / size;
          const db = sdRoundRect(x, y, 0.5, 0.5, 0.5, 0.5, radius);
          if (db < 0) aBg += 1 / (SS * SS);
          if (db < -0.01 && micGlyph(x, y, glyphScale) < 0) aFg += 1 / (SS * SS);
        }
      }
      const i = (py * size + px) * 4;
      rgba[i] = bgR; rgba[i + 1] = bgG; rgba[i + 2] = bgB;
      rgba[i + 3] = Math.round(aBg * 255);
      if (aFg > 0) { rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; }
    }
  }
  return encodePNG(size, size, rgba);
}

writeFileSync(join(outDir, "icon-192.png"), render(192));
writeFileSync(join(outDir, "icon-512.png"), render(512));
writeFileSync(join(outDir, "icon-maskable-512.png"), render(512, { maskable: true, radius: 0.5 }));
console.log("icons written to public/");

// SVG icon for the tab favicon
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#2B59E0"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"><rect x="25" y="12" width="14" height="24" rx="7" fill="#fff" stroke="none"/><path d="M19 30a13 13 0 0 0 26 0"/><path d="M32 43v8"/><path d="M25 51h14"/></g></svg>`;
writeFileSync(join(outDir, "icon.svg"), svg);
console.log("icon.svg written");
