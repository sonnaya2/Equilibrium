/**
 * Resolve + download inventory icons for combat equipment wearables.
 * Policy: local cache under assets/ + public/game — never hotlink wiki at runtime.
 *
 * Uses MediaWiki pageimages (batch titles) + retries on 429. Prefer pageimage
 * thumbnails over scraping File: lists (which pick random page images).
 *
 * Usage:
 *   node scripts/sync-equipment-icons.mjs              # all wearables
 *   node scripts/sync-equipment-icons.mjs --shard 0/10
 *   node scripts/sync-equipment-icons.mjs --merge
 *   node scripts/sync-equipment-icons.mjs --retry-failed
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WIKI_API = "https://runescape.wiki/api.php";
const UA = "EquilibriumEquipmentIcons/1.0 (https://github.com/sonnaya2/Equilibrium)";
const BATCH = 40;
const DELAY_MS = 350;
const THUMB = 64;
const MAX_RETRIES = 6;

const args = process.argv.slice(2);
const mergeOnly = args.includes("--merge");
const retryFailed = args.includes("--retry-failed");
const shardArg = args.find((a) => a.startsWith("--shard"));
const shardSpec = shardArg
  ? args[args.indexOf(shardArg) + 1] || shardArg.split("=")[1]
  : null;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function slugFromId(id) {
  return String(id).replace(/^item:/, "");
}

/** Known catalogue names → actual wiki page titles (case/rename). */
const TITLE_ALIASES = {
  "item:trimmed-masterwork-spear-of-annihilation": "Masterwork Spear of Annihilation",
  "item:vestments-of-havoc-hood": "Vestments of havoc hood",
  "item:vestments-of-havoc-robe-top": "Vestments of havoc robe top",
  "item:vestments-of-havoc-robe-bottom": "Vestments of havoc robe bottom",
  "item:vestments-of-havoc-boots": "Vestments of havoc boots",
  "item:elite-tetsu-helm": "Superior tetsu helm",
  "item:elite-tetsu-body": "Superior tetsu body",
  "item:elite-tetsu-platelegs": "Superior tetsu platelegs",
  "item:elite-death-lotus-hood": "Superior Death Lotus hood",
  "item:elite-death-lotus-chestplate": "Superior Death Lotus chestplate",
  "item:elite-death-lotus-chaps": "Superior Death Lotus chaps",
  "item:deathdealer-hood": "Deathdealer hood (tier 70)",
  "item:deathdealer-robe-top": "Deathdealer robe top (tier 70)",
  "item:deathdealer-robe-bottom": "Deathdealer robe bottom (tier 70)",
  "item:deathdealer-gloves": "Deathdealer gloves (tier 70)",
  "item:deathdealer-boots": "Deathdealer boots (tier 70)",
  "item:deathdealer-hood-t80": "Deathdealer hood (tier 80)",
  "item:deathdealer-robe-top-t80": "Deathdealer robe top (tier 80)",
  "item:deathdealer-robe-bottom-t80": "Deathdealer robe bottom (tier 80)",
  "item:deathdealer-gloves-t80": "Deathdealer gloves (tier 80)",
  "item:deathdealer-boots-t80": "Deathdealer boots (tier 80)",
  "item:deathdealer-hood-t90": "Deathdealer hood (tier 90)",
  "item:deathdealer-robe-top-t90": "Deathdealer robe top (tier 90)",
  "item:deathdealer-robe-bottom-t90": "Deathdealer robe bottom (tier 90)",
  "item:deathdealer-gloves-t90": "Deathdealer gloves (tier 90)",
  "item:deathdealer-boots-t90": "Deathdealer boots (tier 90)",
};

function wikiTitleFromRecord(r) {
  if (TITLE_ALIASES[r.id]) return TITLE_ALIASES[r.id];
  const url = r.sources?.find((s) => s?.url?.includes("runescape.wiki"))?.url;
  if (url) {
    try {
      const u = new URL(url);
      if (u.pathname.startsWith("/w/")) {
        return decodeURIComponent(u.pathname.slice(3)).replace(/_/g, " ");
      }
    } catch {
      /* fall through */
    }
  }
  return r.name;
}

/** When pageimages is empty, try inventory / detail File: titles. */
async function resolveFileFallback(pageTitle) {
  const candidates = [
    `File:${pageTitle}.png`,
    `File:${pageTitle} detail.png`,
    `File:${pageTitle.replace(/ /g, "_")}_detail.png`,
  ];
  for (const title of candidates) {
    try {
      const data = await wikiGet({
        action: "query",
        titles: title,
        prop: "imageinfo",
        iiprop: "url|mime",
        iiurlwidth: String(THUMB),
      });
      const page = data?.query?.pages?.[0];
      const ii = page?.imageinfo?.[0];
      if (page?.missing || !ii) continue;
      const url = ii.thumburl || ii.url;
      if (url) return { pageTitle, fileTitle: page.title, url };
    } catch {
      /* try next */
    }
    await sleep(100);
  }
  return null;
}

