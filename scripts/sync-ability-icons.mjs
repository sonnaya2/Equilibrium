/**
 * Download wiki ability icons for engine AbilitySpecs.
 * Local cache only — public/game/combat/abilities/<style>/<slug>.png
 *
 *   node scripts/sync-ability-icons.mjs
 *   node scripts/sync-ability-icons.mjs --merge
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WIKI_API = "https://runescape.wiki/api.php";
const UA = "EquilibriumAbilityIcons/1.0 (https://github.com/sonnaya2/Equilibrium)";
const THUMB = 64;
const DELAY_MS = 200;
const MAX_RETRIES = 6;

const STYLE_FILES = [
  ["melee", "src/combat/styles/melee/abilities.ts"],
  ["ranged", "src/combat/styles/ranged/abilities.ts"],
  ["magic", "src/combat/styles/magic/abilities.ts"],
  ["necromancy", "src/combat/styles/necromancy/abilities.ts"],
];

/** Map engine ability id → preferred wiki page title when source path is shared/wrong. */
const PAGE_ALIASES = {
  attack: "Attack (ability)",
  ranged_attack: "Piercing Shot",
  magic_attack: "Wrack",
  necromancy_basic: "Necromancy (ability)",
  adaptive_strike_2h: "Adaptive Strike",
  adaptive_strike_dw: "Adaptive Strike",
  deadshot_igneous: "Deadshot",
  dragon_breath_empowered: "Dragon Breath",
  asphyxiate_resplendence: "Asphyxiate",
  omnipower_igneous: "Omnipower",
  spectral_scythe_2: "Spectral Scythe",
  spectral_scythe_3: "Spectral Scythe",
  overpower_igneous: "Overpower",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugFromId(id) {
  return String(id)
    .replace(/_/g, "-")
    .replace(/[^a-z0-9-]/gi, "")
    .toLowerCase();
}

function parseAbilities() {
  const out = [];
  for (const [style, rel] of STYLE_FILES) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    // Only the *ABILITIES export array — skip *_EFFECTS after it.
    const arrayMatch = text.match(
      /export const \w+_ABILITIES[^=]*=\s*\[([\s\S]*?)\n\];/,
    );
    if (!arrayMatch) {
      console.warn(`no ABILITIES array in ${rel}`);
      continue;
    }
    const body = arrayMatch[1];
    // Each ability object is roughly 200–500 chars; take a window after each id.
    const idRe = /id:\s*"([^"]+)"/g;
    let m;
    while ((m = idRe.exec(body))) {
      const id = m[1];
      const window = body.slice(m.index, m.index + 700);
      const nameM = window.match(/name:\s*"([^"]+)"/);
      const catM = window.match(/category:\s*"([^"]+)"/);
      const wikiM = window.match(/wikiAbility\(\s*"([^"]+)"\s*,\s*"([^"]+)"/);
      const urlM = window.match(/url:\s*"https:\/\/runescape\.wiki\/w\/([^"]+)"/);
      let pageTitle = PAGE_ALIASES[id] || null;
      if (!pageTitle && wikiM) pageTitle = wikiM[1];
      if (!pageTitle && urlM) {
        pageTitle = decodeURIComponent(urlM[1].replace(/_/g, " "));
      }
      if (!pageTitle && nameM) pageTitle = nameM[1];
      out.push({
        id,
        name: nameM?.[1] || id,
        style,
        category: catM?.[1] || "basic",
        pageTitle,
        wikiPath: wikiM?.[2] || null,
      });
    }
  }
  const seen = new Set();
  return out.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

