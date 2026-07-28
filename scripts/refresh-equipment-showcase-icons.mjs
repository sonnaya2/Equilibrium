import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createHash } from "node:crypto";

const root = process.cwd();
const equipmentPath = path.join(root, "data/combat/equipment.json");
const slugsPath = path.join(root, "data/combat/equipment-icon-slugs.json");
const metadataPath = path.join(root, "data/combat/equipment-icons.json");
const reportPath = path.join(root, "scraped-data/equipment-showcase-icon-refresh.json");
const API = "https://runescape.wiki/api.php";
const UA = "EquilibriumShowcaseIcons/1.0 (https://github.com/sonnaya2/Equilibrium)";
const BATCH = 40;
const THUMB = 128;

const equipment = JSON.parse(fs.readFileSync(equipmentPath, "utf8"));
const records = exactById(equipment.records || []);
const slugs = new Set(fs.existsSync(slugsPath) ? JSON.parse(fs.readFileSync(slugsPath, "utf8")) : []);
const metadata = fs.existsSync(metadataPath)
  ? JSON.parse(fs.readFileSync(metadataPath, "utf8"))
  : { generatedAt: null, count: 0, ok: 0, failed: 0, icons: {} };
metadata.icons ||= {};

const TITLE_ALIASES = {
  "item:trimmed-masterwork-spear-of-annihilation": "Masterwork Spear of Annihilation",
  "item:elite-tetsu-helm": "Superior tetsu helm",
  "item:elite-tetsu-body": "Superior tetsu body",
  "item:elite-tetsu-platelegs": "Superior tetsu platelegs",
  "item:elite-death-lotus-hood": "Superior Death Lotus hood",
  "item:elite-death-lotus-chestplate": "Superior Death Lotus chestplate",
  "item:elite-death-lotus-chaps": "Superior Death Lotus chaps",
};

function exactById(input) {
  const seen = new Set();
  return input.filter((record) => record?.id && !seen.has(record.id) && seen.add(record.id));
}

function slugFromId(id) {
  return String(id || "").replace(/^(?:item|equipment):/, "");
}