async function wikiGet(params, attempt = 0) {
  const q = new URLSearchParams({ format: "json", formatversion: "2", origin: "*", ...params });
  const res = await fetch(`${WIKI_API}?${q}`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (res.status === 429 || res.status === 503) {
    if (attempt >= MAX_RETRIES) throw new Error(`wiki ${res.status}`);
    const wait = 1500 * (attempt + 1) + Math.random() * 500;
    console.warn(`  rate-limit ${res.status}, retry in ${Math.round(wait)}ms`);
    await sleep(wait);
    return wikiGet(params, attempt + 1);
  }
  if (!res.ok) throw new Error(`wiki ${res.status}`);
  return res.json();
}

/**
 * Batch pageimages for many titles. Returns Map<title, {pageTitle, fileTitle, url}>.
 */
async function batchPageImages(titles) {
  const unique = [...new Set(titles.filter(Boolean))];
  const out = new Map();
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
      if (page.missing) continue;
      if (!page.thumbnail?.source) continue;
      out.set(page.title, {
        pageTitle: page.title,
        fileTitle: page.pageimage ? `File:${page.pageimage}` : null,
        url: page.thumbnail.source,
      });
      // also map request title variants
      out.set(page.title.replace(/_/g, " "), out.get(page.title));
    }
    // redirects: MediaWiki may normalize; map from redirects list
    for (const red of data?.query?.redirects ?? []) {
      if (out.has(red.to)) out.set(red.from, out.get(red.to));
    }
    for (const norm of data?.query?.normalized ?? []) {
      if (out.has(norm.to)) out.set(norm.from, out.get(norm.to));
    }
    await sleep(DELAY_MS);
  }
  return out;
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
  if (!res.ok) throw new Error(`dl ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 40 || buf.length > 2_000_000) throw new Error(`bad size ${buf.length}`);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return {
    bytes: buf.length,
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
}

function loadWearables() {
  const eq = JSON.parse(fs.readFileSync(path.join(root, "data/combat/equipment.json"), "utf8"));
  return eq.records.filter((r) => r.slot);
}

function parseShard(spec) {
  if (!spec) return { index: 0, of: 1 };
  const m = String(spec).match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!m) throw new Error(`bad --shard ${spec}, want N/M`);
  const index = Number(m[1]);
  const of = Number(m[2]);
  if (index < 0 || of < 1 || index >= of) throw new Error(`shard out of range ${spec}`);
  return { index, of };
}

function mergeShards() {
  const dir = path.join(root, "scraped-data");
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^equipment-icons-shard-\d+\.json$/.test(f) || f === "equipment-icons-retry.json")
    .sort();
  const map = {};

  // Seed from previous merge so retries cannot wipe earlier successes.
  const dest = path.join(root, "data/combat/equipment-icons.json");
  if (fs.existsSync(dest)) {
    try {
      const prev = JSON.parse(fs.readFileSync(dest, "utf8"));
      Object.assign(map, prev.icons || {});
    } catch {
      /* ignore corrupt */
    }
  }

  function absorb(icons) {
    for (const [id, entry] of Object.entries(icons || {})) {
      if (!map[id] || (entry.ok && !map[id].ok)) map[id] = entry;
      else if (entry.ok && map[id].ok && entry.cached === false) map[id] = entry;
    }
  }

  for (const f of files) {
    const shard = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    absorb(shard.icons);
  }

  // Disk is ground truth: any wearable with a local PNG is ok.
  for (const r of loadWearables()) {
    const slug = slugFromId(r.id);
    const publicRel = `/game/combat/equipment/${slug}.png`;
    const publicPath = path.join(root, "public", publicRel.slice(1));
    if (fs.existsSync(publicPath) && fs.statSync(publicPath).size > 40) {
      map[r.id] = {
        ...(map[r.id] || {}),
        ok: true,
        path: publicRel,
        asset: `assets/rs3/combat/equipment/${slug}.png`,
        pageTitle: map[r.id]?.pageTitle || wikiTitleFromRecord(r),
        cached: true,
      };
    } else if (!map[r.id]) {
      map[r.id] = { ok: false, error: "missing-file", pageTitle: wikiTitleFromRecord(r) };
    } else if (map[r.id].ok && !fs.existsSync(publicPath)) {
      map[r.id] = { ...map[r.id], ok: false, error: "missing-file" };
    }
  }

  const out = {
    generatedAt: new Date().toISOString().slice(0, 10),
    count: Object.keys(map).length,
    ok: Object.values(map).filter((e) => e.ok).length,
    failed: Object.values(map).filter((e) => !e.ok).length,
    note: "Local paths under /game/combat/equipment/. Attribution: RuneScape Wiki / Jagex. Never hotlink wiki at runtime.",
    icons: map,
  };
  fs.writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    JSON.stringify(
      { merged: true, files: files.length, count: out.count, ok: out.ok, failed: out.failed, dest },
      null,
      2,
    ),
  );
  return out;
}

async function processRecords(records, label) {
  console.log(`${label}: ${records.length} wearables`);
  const titles = records.map(wikiTitleFromRecord);
  const imageMap = await batchPageImages(titles);

  const icons = {};
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of records) {
    const title = wikiTitleFromRecord(r);
    const slug = slugFromId(r.id);
    const relAsset = `assets/rs3/combat/equipment/${slug}.png`;
    const relPublic = `public/game/combat/equipment/${slug}.png`;
    const assetPath = path.join(root, relAsset);
    const publicPath = path.join(root, relPublic);

    let resolved =
      imageMap.get(title) ||
      imageMap.get(title.replace(/_/g, " ")) ||
      null;

    // Per-title fallback if batch missed (redirect edge cases / no pageimage)
    if (!resolved) {
      try {
        const one = await batchPageImages([title]);
        resolved = one.get(title) || [...one.values()][0] || null;
      } catch (e) {
        icons[r.id] = { ok: false, error: String(e.message || e), pageTitle: title };
        failed++;
        continue;
      }
    }
    if (!resolved?.url) {
      resolved = await resolveFileFallback(title);
    }

    if (!resolved?.url) {
      icons[r.id] = { ok: false, error: "no-icon", pageTitle: title };
      failed++;
      continue;
    }

    try {
      if (fs.existsSync(assetPath) && fs.statSync(assetPath).size > 40) {
        if (!fs.existsSync(publicPath)) {
          fs.mkdirSync(path.dirname(publicPath), { recursive: true });
          fs.copyFileSync(assetPath, publicPath);
        }
        icons[r.id] = {
          ok: true,
          path: `/game/combat/equipment/${slug}.png`,
          asset: relAsset,
          pageTitle: resolved.pageTitle,
          fileTitle: resolved.fileTitle,
          sourceUrl: resolved.url.split("?")[0],
          cached: true,
        };
        skipped++;
      } else {
        const meta = await download(resolved.url, assetPath);
        fs.mkdirSync(path.dirname(publicPath), { recursive: true });
        fs.copyFileSync(assetPath, publicPath);
        icons[r.id] = {
          ok: true,
          path: `/game/combat/equipment/${slug}.png`,
          asset: relAsset,
          pageTitle: resolved.pageTitle,
          fileTitle: resolved.fileTitle,
          sourceUrl: resolved.url.split("?")[0],
          bytes: meta.bytes,
          sha256: meta.sha256,
          cached: false,
        };
        downloaded++;
        await sleep(80);
      }
    } catch (e) {
      icons[r.id] = {
        ok: false,
        error: String(e.message || e),
        pageTitle: title,
        sourceUrl: resolved.url,
      };
      failed++;
    }
  }

  return { icons, downloaded, skipped, failed };
}

async function runShard(index, of) {
  const wearables = loadWearables();
  const slice = wearables.filter((_, i) => i % of === index);
  const result = await processRecords(slice, `shard ${index}/${of}`);

  const out = {
    shard: `${index}/${of}`,
    fetchedAt: new Date().toISOString(),
    targets: slice.length,
    downloaded: result.downloaded,
    skipped: result.skipped,
    failed: result.failed,
    icons: result.icons,
  };
  const outPath = path.join(root, "scraped-data", `equipment-icons-shard-${index}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(
    JSON.stringify({
      wrote: outPath,
      targets: out.targets,
      downloaded: out.downloaded,
      skipped: out.skipped,
      failed: out.failed,
    }),
  );
  return out;
}

