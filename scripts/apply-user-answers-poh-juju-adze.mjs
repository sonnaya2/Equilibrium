/**
 * User answers (session):
 * 1. Marble blocks / gilded altar / magic stones hard in frem+tir+forin
 * 2. Slayer Introspection: Desert + Kandarin + Morytania (casket OR note)
 * 3. Juju = Karamja; Harmony moss = Tirannwn hard; Inferno adze = both Asg+Forin;
 *    Alchemical onyx = global; Extreme invention = Kandarin only
 * 4. Autoheater = Wilderness/Forinthry
 */
import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];
const now = "2026-07-26";

function findTemplate(name) {
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u) return JSON.parse(JSON.stringify(u));
  }
  return null;
}

function keep(name, hosts, req, extra = {}) {
  let t = findTemplate(name);
  if (!t) {
    for (const r of cat.regions) {
      const u = r.upgrades.find((x) => x.name.includes(name.slice(0, 28)));
      if (u) {
        t = JSON.parse(JSON.stringify(u));
        name = u.name;
        break;
      }
    }
  }
  if (!t) {
    log.push(`MISS ${name}`);
    return name;
  }
  const allow = new Set(hosts);
  for (const r of cat.regions) {
    const idx = r.upgrades.findIndex((x) => x.name === name);
    if (allow.has(r.id)) {
      if (idx < 0) {
        const c = JSON.parse(JSON.stringify(t));
        c.regionId = r.id;
        c.requiredRegions = [...req];
        Object.assign(c, extra);
        r.upgrades.push(c);
      } else {
        Object.assign(r.upgrades[idx], extra, {
          regionId: r.id,
          requiredRegions: [...req],
        });
      }
    } else if (idx >= 0) {
      r.upgrades.splice(idx, 1);
    }
  }
  log.push(`KEEP ${name} → [${hosts.join(",")}] req=[${req.join(",") || "∅"}]`);
  return name;
}

function ensureRow(name, hosts, req, fields) {
  // wipe existing
  for (const r of cat.regions) {
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
  }
  for (const rid of hosts) {
    const r = cat.regions.find((x) => x.id === rid);
    r.upgrades.push({
      name,
      category: fields.category || "Construction",
      detail: fields.detail,
      requirements: fields.requirements || [],
      confidence: "user_ruling_2026-07-26",
      source: {
        source: "derived",
        url: fields.url || "https://runescape.wiki/w/Player-owned_house",
        title: name,
        verifiedAt: now,
      },
      regionId: rid,
      requiredRegions: [...req],
    });
  }
  log.push(`ENSURE ${name} → [${hosts.join(",")}] req=[${req.join(",")}]`);
}

const POH = ["fremennik", "tirannwn", "forinthry"];

// ── 1. Gilded altar + marble + magic stones ──────────────────────────────
keep(
  "POH gilded altar (Chapel offering)",
  POH,
  POH,
  {
    detail:
      "POH gilded altar (chapel offering). User ruling: hard geography for Construction materials — marble blocks, gilded altar craft, and magic stones are region-gated to Fremennik + Tirannwn + Forinthry (same triad). Not a free global altar once any house portal exists.",
  },
);

ensureRow(
  "Marble blocks (POH Construction)",
  POH,
  POH,
  {
    category: "Construction material",
    detail:
      "Marble blocks for high-end POH builds (incl. gilded altar path). User ruling: hard Fremennik + Tirannwn + Forinthry — not global.",
    url: "https://runescape.wiki/w/Marble_block",
  },
);

ensureRow(
  "Magic stones (POH Construction)",
  POH,
  POH,
  {
    category: "Construction material",
    detail:
      "Magic stones for high-end POH builds. User ruling: hard Fremennik + Tirannwn + Forinthry — not global (pair with marble blocks / gilded altar).",
    url: "https://runescape.wiki/w/Magic_stone",
  },
);

// ── 2. Slayer Introspection ──────────────────────────────────────────────
keep(
  "Slayer Introspection (Amascut's Enchanted Gem)",
  ["desert", "kandarin", "morytania"],
  ["desert", "kandarin", "morytania"],
  {
    detail:
      "Slayer Introspection (Amascut's Enchanted Gem). User: hard Desert + Kandarin + Morytania. Archaeology relic pieces may also come from ancient caskets in other regions (OR soft path) — caskets do not remove the three-region hard map for the normal collection route. At 3-elective cap.",
  },
);

// ── 3a. Juju = Karamja ───────────────────────────────────────────────────
keep(
  "Juju farming potion path (Herblore Habitat)",
  ["karamja"],
  ["karamja"],
  {
    detail:
      "Juju farming / Habitat juju path. User: hard Karamja. Perfect juju that needs Harmony moss is a separate Tirannwn combo (see Perfect juju / Meilyr moss).",
  },
);

keep(
  "Base juju potion family (Herblore Habitat)",
  ["karamja"],
  ["karamja"],
  {
    detail:
      "Base juju potion family (Herblore Habitat). User: hard Karamja.",
  },
);

