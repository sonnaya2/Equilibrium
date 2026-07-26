/**
 * Download static UI ability icons (PNG) for engine AbilitySpecs.
 * Never use wiki animated ability GIFs (pageimage often is .gif).
 *
 * Prefer: File:{Exact Ability Name}.png → other .png inventory icons.
 * Reject: .gif / animated thumbs. Validate PNG magic bytes after download.
 *
 *   node scripts/sync-ability-icons.mjs
 *   node scripts/sync-ability-icons.mjs --force   # re-download even if cached
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WIKI_API = "https://runescape.wiki/api.php";
const UA = "EquilibriumAbilityIcons/1.1 (https://github.com/sonnaya2/Equilibrium)";
const THUMB = 64;
const DELAY_MS = 180;
const MAX_RETRIES = 6;
const FORCE = process.argv.includes("--force");

const STYLE_FILES = [
  ["melee", "src/combat/styles/melee/abilities.ts"],
  ["ranged", "src/combat/styles/ranged/abilities.ts"],
  ["magic", "src/combat/styles/magic/abilities.ts"],
  ["necromancy", "src/combat/styles/necromancy/abilities.ts"],
];

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

/** When the ability page title differs from the inventory File: name. */
const FILE_ALIASES = {
  "Attack (ability)": "Attack (ability).png",
  "Necromancy (ability)": "Necromancy (ability).png",
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

function isGifBytes(buf) {
  return buf.length >= 6 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46;
}

function isPngBytes(buf) {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  );
}

