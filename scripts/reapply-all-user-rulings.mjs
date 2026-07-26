/**
 * Full re-apply of user multi-host / foreign-upgrade rulings (session + latest Q/A).
 * Catalog is mutated once; then dedupe fence.
 */
import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];

function removeAll(name) {
  let c = 0;
  for (const r of cat.regions) {
    const before = r.upgrades.length;
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
    c += before - r.upgrades.length;
  }
  if (c) log.push(`RM ${c}× ${name}`);
}

function removeAllIncludes(substr) {
  let c = 0;
  for (const r of cat.regions) {
    const before = r.upgrades.length;
    r.upgrades = r.upgrades.filter((u) => !u.name.includes(substr));
    c += before - r.upgrades.length;
  }
  if (c) log.push(`RM~ ${c}× *${substr}*`);
}

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
    // try partial
    for (const r of cat.regions) {
      const u = r.upgrades.find((x) => x.name.startsWith(name.slice(0, 28)));
      if (u) {
        t = JSON.parse(JSON.stringify(u));
        name = u.name;
        break;
      }
    }
  }
  if (!t) {
    log.push(`MISS ${name}`);
    return;
  }
  const allow = new Set(hosts);
  const reqList = req === undefined ? [...hosts] : [...req];
  for (const r of cat.regions) {
    const idx = r.upgrades.findIndex((x) => x.name === name);
    if (allow.has(r.id)) {
      if (idx < 0) {
        const c = JSON.parse(JSON.stringify(t));
        c.regionId = r.id;
        c.requiredRegions = reqList;
        Object.assign(c, extra);
        r.upgrades.push(c);
      } else {
        Object.assign(r.upgrades[idx], extra, {
          regionId: r.id,
          requiredRegions: reqList,
        });
      }
    } else if (idx >= 0) {
      r.upgrades.splice(idx, 1);
    }
  }
  // UNOBTAINABLE tag
  if (extra.uo) {
    for (const r of cat.regions) {
      const u = r.upgrades.find((x) => x.name === name);
      if (u && !(u.detail || "").includes("UNOBTAINABLE")) {
        u.detail =
          (u.detail || "") +
          " · UNOBTAINABLE under Equilibrium 3-elective cap (region pressure exceeds picks).";
      }
    }
  }
  log.push(
    `KEEP ${name} → [${hosts.join(",")}] req=[${reqList.join(",") || "∅"}]`,
  );
}