async function runRetryFailed() {
  const mapPath = path.join(root, "data/combat/equipment-icons.json");
  let failedIds = [];
  if (fs.existsSync(mapPath)) {
    const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    failedIds = Object.entries(map.icons || {})
      .filter(([, v]) => !v.ok)
      .map(([id]) => id);
  }
  // Also include wearables with no map entry or missing file
  const wearables = loadWearables();
  const need = wearables.filter((r) => {
    if (failedIds.includes(r.id)) return true;
    const slug = slugFromId(r.id);
    const assetPath = path.join(root, `assets/rs3/combat/equipment/${slug}.png`);
    return !fs.existsSync(assetPath) || fs.statSync(assetPath).size < 40;
  });
  console.log(`retry-failed: ${need.length} items`);
  const result = await processRecords(need, "retry-failed");
  const outPath = path.join(root, "scraped-data", "equipment-icons-retry.json");
  fs.writeFileSync(
    outPath,
    `${JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        targets: need.length,
        ...result,
      },
      null,
      2,
    )}\n`,
  );
  // merge into shard-style map file for mergeShards
  const shardPath = path.join(root, "scraped-data", "equipment-icons-shard-99.json");
  fs.writeFileSync(
    shardPath,
    `${JSON.stringify(
      {
        shard: "retry",
        fetchedAt: new Date().toISOString(),
        icons: result.icons,
      },
      null,
      2,
    )}\n`,
  );
  mergeShards();
  console.log(JSON.stringify({ wrote: outPath, downloaded: result.downloaded, failed: result.failed }));
}

if (mergeOnly) {
  mergeShards();
} else if (retryFailed) {
  await runRetryFailed();
} else {
  const { index, of } = parseShard(shardSpec);
  await runShard(index, of);
  if (of === 1) mergeShards();
}
