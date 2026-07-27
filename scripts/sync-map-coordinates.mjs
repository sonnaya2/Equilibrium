/**
 * Check every board pin against the RuneScape Wiki's own coordinate.
 *
 *   node scripts/sync-map-coordinates.mjs            report only
 *   node scripts/sync-map-coordinates.mjs --write    apply the safe corrections
 *
 * The pins in gameCoords.ts were placed by hand and a good number of them are
 * tens or hundreds of tiles out. The Wiki carries the real number in the
 * location infobox, so this reads it rather than anyone re-guessing:
 *
 *   {{Map|x=3212|y=3443}}                  surface, straight from the infobox
 *   {{Maplink|mapID=669|x=4487|y=6265}}    a dungeon's own space — not surface
 *
 * The discriminator is MAP_BOUNDS. An instanced or underground map numbers its
 * tiles in its own space, and those numbers land nowhere near the surface crop,
 * so anything outside the board's own bounds is rejected rather than pasted in.
 * Places that only *have* such a coordinate (Araxxor, the Blood altar, City of
 * Um) need a surface *entrance*, which is a judgement call and is reported for a
 * human rather than invented here.
 *
 * Responses are cached under .wiki-cache/ (untracked) so a re-run costs nothing
 * and the wiki gets hit once per page. One request a second, real User-Agent —
 * runescape.wiki asks for both.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ANCHORS_TS = path.join(ROOT, "src/map/data/placeAnchors.ts");
const COORDS_TS = path.join(ROOT, "src/map/data/gameCoords.ts");
const CACHE = path.join(ROOT, ".wiki-cache/coords");

/** Mirrors MAP_BOUNDS. A coordinate outside this is not on the surface map. */
const BOUNDS = { minX: 1792, minY: 2560, maxX: 4864, maxY: 4608 };
/** Report anything further than this from what we ship. */
const DRIFT_TILES = 40;
/** Below this the wiki and the table are saying the same thing. */
const AGREE_TILES = 12;
const UA = "RS3Equilibrium/1.0 (https://github.com/sonnaya2/Equilibrium; map coordinate audit)";

fs.mkdirSync(CACHE, { recursive: true });

const rows = [
  ...fs
    .readFileSync(ANCHORS_TS, "utf8")
    .matchAll(/\{\s*region:\s*"([a-z]+)",\s*area:\s*"((?:[^"\\]|\\.)*)"(,\s*site:\s*true)?/g),
].map((m) => ({ region: m[1], area: m[2].replace(/\\(.)/g, "$1"), site: Boolean(m[3]) }));
if (rows.length < 120) throw new Error(`placeAnchors.ts parse found only ${rows.length} anchors`);

