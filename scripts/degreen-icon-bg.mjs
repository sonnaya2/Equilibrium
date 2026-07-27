/**
 * Knock out RuneScape wiki green-screen / grass-floor icon backgrounds.
 *
 * Pure chroma (0,175,0) model plates and studio grass floors become alpha 0.
 * Ability icons that *are* green on dark edges are left alone (flood only from
 * edge pixels that match the key, and abort if the cut would wipe the subject).
 *
 * Usage:
 *   node scripts/degreen-icon-bg.mjs
 *   node scripts/degreen-icon-bg.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = process.cwd();
const DRY = process.argv.includes("--dry-run");
const ROOTS = [
  path.join(ROOT, "public", "game"),
  path.join(ROOT, "assets", "rs3"),
];

/** Wiki pure chroma or studio grass floor — not olive ability art. */
function isKeyGreen(r, g, b, a) {
  if (a < 16) return false;
  // Classic wiki model plate: near #00AF00 / #00FF00
  if (r <= 45 && b <= 45 && g >= 120 && g - Math.max(r, b) >= 70) return true;
  // Studio grass floor under character / spell renders (chronicle, barricade, …)
  if (
    g >= 85 &&
    g <= 165 &&
    r >= 30 &&
    r <= 105 &&
    b <= 55 &&
    g >= r + 28 &&
    g >= b + 40
  ) {
    return true;
  }
  return false;
}

function softKey(r, g, b, a) {
  // Slightly looser for fringe pixels next to hard keys
  if (a < 16) return false;
  if (isKeyGreen(r, g, b, a)) return true;
  if (r <= 55 && b <= 55 && g >= 100 && g - Math.max(r, b) >= 50) return true;
  if (
    g >= 78 &&
    g <= 175 &&
    r >= 25 &&
    r <= 115 &&
    b <= 70 &&
    g >= r + 20 &&
    g >= b + 30
  ) {
    return true;
  }
  return false;
}

async function* walkPng(dir) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) yield* walkPng(p);
    else if (/\.png$/i.test(ent.name)) yield p;
  }
}

function shouldConsider(width, height) {
  const px = width * height;
  // Inventory / outfit plates; skip huge screenshots
  return px >= 16 * 16 && px <= 900 * 900 && width <= 900 && height <= 900;
}

function cornersAreKeyed(data, width, height, channels) {
  const pts = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  let keyed = 0;
  for (const [x, y] of pts) {
    const i = (y * width + x) * channels;
    if (isKeyGreen(data[i], data[i + 1], data[i + 2], data[i + 3])) keyed++;
  }
  // 3+ corners: full plate. 2 bottom corners only: some spell icons keep a beige sky strip.
  if (keyed >= 3) return true;
  if (keyed >= 2) {
    const bottomL = ((height - 1) * width + 0) * channels;
    const bottomR = ((height - 1) * width + (width - 1)) * channels;
    const bottomKeyed =
      isKeyGreen(data[bottomL], data[bottomL + 1], data[bottomL + 2], data[bottomL + 3]) &&
      isKeyGreen(data[bottomR], data[bottomR + 1], data[bottomR + 2], data[bottomR + 3]);
    return bottomKeyed;
  }
  return false;
}

/**
 * BFS flood from every edge pixel that matches the key. Returns boolean mask.
 */
function floodKeyMask(data, width, height, channels) {
  const n = width * height;
  const mask = new Uint8Array(n);
  const q = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const tryPush = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const idx = y * width + x;
    if (mask[idx]) return;
    const i = idx * channels;
    if (!softKey(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
    mask[idx] = 1;
    q[tail++] = idx;
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (head < tail) {
    const idx = q[head++];
    const x = idx % width;
    const y = (idx / width) | 0;
    tryPush(x + 1, y);
    tryPush(x - 1, y);
    tryPush(x, y + 1);
    tryPush(x, y - 1);
  }

  return mask;
}

function applyMask(data, mask, width, height, channels) {
  let cleared = 0;
  const zero = (i) => {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 0;
    cleared++;
  };
  for (let idx = 0; idx < mask.length; idx++) {
    if (!mask[idx]) continue;
    zero(idx * channels);
  }
  // Soft fringe: pixels next to cleared key get alpha pull-down if near-green
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask[idx]) continue;
      const i = idx * channels;
      if (data[i + 3] < 16) continue;
      if (!softKey(data[i], data[i + 1], data[i + 2], data[i + 3])) continue;
      let near = false;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        if (mask[(y + dy) * width + (x + dx)]) {
          near = true;
          break;
        }
      }
      if (near) zero(i);
    }
  }
  // Zero RGB on any remaining fully-transparent pixels (stale chroma in RGB plane).
  for (let i = 0; i < data.length; i += channels) {
    if (data[i + 3] === 0 && (data[i] || data[i + 1] || data[i + 2])) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
  }
  return cleared;
}

async function processFile(file) {
  const input = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = input;
  const { width, height, channels } = info;
  if (!shouldConsider(width, height)) return null;
  if (!cornersAreKeyed(data, width, height, channels)) return null;

  const mask = floodKeyMask(data, width, height, channels);
  const keyed = mask.reduce((n, v) => n + v, 0);
  const total = width * height;
  const keyedRatio = keyed / total;
  // Abort if we'd wipe almost everything (green ability glyph) or almost nothing
  // Tiny edge-only hits on non-chroma icons are noise.
  if (keyedRatio < 0.18 || keyedRatio > 0.93) return null;

  const opaqueBefore = (() => {
    let n = 0;
    for (let i = 3; i < data.length; i += channels) if (data[i] > 16) n++;
    return n;
  })();

  const cleared = applyMask(data, mask, width, height, channels);
  const opaqueAfter = (() => {
    let n = 0;
    for (let i = 3; i < data.length; i += channels) if (data[i] > 16) n++;
    return n;
  })();

  // Need a real subject left
  if (opaqueAfter < opaqueBefore * 0.08 || opaqueAfter < 24) return null;
  if (cleared < 20) return null;

  if (!DRY) {
    await sharp(Buffer.from(data), {
      raw: { width, height, channels },
    })
      .png({ compressionLevel: 9 })
      .toFile(file);
  }

  return {
    file: path.relative(ROOT, file),
    width,
    height,
    keyedRatio: +keyedRatio.toFixed(3),
    cleared,
    opaqueAfter,
  };
}

const results = [];
for (const root of ROOTS) {
  for await (const file of walkPng(root)) {
    try {
      const r = await processFile(file);
      if (r) results.push(r);
    } catch (err) {
      console.error("FAIL", path.relative(ROOT, file), err?.message || err);
    }
  }
}

results.sort((a, b) => a.file.localeCompare(b.file));
console.log(
  DRY ? `DRY-RUN would degreen ${results.length} files` : `Degreened ${results.length} files`,
);
for (const r of results) {
  console.log(
    `  ${r.keyedRatio.toFixed(2)} cleared=${r.cleared} keep=${r.opaqueAfter} ${r.file}`,
  );
}
fs.writeFileSync(
  path.join(ROOT, "scraped-data", "degreen-icon-bg-report.json"),
  `${JSON.stringify({ dry: DRY, count: results.length, results }, null, 2)}\n`,
);