// Perfect juju needs juju (Karamja) + harmony moss (Tirannwn) — keep dual
keep(
  "Perfect juju potion production path",
  ["karamja", "tirannwn"],
  ["karamja", "tirannwn"],
  {
    detail:
      "Perfect juju production. Hard: Karamja (juju / Habitat) + Tirannwn (Harmony moss / Meilyr). User: juju is Karamja; harmony moss is Tirannwn-hard.",
  },
);

// ── 3b. Harmony moss = Tirannwn ──────────────────────────────────────────
keep(
  "Meilyr harmony pillars (harmony moss)",
  ["tirannwn"],
  ["tirannwn"],
  {
    detail:
      "Harmony moss / Meilyr harmony pillars. User: hard Tirannwn. Required for perfect juju paths that consume moss.",
  },
);

// ── 3c. Inferno adze requires both Asgarnia + Forinthry ───────────────────
keep(
  "All Fired Up → Inferno adze reward chain",
  ["asgarnia", "forinthry"],
  ["asgarnia", "forinthry"],
  {
    detail:
      "Inferno adze reward chain (All Fired Up). User: requires BOTH Asgarnia and Forinthry — dual hard lock, not Asgarnia-only.",
  },
);

keep(
  "Inferno adze",
  ["asgarnia", "forinthry"],
  ["asgarnia", "forinthry"],
  {
    detail:
      "Inferno adze. User: hard Asgarnia + Forinthry (both). Pair with All Fired Up beacon chain.",
  },
);

// ── 3d. Alchemical onyx = global ─────────────────────────────────────────
keep(
  "Alchemical onyx (GOTE / LOTD craft residual)",
  ["misthalin"],
  [],
  {
    detail:
      "Alchemical onyx. User: global / not region-locked. Host Misthalin for planner listing only. GOTE/LOTD still have their own region maps.",
  },
);

// ── 3e. Extreme invention = Kandarin only ────────────────────────────────
keep(
  "Extreme invention supply combo (Guild + webbing + Herblore)",
  ["kandarin"],
  ["kandarin"],
  {
    detail:
      "Extreme invention supply (webbing / Herblore path). User: hard Kandarin only (Manor Farm zygomite webbing). Invention workbench is global — Asgarnia Guild is not a hard elective for this combo.",
  },
);

keep(
  "Extreme invention potion boost path",
  ["kandarin"],
  ["kandarin"],
  {
    detail:
      "Extreme invention potion boost path. User: hard Kandarin only (same webbing/supply geography as supply combo). Workbench global.",
  },
);

// ── 4. Autoheater = Wilderness ───────────────────────────────────────────
keep(
  "Smithing autoheater",
  ["forinthry"],
  ["forinthry"],
  {
    detail:
      "Smithing autoheater. User: hard Forinthry/Wilderness.",
  },
);

keep(
  "Advanced smithing autoheater",
  ["forinthry"],
  ["forinthry"],
  {
    detail:
      "Advanced smithing autoheater. User: hard Forinthry/Wilderness.",
  },
);

// Orthen + Superheat + autoheater: anach (core) + tir (superheat) + forin (autoheater)
keep(
  "Orthen furnace core + Superheat Form + smithing autoheater stack",
  ["anachronia", "tirannwn", "forinthry"],
  ["anachronia", "tirannwn", "forinthry"],
  {
    detail:
      "Orthen furnace core + Superheat Form + smithing autoheater stack. Hard: Anachronia (core) + Tirannwn (Superheat Form) + Forinthry (autoheater — user: Wildy). At 3-elective cap.",
  },
);

// full skilling stack should keep forinthry for autoheater if it includes it
keep(
  "Orthen furnace core full skilling stack",
  ["anachronia", "tirannwn", "forinthry"],
  ["anachronia", "tirannwn", "forinthry"],
  {
    detail:
      "Orthen furnace full skilling stack (core + Superheat + autoheater pressure). Hard Anachronia + Tirannwn + Forinthry (autoheater Wildy). At 3-elective cap.",
  },
);

dedupeRegionUpgrades(cat);
fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");
console.log(log.join("\n"));

const checks = [
  "POH gilded",
  "Marble blocks",
  "Magic stones",
  "Slayer Introspection",
  "Juju farming",
  "Base juju",
  "Perfect juju",
  "harmony",
  "Inferno adze",
  "All Fired Up →",
  "Alchemical onyx",
  "Extreme invention",
  "Smithing autoheater",
  "Advanced smithing",
  "Orthen furnace core + Superheat",
];
for (const k of checks) {
  const hits = [];
  for (const r of cat.regions)
    for (const u of r.upgrades)
      if (u.name.toLowerCase().includes(k.toLowerCase()))
        hits.push(
          `${r.id}: ${u.name.slice(0, 50)} req=${JSON.stringify(u.requiredRegions || [])}`,
        );
  console.log("\n" + k + "\n  " + (hits.join("\n  ") || "NONE"));
}