function parseAbilities() {
  const out = [];
  for (const [style, rel] of STYLE_FILES) {
    const text = fs.readFileSync(path.join(root, rel), "utf8");
    const arrayMatch = text.match(
      /export const \w+_ABILITIES[^=]*=\s*\[([\s\S]*?)\n\];/,
    );
    if (!arrayMatch) continue;
    const body = arrayMatch[1];
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

/**
 * Resolve static PNG file URL for an ability page title.
 * pageimages often returns .gif — ignore those.
 */
async function resolveStaticPng(pageTitle) {
  const data = await wikiGet({
    action: "query",
    titles: pageTitle,
    prop: "pageimages|images",
    pithumbsize: String(THUMB),
    pilicense: "any",
    imlimit: "100",
    redirects: "1",
  });
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;

  const resolvedTitle = page.title;
  const images = (page.images ?? []).map((i) => i.title || "");

  // Candidate File: titles — exact inventory icon first.
  const preferredNames = [
    FILE_ALIASES[pageTitle],
    FILE_ALIASES[resolvedTitle],
    `${resolvedTitle}.png`,
    `${pageTitle}.png`,
    // Drop parenthetical qualifiers: "Attack (ability)" already handled; "X (Igneous)" → X.png
    `${resolvedTitle.replace(/\s*\([^)]*\)\s*$/, "").trim()}.png`,
  ].filter(Boolean);

  const candidates = [];
  for (const name of preferredNames) {
    const file = name.startsWith("File:") ? name : `File:${name}`;
    candidates.push({ file, score: 100 });
  }

  for (const t of images) {
    if (!/\.png$/i.test(t)) continue;
    if (/\.gif$/i.test(t)) continue;
    const base = t.replace(/^File:/i, "");
    // Skip non-UI art
    if (
      /equipped|chathead|concept|detail|animation|interface|screenshot|logo|banner|update|historical|old|beta|sound|wav|mp3|self-target|timer|bloodlust|sprite/i.test(
        base,
      )
    ) {
      continue;
    }
    let score = 10;
    const lower = base.toLowerCase();
    const titleLower = resolvedTitle.toLowerCase();
    if (lower === `${titleLower}.png`) score = 90;
    else if (lower.startsWith(titleLower)) score = 50;
    else if (lower.includes(titleLower.split(" ")[0] || "")) score = 20;
    candidates.push({ file: t, score });
  }

  // pageimage only if it is already a png
  if (page.pageimage && /\.png$/i.test(page.pageimage) && !/\.gif$/i.test(page.pageimage)) {
    candidates.push({ file: `File:${page.pageimage}`, score: 40 });
  }

  candidates.sort((a, b) => b.score - a.score);
  const tried = new Set();

  for (const c of candidates) {
    const key = c.file.toLowerCase();
    if (tried.has(key)) continue;
    tried.add(key);
    if (/\.gif$/i.test(c.file)) continue;

    const info = await wikiGet({
      action: "query",
      titles: c.file,
      prop: "imageinfo",
      iiprop: "url|mime|size",
      iiurlwidth: String(THUMB),
    });
    const p = info?.query?.pages?.[0];
    const ii = p?.imageinfo?.[0];
    if (!ii || p?.missing) continue;
    if (ii.mime && ii.mime !== "image/png") continue;
    // Prefer thumburl of a PNG (static), else original url if png
    const url = ii.thumburl || ii.url;
    if (!url || /\.gif(\?|$)/i.test(url)) continue;
    if (!/\.png/i.test(url) && ii.mime !== "image/png") continue;
    return {
      pageTitle: resolvedTitle,
      fileTitle: p.title || c.file,
      url,
      mime: ii.mime,
    };
  }

  // Last resort: direct File:{Title}.png without images list
  for (const name of preferredNames) {
    const file = name.startsWith("File:") ? name : `File:${name}`;
    if (tried.has(file.toLowerCase())) continue;
    const info = await wikiGet({
      action: "query",
      titles: file,
      prop: "imageinfo",
      iiprop: "url|mime",
      iiurlwidth: String(THUMB),
    });
    const p = info?.query?.pages?.[0];
    const ii = p?.imageinfo?.[0];
    if (!ii || p?.missing || (ii.mime && ii.mime !== "image/png")) continue;
    const url = ii.thumburl || ii.url;
    if (!url || /\.gif/i.test(url)) continue;
    return {
      pageTitle: resolvedTitle,
      fileTitle: p.title || file,
      url,
      mime: ii.mime,
    };
  }

  return null;
}

async function downloadPng(url, destPath, attempt = 0) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "image/png,image/*" },
    redirect: "follow",
  });
  if (res.status === 429 || res.status === 503) {
    if (attempt >= MAX_RETRIES) throw new Error(`dl ${res.status}`);
    await sleep(1500 * (attempt + 1));
    return downloadPng(url, destPath, attempt + 1);
  }
  if (!res.ok) throw new Error(`dl ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (isGifBytes(buf)) throw new Error("got-gif");
  if (!isPngBytes(buf)) throw new Error(`not-png (${buf.slice(0, 4).toString("hex")})`);
  if (buf.length < 40 || buf.length > 500_000) throw new Error(`bad size ${buf.length}`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return { bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
}

function publicPathFor(style, slug) {
  return `/game/combat/abilities/${style}/${slug}.png`;
}

function needsRefresh(filePath) {
  if (FORCE) return true;
  if (!fs.existsSync(filePath)) return true;
  const buf = fs.readFileSync(filePath);
  if (isGifBytes(buf)) return true;
  if (!isPngBytes(buf)) return true;
  // Huge files were often multi-frame GIF dumps mislabeled
  if (buf.length > 80_000) return true;
  return false;
}

async function main() {
  const abilities = parseAbilities();
  console.log(`abilities: ${abilities.length} force=${FORCE}`);

  const icons = {};
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  let replacedGif = 0;

  for (const a of abilities) {
    const slug = slugFromId(a.id);
    const relPublic = publicPathFor(a.style, slug).slice(1);
    const publicFile = path.join(root, "public", relPublic);
    const assetFile = path.join(root, "assets/rs3/combat/abilities", a.style, `${slug}.png`);

    if (!needsRefresh(publicFile)) {
      icons[a.id] = {
        ok: true,
        path: publicPathFor(a.style, slug),
        style: a.style,
        pageTitle: a.pageTitle,
        category: a.category,
        cached: true,
        static: true,
      };
      skipped++;
      if (!fs.existsSync(assetFile)) {
        fs.mkdirSync(path.dirname(assetFile), { recursive: true });
        fs.copyFileSync(publicFile, assetFile);
      }
      continue;
    }

    if (fs.existsSync(publicFile) && isGifBytes(fs.readFileSync(publicFile))) {
      replacedGif++;
    }

    let resolved = null;
    try {
      resolved = await resolveStaticPng(a.pageTitle);
      if (!resolved && a.wikiPath) {
        resolved = await resolveStaticPng(a.wikiPath.replace(/_/g, " "));
      }
      if (!resolved && a.name) {
        resolved = await resolveStaticPng(a.name);
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
      await sleep(DELAY_MS);
      continue;
    }

    if (!resolved?.url) {
      icons[a.id] = {
        ok: false,
        error: "no-static-png",
        style: a.style,
        pageTitle: a.pageTitle,
        category: a.category,
      };
      failed++;
      await sleep(DELAY_MS);
      continue;
    }

    try {
      const meta = await downloadPng(resolved.url, publicFile);
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
        static: true,
      };
      downloaded++;
    } catch (e) {
      icons[a.id] = {
        ok: false,
        error: String(e.message || e),
        style: a.style,
        pageTitle: a.pageTitle,
        sourceUrl: resolved.url,
        category: a.category,
      };
      failed++;
    }
    await sleep(DELAY_MS);
  }

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    count: abilities.length,
    ok: Object.values(icons).filter((e) => e.ok).length,
    failed: Object.values(icons).filter((e) => !e.ok).length,
    note: "Static PNG UI icons only under /game/combat/abilities/<style>/. Animated wiki GIFs rejected. Attribution: RuneScape Wiki / Jagex.",
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
      { downloaded, skipped, failed, replacedGif, ok: out.ok, total: out.count },
      null,
      2,
    ),
  );
  if (failed) {
    console.log(
      "failed:\n" +
        Object.entries(icons)
          .filter(([, v]) => !v.ok)
          .map(([id, v]) => `${id} | ${v.pageTitle} | ${v.error}`)
          .join("\n"),
    );
  }
}

await main();