async function wikiGet(params, attempt = 0) {
  const q = new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
  const res = await fetch(`${WIKI_API}?${q}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (res.status === 429 || res.status === 503) {
    if (attempt >= MAX_RETRIES) throw new Error(`wiki ${res.status}`);
    await sleep(1500 * (attempt + 1));
    return wikiGet(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`wiki ${res.status}`);
  return res.json();
}

async function batchPageImages(titles) {
  const unique = [...new Set(titles.filter(Boolean))];
  const map = new Map();
  const BATCH = 40;
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const data = await wikiGet({
      action: "query",
      titles: chunk.join("|"),
      prop: "pageimages",
      pithumbsize: String(THUMB),
      pilicense: "any",
      redirects: "1",
    });
    for (const page of data?.query?.pages ?? []) {
      if (page.missing || !page.thumbnail?.source) continue;
      const entry = {
        pageTitle: page.title,
        fileTitle: page.pageimage ? `File:${page.pageimage}` : null,
        url: page.thumbnail.source,
      };
      map.set(page.title, entry);
      map.set(page.title.replace(/_/g, " "), entry);
    }
    for (const red of data?.query?.redirects ?? []) {
      if (map.has(red.to)) map.set(red.from, map.get(red.to));
    }
    for (const norm of data?.query?.normalized ?? []) {
      if (map.has(norm.to)) map.set(norm.from, map.get(norm.to));
    }
    await sleep(DELAY_MS);
  }
  return map;
}

async function download(url, destPath, attempt = 0) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "image/*" },
    redirect: "follow",
  });
  if (res.status === 429 || res.status === 503) {
    if (attempt >= MAX_RETRIES) throw new Error(`dl ${res.status}`);
    await sleep(1500 * (attempt + 1));
    return download(url, destPath, attempt + 1);
  }
  if (!res.ok) throw new Error(`dl ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 40 || buf.length > 2_000_000) throw new Error(`bad size ${buf.length}`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return { bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
}

function publicPathFor(style, slug) {
  return `/game/combat/abilities/${style}/${slug}.png`;
}

async function main() {
  const abilities = parseAbilities();
  console.log(`abilities: ${abilities.length}`);

  const titles = abilities.map((a) => a.pageTitle);
  const images = await batchPageImages(titles);

  const icons = {};
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const a of abilities) {
    const slug = slugFromId(a.id);
    const relPublic = publicPathFor(a.style, slug).slice(1); // no leading /
    // Prefer style subdir; also write asset mirror
    const publicFile = path.join(root, "public", relPublic);
    const assetFile = path.join(root, "assets/rs3/combat/abilities", a.style, `${slug}.png`);

    let resolved = images.get(a.pageTitle) || images.get(a.pageTitle?.replace(/_/g, " "));

    // Path-based title if name failed
    if (!resolved && a.wikiPath) {
      const t = a.wikiPath.replace(/_/g, " ");
      if (!images.has(t)) {
        const one = await batchPageImages([a.wikiPath.replace(/_/g, " "), a.wikiPath]);
        resolved = one.get(a.wikiPath.replace(/_/g, " ")) || [...one.values()][0];
      } else {
        resolved = images.get(t);
      }
    }

    if (!resolved?.url) {
      icons[a.id] = {
        ok: false,
        error: "no-icon",
        style: a.style,
        pageTitle: a.pageTitle,
        category: a.category,
      };
      failed++;
      continue;
    }

    try {
      if (fs.existsSync(publicFile) && fs.statSync(publicFile).size > 40) {
        icons[a.id] = {
          ok: true,
          path: publicPathFor(a.style, slug),
          style: a.style,
          pageTitle: resolved.pageTitle,
          fileTitle: resolved.fileTitle,
          sourceUrl: resolved.url.split("?")[0],
          category: a.category,
          cached: true,
        };
        skipped++;
        // ensure asset copy
        if (!fs.existsSync(assetFile)) {
          fs.mkdirSync(path.dirname(assetFile), { recursive: true });
          fs.copyFileSync(publicFile, assetFile);
        }
      } else {
        const meta = await download(resolved.url, publicFile);
        fs.mkdirSync(path.dirname(assetFile), { recursive: true });
        fs.copyFileSync(publicFile, assetFile);
        icons[a.id] = {
          ok: true,
          path: publicPathFor(a.style, slug),
          style: a.style,
          pageTitle: resolved.pageTitle,
          fileTitle: resolved.fileTitle,
          sourceUrl: resolved.url.split("?")[0],
          category: a.category,
          bytes: meta.bytes,
          sha256: meta.sha256,
          cached: false,
        };
        downloaded++;
        await sleep(80);
      }
    } catch (e) {
      icons[a.id] = {
        ok: false,
        error: String(e.message || e),
        style: a.style,
        pageTitle: a.pageTitle,
        category: a.category,
      };
      failed++;
    }
  }

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    count: abilities.length,
    ok: Object.values(icons).filter((e) => e.ok).length,
    failed: Object.values(icons).filter((e) => !e.ok).length,
    note: "Local ability icons under /game/combat/abilities/<style>/. Wiki/Jagex attribution. Never hotlink at runtime.",
    icons,
  };
  fs.writeFileSync(
    path.join(root, "data/combat/ability-icons.json"),
    `${JSON.stringify(out, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(root, "scraped-data/ability-icons-2026-07-26.json"),
    `${JSON.stringify(out, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      { downloaded, skipped, failed, ok: out.ok, total: out.count },
      null,
      2,
    ),
  );
  if (failed) {
    const fails = Object.entries(icons)
      .filter(([, v]) => !v.ok)
      .map(([id, v]) => `${id} | ${v.pageTitle} | ${v.error}`);
    console.log("failed:\n" + fails.join("\n"));
  }
}

await main();
