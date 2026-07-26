/**
 * User ruling (session):
 * - Black mask: Morytania OR Wilderness (Forinthry)
 * - Hexcrest: Kandarin
 * - Focus sight: Desert
 * - Corrupted gem / ensouled spectral lens: Desert
 * - Full corrupted slayer helm: UNOBTAINABLE (needs 4 regions)
 * Remove mega-row "Slayer helmet component farms"
 */
import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];
const now = "2026-07-26";

function removeAll(name) {
  let c = 0;
  for (const r of cat.regions) {
    const b = r.upgrades.length;
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
    c += b - r.upgrades.length;
  }
  if (c) log.push(`RM ${c}× ${name}`);
}

function removeMatching(re) {
  let c = 0;
  for (const r of cat.regions) {
    const before = r.upgrades.length;
    r.upgrades = r.upgrades.filter((u) => !re.test(u.name));
    c += before - r.upgrades.length;
  }
  if (c) log.push(`RM~ ${c}× ${re}`);
}

function findAny(pred) {
  for (const r of cat.regions) {
    const u = r.upgrades.find(pred);
    if (u) return JSON.parse(JSON.stringify(u));
  }
  return null;
}

function place(name, hosts, req, extra = {}) {
  let t =
    findAny((u) => u.name === name) ||
    findAny((u) => u.name.toLowerCase() === name.toLowerCase());
  if (!t) {
    t = {
      name,
      category: extra.category || "Slayer helmet component",
      detail: "",
      requirements: [],
      confidence: "user_ruling_2026-07-26",
      source: {
        source: "derived",
        url: extra.url || "https://runescape.wiki/w/Slayer_helmet",
        title: name,
        verifiedAt: now,
      },
    };
  }
  const allow = new Set(hosts);
  // wipe existing name from all regions first
  for (const r of cat.regions) {
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
  }
  for (const rid of hosts) {
    const r = cat.regions.find((x) => x.id === rid);
    if (!r) continue;
    const c = JSON.parse(JSON.stringify(t));
    c.name = name;
    c.regionId = rid;
    c.requiredRegions = [...req];
    Object.assign(c, extra);
    // strip host-only fields that shouldn't clobber
    delete c.uo;
    r.upgrades.push(c);
  }
  log.push(`PLACE ${name} → [${hosts.join(",")}] req=[${req.join(",") || "∅"}]`);
}

// ── 1. Kill mega-row + bad residual ──────────────────────────────────────
removeAll("Slayer helmet component farms");
removeAll("Hexcrest (slayer helm component)"); // wrong mory-only residual from reapply
removeAll("Scarab / necromancy-adjacent slayer helm pieces");

// ── 2. Black mask — Morytania OR Forinthry (empty AND req) ───────────────
place(
  "Black mask",
  ["morytania", "forinthry"],
  [],
  {
    category: "Slayer helmet melee component",
    detail:
      "Black mask (melee slayer helm component). User ruling: Morytania OR Forinthry/Wilderness — either region supplies the farm path. Not an AND of both. Full corrupted helm is UNOBTAINABLE under the 3-elective cap (4 style pieces).",
    url: "https://runescape.wiki/w/Black_mask",
  },
);

// ── 3. Hexcrest — Kandarin (user; move off Karamja) ──────────────────────
place(
  "Hexcrest",
  ["kandarin"],
  ["kandarin"],
  {
    category: "Slayer helmet Magic component",
    detail:
      "Hexcrest (Magic slayer helm component). User ruling: Kandarin. Not multi-locked to other style pieces — piece-level geography only. Full corrupted helm UNOBTAINABLE (4 regions).",
    url: "https://runescape.wiki/w/Hexcrest",
  },
);

// ── 4. Focus sight — Desert ──────────────────────────────────────────────
place(
  "Focus sight",
  ["desert"],
  ["desert"],
  {
    category: "Slayer helmet Ranged component",
    detail:
      "Focus sight (Ranged slayer helm component). User ruling: Desert. Piece-level only; full corrupted helm UNOBTAINABLE (4 regions).",
    url: "https://runescape.wiki/w/Focus_sight",
  },
);