function note(name, text) {
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u && !(u.detail || "").includes(text.slice(0, 40))) {
      u.detail = (u.detail || "") + " · " + text;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REMOVE_ALL — skip / global / not relevant (prior A/C/D/E/F)
// ═══════════════════════════════════════════════════════════════════════════
const REMOVE = [
  "Hoardstalker ring",
  "Learn broad arrow / bolt fletching (300 Slayer points)",
  "Learn quicker killing blows (400 Slayer points)",
  "Games necklace teleport package",
  "Ring of duelling",
  "Cremation ability unlock",
  "Ore box tier upgrades",
  "Herb patch network (global herb-run map)",
  "GOTE + Dark Facet of Grace + ancient elven ritual shard sustain",
  "GOTE gather + porter sustain checklist",
  "Signs of the porter (Divination supply system)",
  "Fury shark outfit + Bait and Switch Fishing stack",
  "Grace of the elves / signs of the porter supply chain",
  "Slayer prefer / block / extend (Assignment Rewards)",
  "Prefer / block slot ladder (quest-point scaled)",
  "Spiny helmet, face mask, earmuffs, nose peg (shop pack)",
  "Player-owned house portal towns and Construction utilities",
  "Player-owned house Aquarium and Prawnbroker",
  "Aquarium room + Prawn Perks",
  "Nature's sentinel outfit",
  "Master camouflage outfit",
  "Magic golem outfit",
  "Gemstone golem outfit",
  "Infinity ethereal outfit",
  "Fletcher's outfit",
  "Master constructor's outfit",
  "Witchdoctor camo outfit",
  "Nimble outfit (The Pit Agility XP set)",
  "Silverhawk boots (Agility XP from feathers/down)",
  "Thaler skilling rewards hub (Stanley Limelight Traders)",
  "Portable skilling stations (ironman craft/deployment permanent note)",
  "Skills necklace (guild teleports)",
  "Curly roots Firemaking ceiling stack (Jadinko + All Fired Up gear)",
  "Scroll of cleansing + herb bag + botanist/factory Herblore stack",
  "Cooking dual-brewery network (Keldagrim + Phasmatys)",
  "Igneous cape progression",
  "Prifddinas spirit tree + Glouron three-tree unlock",
  "Mattock tier ladder (bronze through elder rune + specials)",
  "Full slayer helmet and point upgrades (reinforced through corrupted)",
  "Hatchet progression checklist (dragon → Imcando → crystal → Ember and Glade → Bloom and Blight)",
  "Mattock progression checklist (dragon → crystal / Imcando → MoTaS → Tony)",
  "Pickaxe progression checklist (dragon → Imcando → crystal → Earth and Song → Life and Death)",
];
for (const n of REMOVE) removeAll(n);

// ═══════════════════════════════════════════════════════════════════════════
// 1. Area Tasks — diary completable in its region; autoed if uncompletable
//    Each diary region hosts its own row with req = [self] only (NOT all 9 AND)
// ═══════════════════════════════════════════════════════════════════════════
{
  const name = "Area Tasks (achievement diaries) skilling overview";
  const t = findTemplate(name);
  const diaryRegions = [
    "misthalin",
    "karamja",
    "asgarnia",
    "kandarin",
    "fremennik",
    "forinthry",
    "desert",
    "morytania",
    "tirannwn",
  ];
  removeAll(name);
  if (t) {
    for (const rid of diaryRegions) {
      const r = cat.regions.find((x) => x.id === rid);
      const copy = JSON.parse(JSON.stringify(t));
      copy.regionId = rid;
      copy.requiredRegions = [rid];
      copy.detail =
        "Area Tasks / achievement diaries for this region. Assume the diary is completable once the region is unlocked; if a task is uncompletable it is auto-completed (user ruling). Not a cross-region AND of all diaries.";
      r.upgrades.push(copy);
    }
    log.push("Area Tasks → per-region available [self]");
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Fairy rings — probably autoed; mark available (Misthalin hub, not hard multi)
// ═══════════════════════════════════════════════════════════════════════════
keep("Fairy ring network (Zanaris hub)", ["misthalin"], [], {
  detail:
    "Fairy ring network treated as available (likely autoed / not a hard multi-region elective gate). Zanaris hub labels Misthalin. User: just mark available.",
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Staff of limitless — general obtainable item
// ═══════════════════════════════════════════════════════════════════════════
keep("Staff of limitless family (elemental impetus craft)", ["misthalin"], [], {
  detail:
    "Staff of limitless family treated as a general obtainable item (user ruling) — not a hard multi-region elective stack. Host Misthalin for planner listing only.",
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Decorated/exquisite urns — Morytania only; regular urns general
// ═══════════════════════════════════════════════════════════════════════════
// Split decorated/exquisite vs general urn infrastructure
{
  const name = "Decorated and exquisite urn craft infrastructure";
  // Capture template before remove (removeAll wipes the name)
  const t =
    findTemplate(name) ||
    findTemplate("Decorated and exquisite urn craft (Morytania)") || {
      name,
      category: "Crafting / Prayer urns",
      detail: "",
      requirements: [],
      confidence: "user_ruling_2026-07-26",
      source: {
        source: "derived",
        url: "https://runescape.wiki/w/Urn",
        title: "Urn",
        verifiedAt: "2026-07-26",
      },
    };
  removeAll(name);
  removeAll("Decorated and exquisite urn craft (Morytania)");
  // Morytania: decorated/exquisite
  {
    const r = cat.regions.find((x) => x.id === "morytania");
    const copy = JSON.parse(JSON.stringify(t));
    copy.name = "Decorated and exquisite urn craft (Morytania)";
    copy.regionId = "morytania";
    copy.requiredRegions = ["morytania"];
    copy.detail =
      "Decorated / exquisite urn crafting is Morytania-gated (user ruling). Regular urns work with general regions everyone has — do not multi-lock basic urns.";
    r.upgrades.push(copy);
  }
  // General urns note on misthalin (starting)
  {
    const r = cat.regions.find((x) => x.id === "misthalin");
    if (!r.upgrades.some((u) => /regular urns|General urn craft/i.test(u.name))) {
      r.upgrades.push({
        name: "General urn craft (non-decorated)",
        category: "Crafting",
        detail:
          "Regular urns are available with general/starting geography (user ruling). Decorated/exquisite urns are Morytania-only.",
        requirements: [],
        confidence: "user_ruling_2026-07-26",
        source: {
          source: "derived",
          url: "https://runescape.wiki/w/Urn",
          title: "Urn",
          verifiedAt: "2026-07-26",
        },
        regionId: "misthalin",
        requiredRegions: [],
      });
    }
  }
  log.push("Urns: exquisite→morytania; regular→general");
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Elite outfits — Beans Kandarin, Hunter Anachronia BGH, Gorajan hard Wildy
// ═══════════════════════════════════════════════════════════════════════════
keep(
  "Elite skilling outfits core set (ironman fragment paths)",
  ["kandarin", "anachronia", "forinthry"],
  ["kandarin", "anachronia", "forinthry"],
  {
    detail:
      "Elite outfit fragments: Farming beans path → Kandarin. Elite Hunter → Anachronia Big Game Hunter. Warped Gorajan trailblazer → hard Forinthry/Wilderness (user ruling). Other elite fragments are secondary.",
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// Prior tool / combat / GOTE rulings (re-assert)
// ═══════════════════════════════════════════════════════════════════════════
keep("Grace of the elves (GOTE)", ["forinthry", "tirannwn"], [
  "forinthry",
  "tirannwn",
]);
keep("Dark Facet of Grace (GOTE enchantment)", ["forinthry"], ["forinthry"]);
keep(
  "Pickaxe of Life and Death",
  ["fremennik", "tirannwn", "asgarnia"],
  ["fremennik", "tirannwn", "asgarnia"],
);
keep(
  "Pickaxe of Earth and Song",
  ["fremennik", "tirannwn", "kandarin"],
  ["fremennik", "tirannwn", "kandarin"],
);
keep(
  "Imcando tools family (pickaxe, hatchet, related craft pressure)",
  ["fremennik", "misthalin", "asgarnia"],
  ["fremennik", "misthalin", "asgarnia"],
);
keep(
  "Hatchet of Bloom and Blight",
  [
    "tirannwn",
    "misthalin",
    "asgarnia",
    "fremennik",
    "desert",
    "morytania",
  ],
  [
    "tirannwn",
    "misthalin",
    "asgarnia",
    "fremennik",
    "desert",
    "morytania",
  ],
  { uo: true },
);
keep(
  "Hatchet of Ember and Glade",
  ["forinthry", "tirannwn", "fremennik", "asgarnia"],
  ["forinthry", "tirannwn", "fremennik", "asgarnia"],
  { uo: true },
);
// User: MoTaS = Tirannwn (crystal) + Kandarin (Imcando) + Asgarnia; dragon mattock = ancient caskets any region
keep(
  "Mattock of Time and Space",
  ["tirannwn", "kandarin", "asgarnia"],
  ["tirannwn", "kandarin", "asgarnia"],
  {
    detail:
      "Mattock of Time and Space. Hard: Tirannwn (crystal) + Kandarin (Imcando) + Asgarnia. Dragon mattock from Ancient caskets (any region). Obtainable at 3-elective cap.",
  },
);
keep(
  "Artificer's measure",
  ["anachronia"],
  ["anachronia", "forinthry", "tirannwn", "morytania"],
  { uo: true },
);
keep(
  "Blessed flask (extreme prayer 80-dose permanent shell)",
  ["desert", "morytania", "tirannwn", "forinthry"],
  ["desert", "morytania", "tirannwn", "forinthry"],
  {
    uo: true,
    detail:
      "Blessed flask full craft pressure spans Desert + Morytania + Tirannwn + Forinthry (prior user ruling). UNOBTAINABLE under 3-elective cap.",
  },
);
removeAll("Elite sirenic armour (T92 ranged power)");
keep("Always Adze (Seed of the Charyou Tree)", ["kandarin"], ["kandarin"]);
keep(
  "Auto-burn Woodcutting paths (Superheat Form vs Always Adze vs partial outfit/adze)",
  ["kandarin"],
  ["kandarin"],
);
keep(
  "Bait and Switch + Always Adze dual monolith skilling paths",
  ["anachronia"],
  ["anachronia"],
);
keep("Seedicide collector upgrade", ["kandarin"], ["kandarin"]);
keep("Toolbelt attach: Seedicide", ["kandarin"], ["kandarin"]);
keep(
  "Crystal fishing rod + Prif waterfall + Fury shark stack",
  ["tirannwn"],
  ["tirannwn"],
);
keep("Volcanic trapper outfit", ["anachronia"], ["anachronia"]);
keep("Abyssal Link (The Subtle Blade)", ["kandarin"], ["kandarin"]);
keep("Grasping rune pouch", ["forinthry"], ["forinthry"]);
keep("Ring of slaying (craft unlock)", ["misthalin"], []);
keep(
  "Slayer Introspection (Amascut's Enchanted Gem)",
  ["kandarin", "morytania", "desert"],
  ["kandarin", "morytania", "desert"],
);
keep("Slayer helmet (craft unlock + base helm)", ["morytania"], ["morytania"]);
// OR geography: either Forinthry or Kandarin supplies Algarium thread — do not AND both.
keep(
  "Sirenic armour (T90 ranged power craft)",
  ["forinthry", "kandarin"],
  [],
  {
    detail:
      "Sirenic T90. Algarium thread = Forinthry OR Kandarin (user ruling) — either region alone supplies thread. Hosts both; no AND req of both electives.",
  },
);
keep(
  "Sirenic → elite sirenic armour",
  ["forinthry", "kandarin"],
  [],
  {
    detail:
      "Elite sirenic. Algarium thread = Forinthry OR Kandarin (user ruling) — either region alone supplies thread.",
  },
);
keep(
  "All Fired Up → Inferno adze reward chain",
  ["asgarnia", "forinthry"],
  ["asgarnia", "forinthry"],
);
keep("Death Ward relic chain", ["asgarnia", "kandarin"], [
  "asgarnia",
  "kandarin",
]);
keep(
  "Extreme invention supply combo (Guild + webbing + Herblore)",
  ["kandarin"],
  ["kandarin"],
  {
    detail:
      "Extreme invention: hard Kandarin only (Manor Farm webbing). Invention workbench global — Asgarnia not hard.",
  },
);
keep(
  "Extreme invention potion boost path",
  ["kandarin"],
  ["kandarin"],
  {
    detail: "Extreme invention boost path. User: hard Kandarin only.",
  },
);
keep(
  "Elder divination outfit path (Cache base + Invention elite)",
  ["asgarnia"],
  [],
  {
    detail:
      "Invention workbench is global (user). Cache optional. Host Asgarnia for listing only.",
  },
);
keep(
  "Masterwork ranged armour (Anachronia + Wildy + Kandarin)",
  ["anachronia", "forinthry", "kandarin"],
  ["anachronia", "forinthry", "kandarin"],
);
removeAll("Masterwork ranged armour material pressure (Havenhythe/Anachronia Hunter)");
removeAll("Apex hide → Masterwork Ranged craft path");

keep(
  "Orthen furnace core + Superheat Form + smithing autoheater stack",
  ["anachronia", "tirannwn", "forinthry"],
  ["anachronia", "tirannwn", "forinthry"],
);
keep(
  "Orthen furnace core full skilling stack",
  ["anachronia", "tirannwn", "forinthry"],
  ["anachronia", "tirannwn", "forinthry"],
);
keep("Smithing autoheater", ["forinthry"], ["forinthry"]);
keep("Advanced smithing autoheater", ["forinthry"], ["forinthry"]);
keep(
  "All Fired Up → Inferno adze reward chain",
  ["asgarnia", "forinthry"],
  ["asgarnia", "forinthry"],
);
keep("Inferno adze", ["asgarnia", "forinthry"], ["asgarnia", "forinthry"]);
keep(
  "Alchemical onyx (GOTE / LOTD craft residual)",
  ["misthalin"],
  [],
  { detail: "Alchemical onyx. User: global." },
);
// Masterwork plate = any anvil (global). Do not re-emit multi-region plate→Orthen combo.
removeAll("Masterwork plate → Orthen furnace core pressure stack");
keep(
  "Masterwork melee plate / glorious-bar smithing chain",
  ["asgarnia"],
  [],
  {
    detail:
      "Masterwork plate / glorious bar smithing. User: any anvil — global, not region-locked. Primed glorious bar (MW 2h) is Forinthry-hard separately.",
  },
);
keep("Perfect juju potion production path", ["karamja", "tirannwn"], [
  "karamja",
  "tirannwn",
]);
keep("Balarak's sash brush", ["forinthry", "anachronia"], [
  "forinthry",
  "anachronia",
]);
keep("Skeka's hypnowand", ["forinthry", "anachronia"], [
  "forinthry",
  "anachronia",
]);
keep("POH gilded altar (Chapel offering)", ["fremennik", "tirannwn", "forinthry"], [
  "fremennik",
  "tirannwn",
  "forinthry",
]);
keep("Marble blocks (POH Construction)", ["fremennik", "tirannwn", "forinthry"], [
  "fremennik",
  "tirannwn",
  "forinthry",
]);
keep("Magic stones (POH Construction)", ["fremennik", "tirannwn", "forinthry"], [
  "fremennik",
  "tirannwn",
  "forinthry",
]);
keep(
  "Slayer Introspection (Amascut's Enchanted Gem)",
  ["desert", "kandarin", "morytania"],
  ["desert", "kandarin", "morytania"],
);
keep("Meilyr harmony pillars (harmony moss)", ["tirannwn"], ["tirannwn"]);
keep("Juju farming potion path (Herblore Habitat)", ["karamja"], ["karamja"]);
keep("Edgeville skilling and Wilderness on-ramp hub", ["misthalin", "forinthry"], [
  "misthalin",
  "forinthry",
]);
// Wood box desert
keep("Wood box tier upgrades", ["desert"], ["desert"]);

// Construction contracts misthalin
keep("Construction Contracts (estate agents)", ["misthalin"], ["misthalin"]);

// Stormguard
{
  const dig = [
    "Ancient Invention blueprints (Howl's workshop)",
    "Inspire Genius (Howl's Thinking Cap)",
    "Divine Conversion (Cres Framework)",
  ];
  const asg = cat.regions.find((r) => r.id === "asgarnia");
  const kan = cat.regions.find((r) => r.id === "kandarin");
  for (const name of dig) {
    const i = asg.upgrades.findIndex((u) => u.name === name);
    if (i >= 0) {
      const u = asg.upgrades.splice(i, 1)[0];
      u.regionId = "kandarin";
      u.requiredRegions = ["kandarin"];
      const j = kan.upgrades.findIndex((x) => x.name === name);
      if (j >= 0) Object.assign(kan.upgrades[j], u);
      else kan.upgrades.push(u);
    }
  }
  log.push("Stormguard dig → kandarin");
}

// Invention workbench global — clear false asgarnia-only hard locks on invent devices
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    const req = u.requiredRegions || [];
    if (
      req.length === 1 &&
      req[0] === "asgarnia" &&
      /invention|gizmo|augment|siphon|hammer-tron|pyro-matic|rod-o-matic|junk refiner|mechanised/i.test(
        u.name,
      )
    ) {
      u.requiredRegions = [];
    }
  }
}

// Hexcrest / scarab if missing (D2)
{
  const mory = cat.regions.find((r) => r.id === "morytania");
  const des = cat.regions.find((r) => r.id === "desert");
  if (!mory.upgrades.some((u) => /Hexcrest/i.test(u.name))) {
    mory.upgrades.push({
      name: "Hexcrest (slayer helm component)",
      category: "Slayer helm components",
      detail:
        "Obtainable slayer-helm component piece. Full multi-region reinforced→corrupted ladder treated unobtainable — track pieces.",
      requirements: [],
      confidence: "user_ruling",
      source: {
        source: "derived",
        url: "https://runescape.wiki/w/Hexcrest",
        title: "Hexcrest",
        verifiedAt: "2026-07-26",
      },
      regionId: "morytania",
      requiredRegions: ["morytania"],
    });
  }
  if (!des.upgrades.some((u) => /[Ss]carab|necromancy-adjacent slayer/i.test(u.name))) {
    des.upgrades.push({
      name: "Scarab / necromancy-adjacent slayer helm pieces",
      category: "Slayer helm components",
      detail:
        "Desert-side slayer helm component pieces. Full multi-region helm ladder unobtainable — track pieces.",
      requirements: [],
      confidence: "user_ruling",
      source: {
        source: "derived",
        url: "https://runescape.wiki/w/Slayer_helmet",
        title: "Slayer helmet",
        verifiedAt: "2026-07-26",
      },
      regionId: "desert",
      requiredRegions: ["desert"],
    });
  }
}

dedupeRegionUpgrades(cat);
fs.writeFileSync(
  "data/research/catalog.json",
  JSON.stringify(cat, null, 2) + "\n",
);

// Report multi remaining
const map = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!u.name || /^Herb patches/.test(u.name)) continue;
    // Area Tasks per-region copies share name but each has req=[self] — count multi by name still
    if (!map.has(u.name))
      map.set(u.name, { name: u.name, hosts: [], reqs: [] });
    const e = map.get(u.name);
    if (!e.hosts.includes(r.id)) e.hosts.push(r.id);
    e.reqs.push(u.requiredRegions || []);
  }
}
const multi = [...map.values()].filter((e) => e.hosts.length > 1);
console.log(log.join("\n"));
console.log(
  JSON.stringify(
    {
      total: cat.regions.reduce((a, r) => a + r.upgrades.length, 0),
      multiHostNames: multi.length,
      multi: multi.map((e) => ({
        name: e.name,
        hosts: e.hosts,
        sampleReq: e.reqs[0],
      })),
    },
    null,
    2,
  ),
);