const { placeMapCoord } = await import("../src/map/data/gameCoords.ts");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function wikitext(title) {
  const slug = title.replace(/[^A-Za-z0-9]+/g, "_");
  const file = path.join(CACHE, `${slug}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));

  const url =
    "https://runescape.wiki/api.php?action=parse&prop=wikitext&format=json&formatversion=2" +
    `&redirects=1&page=${encodeURIComponent(title)}`;
  let body = { missing: true };
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) {
      const json = await res.json();
      body = json?.parse?.wikitext
        ? { title: json.parse.title, text: json.parse.wikitext }
        : { missing: true };
    }
  } catch (err) {
    body = { error: String(err) };
  }
  fs.writeFileSync(file, JSON.stringify(body));
  await sleep(1000);
  return body;
}

/** Every x/y pair the page offers, in source order. */
function coordinates(text) {
  const out = [];
  for (const m of text.matchAll(/\{\{\s*Map(?:link)?\s*\|([^}]*)\}\}/gi)) {
    const body = m[1];
    const x = /\|?\s*x\s*=\s*(\d+)/.exec(body);
    const y = /\|?\s*y\s*=\s*(\d+)/.exec(body);
    const mapId = /mapID\s*=\s*(\d+)/i.exec(body);
    if (x && y) out.push({ x: Number(x[1]), y: Number(y[1]), mapId: mapId ? Number(mapId[1]) : null });
  }
  return out;
}

const onSurface = (c) =>
  c.x >= BOUNDS.minX && c.x <= BOUNDS.maxX && c.y >= BOUNDS.minY && c.y <= BOUNDS.maxY;

const leagueRegion = (text) => {
  const m = /leagueRegion\s*=\s*([^\n|}]+)/i.exec(text);
  return m ? m[1].trim() : null;
};

// ------------------------------------------------------------------ run ----

const agreed = [];
const drifted = [];
const offSurface = [];
const noCoord = [];
const noPage = [];

console.log(`[coords] checking ${rows.length} pins against runescape.wiki\n`);
for (const row of rows) {
  const ours = placeMapCoord(row.region, row.area);
  const page = await wikitext(row.area);
  if (page.missing || page.error) {
    noPage.push({ ...row, ours });
    continue;
  }
  const all = coordinates(page.text);
  const surface = all.filter(onSurface);
  const record = {
    ...row,
    ours,
    title: page.title,
    league: leagueRegion(page.text),
  };
  if (!all.length) {
    noCoord.push(record);
  } else if (!surface.length) {
    offSurface.push({ ...record, elsewhere: all[0] });
  } else {
    const wiki = surface[0];
    const d = ours ? Math.round(Math.hypot(wiki.x - ours[0], wiki.y - ours[1])) : Infinity;
    const entry = { ...record, wiki, drift: d };
    if (d <= AGREE_TILES) agreed.push(entry);
    else drifted.push(entry);
  }
}

drifted.sort((a, b) => b.drift - a.drift);

console.log(`AGREE (within ${AGREE_TILES} tiles): ${agreed.length}`);
console.log(`\nDRIFTED — wiki has a surface coordinate and it disagrees (${drifted.length}):`);
for (const d of drifted) {
  const flag = d.drift > DRIFT_TILES ? "  <-- FIX" : "";
  console.log(
    `  ${(d.region + "/" + d.area).padEnd(40)} ours ${String(d.ours[0]).padStart(4)},${String(
      d.ours[1],
    ).padStart(4)}  wiki ${String(d.wiki.x).padStart(4)},${String(d.wiki.y).padStart(4)}  ${String(
      d.drift,
    ).padStart(4)} tiles${flag}`,
  );
}
console.log(`\nOFF-SURFACE — only an instanced/underground coordinate (${offSurface.length}):`);
for (const o of offSurface) {
  console.log(
    `  ${(o.region + "/" + o.area).padEnd(40)} wiki map ${o.elsewhere.mapId ?? "?"} @ ${o.elsewhere.x},${o.elsewhere.y}  (needs a surface entrance)`,
  );
}
console.log(`\nNO COORDINATE on the page (${noCoord.length}):`);
for (const n of noCoord) console.log(`  ${n.region}/${n.area}`);
console.log(`\nNO PAGE (${noPage.length}):`);
for (const n of noPage) console.log(`  ${n.region}/${n.area}`);

/**
 * The wiki carries a `leagueRegion` on most location infoboxes — its own answer
 * to which League region a place belongs to. That is the closest thing to
 * authoritative region data that exists, so it is worth diffing against our
 * tags rather than trusting either side blindly.
 *
 * Names differ between the two: the wiki writes "Wilderness" for what the
 * catalog calls forinthry, and "Desert" or "Kharidian Desert" interchangeably.
 * The alias table is a naming bridge, not a judgement — a disagreement it does
 * not cover is a real one.
 */
const ALIASES = {
  forinthry: ["wilderness", "forinthry"],
  desert: ["desert", "kharidiandesert"],
  fremennik: ["fremennik", "fremennikprovince", "fremenniks"],
  misthalin: ["misthalin"],
  asgarnia: ["asgarnia"],
  kandarin: ["kandarin"],
  karamja: ["karamja"],
  morytania: ["morytania"],
  tirannwn: ["tirannwn"],
  anachronia: ["anachronia"],
  havenhythe: ["havenhythe"],
};
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, "");
const withLeague = [...agreed, ...drifted, ...offSurface, ...noCoord].filter((r) => r.league);
const mismatched = withLeague.filter(
  (r) => !(ALIASES[r.region] ?? [r.region]).includes(norm(r.league)),
);
console.log(
  `\nLEAGUE REGION — wiki states one for ${withLeague.length} of ${rows.length} pins, ` +
    `${mismatched.length} disagree with our tag:`,
);
for (const m of mismatched) {
  console.log(`  ${(m.region + "/" + m.area).padEnd(40)} wiki says "${m.league}"`);
}

/**
 * Commit what the wiki said, so the border gate can run offline.
 *
 * This is the only sourced statement of region membership that exists, and it
 * is what makes "did the partition put this place in the right region" a test
 * rather than an opinion. plates.test.ts reads it; nothing at runtime does.
 */
const LEAGUE_OUT = path.join(ROOT, "data/map/wiki-league-regions.json");
fs.writeFileSync(
  LEAGUE_OUT,
  JSON.stringify(
    {
      note:
        "leagueRegion as stated by each location's infobox on runescape.wiki, " +
        "written by scripts/sync-map-coordinates.mjs. Sourced region membership: " +
        "the board's partition must agree with it. Not league data — a check on ours.",
      fetchedAt: new Date().toISOString().slice(0, 10),
      places: Object.fromEntries(
        withLeague
          .map((r) => [`${r.region}/${r.area}`, r.league])
          .sort((a, b) => a[0].localeCompare(b[0])),
      ),
    },
    null,
    2,
  ) + "\n",
);
console.log(`\n[coords] wrote ${withLeague.length} sourced league regions to data/map/`);

// ---------------------------------------------------------------- write ----

if (process.argv.includes("--write")) {
  /**
   * Bounds alone are not enough to prove a coordinate is on the surface. Some
   * instanced maps number their tiles right through the surface range —
   * Zanaris reads 2433,4432 and the Corporeal Beast's cave 2971,4382, both of
   * which look perfectly plausible and are both 600+ tiles from the real place.
   *
   * So a rewrite also has to land on actual land, inside the plate of the region
   * that owns the pin. That is cheap, objective, and rejects exactly the class
   * of coordinate that would otherwise sail through.
   */
  const plates = JSON.parse(
    fs.readFileSync(path.join(ROOT, "public/map/region-plates.json"), "utf8"),
  );
  const inRing = (px, py, flat) => {
    let inside = false;
    const n = flat.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = flat[i * 2];
      const yi = flat[i * 2 + 1];
      const xj = flat[j * 2];
      const yj = flat[j * 2 + 1];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  };
  const inOwnRegion = (region, c) =>
    (plates.regions[region]?.rings ?? []).some((ring) => inRing(c.x, c.y, ring));

  /**
   * Where a place has no map of its own, the wiki hands back its parent's
   * anchor — Troll Stronghold answers with Death Plateau's point. Taking that
   * stacks two pins on one tile and makes one of them unclickable, which is the
   * same defect the audit flags. A rewrite may not land on a point already in
   * use.
   */
  const taken = new Map();
  for (const row of rows) {
    const p = placeMapCoord(row.region, row.area);
    if (p) taken.set(`${p[0]},${p[1]}`, row.area);
  }

  const safe = [];
  const rejected = [];
  const collided = [];
  for (const d of drifted) {
    if (d.drift <= DRIFT_TILES) continue;
    if (!inOwnRegion(d.region, d.wiki)) {
      rejected.push(d);
      continue;
    }
    const key = `${d.wiki.x},${d.wiki.y}`;
    const holder = taken.get(key);
    if (holder && holder !== d.area) {
      collided.push({ ...d, holder });
      continue;
    }
    taken.set(key, d.area);
    safe.push(d);
  }
  console.log(`\nCOLLIDED — wiki point is already another pin (${collided.length}):`);
  for (const c of collided) {
    console.log(
      `  ${(c.region + "/" + c.area).padEnd(40)} wiki ${c.wiki.x},${c.wiki.y} is ${c.holder}'s point — page has no map of its own`,
    );
  }
  console.log(`\nREJECTED — wiki point is not on this region's land (${rejected.length}):`);
  for (const r of rejected) {
    console.log(
      `  ${(r.region + "/" + r.area).padEnd(40)} wiki ${r.wiki.x},${r.wiki.y} (${r.drift} tiles) — another map, or the region border moved`,
    );
  }
  let text = fs.readFileSync(COORDS_TS, "utf8");
  let applied = 0;
  for (const d of safe) {
    const escaped = d.area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(\\["${escaped}", \\[)\\d+, \\d+(\\]\\])`);
    if (!re.test(text)) {
      console.log(`  ! could not rewrite ${d.area}`);
      continue;
    }
    text = text.replace(re, `$1${d.wiki.x}, ${d.wiki.y}$2`);
    applied++;
  }
  fs.writeFileSync(COORDS_TS, text);
  console.log(`\n[coords] rewrote ${applied} coordinates from the wiki`);
}