// ── 5. Spectral lens + ensouled — Desert ─────────────────────────────────
place(
  "Spectral lens",
  ["desert"],
  ["desert"],
  {
    category: "Slayer helmet Necromancy component",
    detail:
      "Spectral lens (Necromancy helm component drop). User ruling: Desert for lens / corrupted-gem path. Ensoul step may use Um ritual infrastructure but piece ownership is Desert.",
    url: "https://runescape.wiki/w/Spectral_lens",
  },
);

place(
  "Ensouled spectral lens / corrupted gem path",
  ["desert"],
  ["desert"],
  {
    category: "Slayer helmet Necromancy component",
    detail:
      "Corrupted gem / ensouled spectral lens path for Necromancy-style full helm attachment. User ruling: Desert. Full corrupted slayer helmet still UNOBTAINABLE (needs four region-style pieces under 3-elective).",
    url: "https://runescape.wiki/w/Ensouled_spectral_lens",
  },
);

// ── 6. Base craft helm stays Morytania; full corrupted UO marker ─────────
// Keep existing "Slayer helmet (craft unlock + base helm)" if present
{
  const name = "Slayer helmet (craft unlock + base helm)";
  const t = findAny((u) => u.name === name);
  if (t) {
    place(name, ["morytania"], ["morytania"], {
      category: t.category || "Slayer",
      detail:
        (t.detail || "") +
        " · Base black-mask helm craft. Style pieces are separate rows (black mask / hexcrest / focus sight / spectral). Full multi-style corrupted helm is UNOBTAINABLE (4 regions).",
    });
  }
}

// Explicit UO row so planners see the wall
{
  const name = "Corrupted / full multi-style Slayer helmet (all components)";
  removeAll(name);
  const mory = cat.regions.find((r) => r.id === "morytania");
  mory.upgrades.push({
    name,
    category: "Slayer helmet endgame",
    detail:
      "UNOBTAINABLE under Equilibrium 3-elective cap. Full multi-style / corrupted helm needs black mask (Morytania OR Forinthry) + Hexcrest (Kandarin) + Focus sight (Desert) + spectral/corrupted path (Desert) — four hard region pressures. Track individual pieces instead. · UNOBTAINABLE under Equilibrium 3-elective cap (region pressure exceeds picks).",
    requirements: [
      "Black mask",
      "Hexcrest",
      "Focus sight",
      "Ensouled spectral lens / corrupted gem",
    ],
    confidence: "user_ruling_2026-07-26",
    source: {
      source: "derived",
      url: "https://runescape.wiki/w/Corrupted_slayer_helmet",
      title: "Corrupted slayer helmet",
      verifiedAt: now,
    },
    regionId: "morytania",
    requiredRegions: ["morytania", "kandarin", "desert", "forinthry"],
  });
  // also list on desert/kandarin for visibility
  for (const rid of ["desert", "kandarin", "forinthry"]) {
    const r = cat.regions.find((x) => x.id === rid);
    const copy = JSON.parse(JSON.stringify(mory.upgrades[mory.upgrades.length - 1]));
    copy.regionId = rid;
    r.upgrades.push(copy);
  }
  log.push("UO Corrupted/full multi-style helm on mory/desert/kand/forin");
}

dedupeRegionUpgrades(cat);
fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");
console.log(log.join("\n"));
// verify
for (const sub of [
  "Black mask",
  "Hexcrest",
  "Focus sight",
  "Spectral",
  "Ensouled",
  "component farms",
  "Corrupted / full",
  "Slayer helmet (craft",
]) {
  const hits = [];
  for (const r of cat.regions)
    for (const u of r.upgrades)
      if (u.name.includes(sub) || u.name.toLowerCase().includes(sub.toLowerCase()))
        hits.push(`${r.id}: ${u.name} req=${JSON.stringify(u.requiredRegions || [])}`);
  console.log("\n" + sub + " →", hits.length ? hits.join(" | ") : "NONE");
}
