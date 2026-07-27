/**
 * One-shot: pull Karamja place location art from the RS wiki into
 * public/game/activities/ and assets/rs3/activities/ (correct filenames for
 * build-poi-atlas). Prefer location plates, not inventory icons.
 *
 *   node scripts/fetch-karamja-place-art.mjs
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

/** place slug → preferred wiki File: title */
const FILES = {
  "musa-point": "Musa Point.png",
  brimhaven: "Brimhaven.png",
  "hardwood-grove": "Hardwood grove.png",
  "tzhaar-city": "TzHaar City.png",
  "tzhaar-area": "TzHaar City.png",
  karamja: "Karamja lodestone location.png",
  "tai-bwo-wannai": "Tai Bwo Wannai Village.png",
  "herblore-habitat": "Herblore Habitat.png",
  "shilo-village": "Shilo Village (location).png",
  duradel: "Duradel.png",
  "tzhaar-fight-cave": "TzHaar Fight Cave.png",
  "fight-kiln": "Fight Kiln overhead.png",
  "fight-cauldron": "Fight Cauldron arena.png",
  "brimhaven-agility-arena": "Brimhaven Agility Arena.png",
  "nature-altar": "Nature Altar outside.png",
  "jadinko-lair": "Jadinko Lair.png",
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
  const page = data?.query?.pages?.[0];
  const info = page?.imageinfo?.[0];
  if (!page || page.missing || !info?.url) return null;
  return info;
}

async function download(slug, fileTitle) {
  const info = await wikiFileInfo(fileTitle);
  if (!info) {
    console.warn(`[miss] ${slug} ← ${fileTitle}`);
    return false;
  }
  const res = await fetch(info.url, { headers: { "User-Agent": UA }, redirect: "follow" });
  if (!res.ok) {
    console.warn(`[http ${res.status}] ${slug}`);
    return false;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) {
    console.warn(`[tiny ${buf.length}B] ${slug} — skip`);
    return false;
  }
  for (const dir of OUT_DIRS) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.png`), buf);
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
if (ok < Object.keys(FILES).length * 0.6) process.exit(1);
