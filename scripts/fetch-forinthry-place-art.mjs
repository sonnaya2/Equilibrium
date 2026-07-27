/**
 * Pull Forinthry / Wilderness place location art for the POI atlas.
 *   node scripts/fetch-forinthry-place-art.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WIKI = "https://runescape.wiki/api.php";
const UA = "EquilibriumAssetSync/1.0 (https://github.com/sonnaya2/Equilibrium)";
const OUT_DIRS = [
  path.join(ROOT, "public", "game", "activities"),
  path.join(ROOT, "assets", "rs3", "activities"),
];

/** slug → wiki File: title */
const FILES = {
  "wilderness-crater": "Wilderness Crater entrance.png",
  "lava-maze": "Lava Maze.png",
  "rogues-castle": "Rogues' Castle.png",
  "demonic-ruins": "Demonic Ruins.png",
  // ED2 — larger plate for the site pin
  "dragonkin-laboratory": "Dragonkin Laboratory exterior.png",
};

async function wikiFileInfo(title) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "imageinfo",
    iiprop: "url|mime|size",
    titles: title.startsWith("File:") ? title : `File:${title}`,
    origin: "*",
  });
  const data = await (
    await fetch(`${WIKI}?${params}`, { headers: { "User-Agent": UA } })
  ).json();
  return data?.query?.pages?.[0]?.imageinfo?.[0] ?? null;
}

async function download(slug, fileTitle) {
  const info = await wikiFileInfo(fileTitle);
  if (!info?.url) {
    console.warn(`[miss] ${slug} ← ${fileTitle}`);
    return false;
  }
  const res = await fetch(info.url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) {
    console.warn(`[http ${res.status}] ${slug}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) {
    console.warn(`[tiny] ${slug} ${buf.length}B`);
    return false;
  }
  for (const dir of OUT_DIRS) {
    fs.mkdirSync(dir, { recursive: true });
    // Atlas resolves by basename; store as .png even if source is jpeg.
    const dest = path.join(dir, `${slug}.png`);
    fs.writeFileSync(dest, buf);
    // Remove stale .jpg that would otherwise rank equal / confuse tooling.
    const jpg = path.join(dir, `${slug}.jpg`);
    if (fs.existsSync(jpg)) fs.unlinkSync(jpg);
  }
  console.log(`[ok] ${slug} ← ${fileTitle} (${(buf.length / 1024).toFixed(0)} KB)`);
  return true;
}

let ok = 0;
for (const [slug, title] of Object.entries(FILES)) {
  if (await download(slug, title)) ok++;
  await new Promise((r) => setTimeout(r, 250));
}
console.log(`done ${ok}/${Object.keys(FILES).length}`);
if (ok < 4) process.exit(1);