function wikiTitle(record) {
  if (TITLE_ALIASES[record.id]) return TITLE_ALIASES[record.id];
  const source = record.sources?.find((entry) => entry?.url?.includes("runescape.wiki/w/"));
  if (source?.url) {
    try {
      const url = new URL(source.url);
      return decodeURIComponent(url.pathname.replace(/^\/w\//, "")).replaceAll("_", " ");
    } catch {
      // Fall through to the catalogue name.
    }
  }
  return record.name;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function wikiGet(params, attempt = 0) {
  const query = new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
  const response = await fetch(`${API}?${query}`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if ([429, 503].includes(response.status) && attempt < 6) {
    await sleep(1200 * (attempt + 1));
    return wikiGet(params, attempt + 1);
  }
  if (!response.ok) throw new Error(`wiki ${response.status}`);
  return response.json();
}

async function batchPageImages(titles) {
  const output = new Map();
  const unique = [...new Set(titles.filter(Boolean))];
  for (let index = 0; index < unique.length; index += BATCH) {
    const chunk = unique.slice(index, index + BATCH);
    const data = await wikiGet({
      action: "query",
      titles: chunk.join("|"),
      prop: "pageimages",
      pithumbsize: String(THUMB),
      pilicense: "any",
      redirects: "1",
    });
    for (const page of data?.query?.pages || []) {
      if (!page.missing && page.thumbnail?.source) {
        const result = { pageTitle: page.title, fileTitle: page.pageimage ? `File:${page.pageimage}` : null, url: page.thumbnail.source };
        output.set(page.title, result);
        output.set(page.title.replaceAll("_", " "), result);
      }
    }
    for (const redirect of data?.query?.redirects || []) if (output.has(redirect.to)) output.set(redirect.from, output.get(redirect.to));
    for (const normalized of data?.query?.normalized || []) if (output.has(normalized.to)) output.set(normalized.from, output.get(normalized.to));
    await sleep(250);
  }
  return output;
}

async function fileFallback(title) {
  const candidates = [
    `File:${title} detail.png`, `File:${title}.png`, `File:${title.replaceAll(" ", "_")}_detail.png`,
    `File:${title} detail.webp`, `File:${title}.webp`,
  ];
  for (const candidate of candidates) {
    try {
      const data = await wikiGet({ action: "query", titles: candidate, prop: "imageinfo", iiprop: "url|mime", iiurlwidth: String(THUMB) });
      const page = data?.query?.pages?.[0];
      const image = page?.imageinfo?.[0];
      if (!page?.missing && image?.thumburl) return { pageTitle: title, fileTitle: page.title, url: image.thumburl };
      if (!page?.missing && image?.url) return { pageTitle: title, fileTitle: page.title, url: image.url };
    } catch {
      // Try the next conventional file title.
    }
  }
  return null;
}

function isWebp(buffer) {
  return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

async function downloadWebp(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "image/webp,image/*;q=0.8" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`image ${response.status}`);
  const source = Buffer.from(await response.arrayBuffer());
  if (source.length < 40 || source.length > 4_000_000) throw new Error(`bad image size ${source.length}`);
  if (isWebp(source)) return source;
  return sharp(source, { animated: false, pages: 1, failOn: "none" })
    .rotate()
    .resize({ width: THUMB, height: THUMB, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 92, alphaQuality: 100, effort: 4 })
    .toBuffer();
}

const targets = records.filter((record) => {
  const slug = slugFromId(record.id);
  const publicPath = path.join(root, `public/game/combat/equipment/${slug}.webp`);
  if (fs.existsSync(publicPath) && fs.statSync(publicPath).size > 40) {
    slugs.add(slug);
    return false;
  }
  return true;
});

console.log(`equipment showcase icon refresh: ${targets.length} missing of ${records.length}`);
const pageImages = await batchPageImages(targets.map(wikiTitle));
const failures = [];
let downloaded = 0;

for (const record of targets) {
  const title = wikiTitle(record);
  const slug = slugFromId(record.id);
  let resolved = pageImages.get(title) || pageImages.get(title.replaceAll("_", " ")) || null;
  if (!resolved) resolved = await fileFallback(title);
  if (!resolved?.url) {
    failures.push({ id: record.id, name: record.name, title, error: "no-icon" });
    continue;
  }

  try {
    const buffer = await downloadWebp(resolved.url);
    const assetPath = path.join(root, `assets/rs3/combat/equipment/${slug}.webp`);
    const publicPath = path.join(root, `public/game/combat/equipment/${slug}.webp`);
    fs.mkdirSync(path.dirname(assetPath), { recursive: true });
    fs.mkdirSync(path.dirname(publicPath), { recursive: true });
    fs.writeFileSync(assetPath, buffer);
    fs.writeFileSync(publicPath, buffer);
    slugs.add(slug);
    metadata.icons[record.id] = {
      ok: true,
      path: `/game/combat/equipment/${slug}.webp`,
      asset: `assets/rs3/combat/equipment/${slug}.webp`,
      pageTitle: resolved.pageTitle || title,
      fileTitle: resolved.fileTitle || null,
      sourceUrl: resolved.url.split("?")[0],
      bytes: buffer.length,
      sha256: createHash("sha256").update(buffer).digest("hex"),
      cached: false,
    };
    downloaded++;
    await sleep(80);
  } catch (error) {
    failures.push({ id: record.id, name: record.name, title, error: String(error?.message || error), sourceUrl: resolved.url });
  }
}

const sortedSlugs = [...slugs].sort();
fs.writeFileSync(slugsPath, `${JSON.stringify(sortedSlugs, null, 2)}\n`);
metadata.generatedAt = new Date().toISOString().slice(0, 10);
metadata.count = Object.keys(metadata.icons).length;
metadata.ok = Object.values(metadata.icons).filter((entry) => entry?.ok).length;
metadata.failed = failures.length;
metadata.note = "Local paths under /game/combat/equipment/. Attribution: RuneScape Wiki / Jagex. Never hotlink wiki at runtime.";
fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify({ generatedAt: metadata.generatedAt, targets: targets.length, downloaded, failed: failures.length, failures }, null, 2)}\n`);
console.log(JSON.stringify({ targets: targets.length, downloaded, failed: failures.length, slugCount: sortedSlugs.length }, null, 2));
