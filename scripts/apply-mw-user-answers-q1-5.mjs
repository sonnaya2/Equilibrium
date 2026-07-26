/**
 * User answers to masterwork open questions:
 * 1. MW staff: synapse Forinthry-hard + Kandarin Ourania for craft → 5-region UO
 * 2. MW 2h: Forinthry (primed glorious bar) + Desert (drygore/demonic); Asgarnia NOT hard (any anvil for glorious)
 * 3. MW bow: Asgarnia not a bar req — keep mory+kand only
 * 4. Base SoA: Kandarin + Wilderness; MW trim: Mory + Asgarnia → full MW spear = 4-combo UO
 * 5. Plate row clarified in notes (Orthen stack) — leave until user decides
 */
import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];

function findTemplate(name) {
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u) return JSON.parse(JSON.stringify(u));
  }
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name.includes(name.slice(0, 28)));
    if (u) return { ...JSON.parse(JSON.stringify(u)), __resolvedName: u.name };
  }
  return null;
}

function keep(name, hosts, req, extra = {}) {
  let t = findTemplate(name);
  if (!t) {
    log.push(`MISS ${name}`);
    return;
  }
  if (t.__resolvedName) {
    name = t.__resolvedName;
    delete t.__resolvedName;
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
}

function removeAll(name) {
  let c = 0;
  for (const r of cat.regions) {
    const b = r.upgrades.length;
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
    c += b - r.upgrades.length;
  }
  if (c) log.push(`RM ${c}× ${name}`);
}

const UO =
  " · UNOBTAINABLE under Equilibrium 3-elective cap (region pressure exceeds picks).";

// ── 1. Masterwork staff ──────────────────────────────────────────────────
// Seismic/Asgarnia + Cywir/Desert + crystal/Tirannwn + Abyss synapse/Forinthry
// + Ourania craft step/Kandarin (user). 5 electives → UO
keep(
  "Masterwork staff",
  ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"],
  ["asgarnia", "desert", "tirannwn", "forinthry", "kandarin"],
  {
    detail:
      "Masterwork staff full self-source. Hard: Asgarnia (Seismic essence) + Desert (Cywir) + Tirannwn (crystal) + Forinthry (Abyssal runic synapse via Abyss RC) + Kandarin (Ourania altar craft step for synapse/staff focus path — user ruling). Free Misthalin covers dyed undead dragon leather only. 5 elective regions." +
      UO,
  },
);

// ── 2. Masterwork 2h — Forinthry + Desert only ───────────────────────────
keep(
  "Masterwork 2h sword",
  ["forinthry", "desert"],
  ["forinthry", "desert"],
  {
    detail:
      "Masterwork 2h sword. Hard: Forinthry/Wilderness (Primed glorious bar) + Desert (drygore / Twin Furies demonic essence). User: ordinary glorious bars forge at any anvil — Asgarnia is NOT a hard bar gate. Dual elective, obtainable.",
  },
);

// Soft: glorious bar general note if present
keep(
  "Masterwork melee plate / glorious-bar smithing chain",
  ["asgarnia"],
  [],
  {
    detail:
      "Glorious / masterwork bar folding. User: any anvil works — Asgarnia Artisans is practical listing only, not a hard region gate. Primed glorious bar for MW 2h is the Forinthry/Wilderness hard step (see Masterwork 2h sword).",
  },
);

// ── 3. Masterwork bow — reassert mory+kand, no asgarnia ──────────────────
keep(
  "Masterwork bow",
  ["morytania", "kandarin"],
  ["morytania", "kandarin"],
  {
    detail:
      "Masterwork bow. Hard: Morytania (noxious) + Kandarin (ascension). User: Asgarnia is not a glorious-bar hard req. Dual elective, obtainable.",
  },
);

// ── 4. Spear of Annihilation split ───────────────────────────────────────
// Base: Kandarin (Warforge) + Forinthry (chaotic spikes / Wildy pressure per user)
// MW product: base + trim (Mory malevolent + Asg praesulic) = 4 electives → UO

removeAll("Spear of Annihilation (base archaeology spear)");
{
  const hosts = ["kandarin", "forinthry"];
  const t = {
    name: "Spear of Annihilation (base archaeology spear)",
    category: "Melee weapon / Archaeology",
    detail:
      "Base T90 Spear of Annihilation (Archaeology restore). User ruling: Kandarin (Warforge dig / Bandos materials) + Forinthry/Wilderness. Does NOT include masterwork melee trim. Upgrade to Masterwork Spear is a separate 4-region UO row.",
    requirements: [
      "115 Archaeology for full restore path",
      "Warforge dig materials",
      "Chaotic spikes (Dungeoneering / Forinthry pressure)",
    ],
    confidence: "user_ruling_2026-07-26",
    source: {
      source: "derived",
      url: "https://runescape.wiki/w/Spear_of_Annihilation",
      title: "Spear of Annihilation",
      verifiedAt: "2026-07-26",
    },
    requiredRegions: ["kandarin", "forinthry"],
  };
  for (const rid of hosts) {
    const r = cat.regions.find((x) => x.id === rid);
    const c = JSON.parse(JSON.stringify(t));
    c.regionId = rid;
    r.upgrades.push(c);
  }
  log.push("ADD base SoA → kandarin+forinthry");
}

keep(
  "Masterwork Spear of Annihilation",
  ["kandarin", "forinthry", "morytania", "asgarnia"],
  ["kandarin", "forinthry", "morytania", "asgarnia"],
  {
    detail:
      "Full Masterwork Spear of Annihilation product. Combines: (1) base SoA = Kandarin + Forinthry/Wilderness (user) + (2) masterwork melee armour trim = Morytania (malevolent) + Asgarnia (praesulic / Artisans path). Wiki craft uses base spear + masterwork melee trim + glorious bars. 4 elective regions." +
      UO,
  },
);

// ── 5. Plate → Orthen — annotate clearly, leave req until user decides ───
{
  const name = "Masterwork plate → Orthen furnace core pressure stack";
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (!u) continue;
    u.detail =
      "SKILLING COMBO ROW (not combat armour BiS). This is about smithing pressure linking masterwork plate production into the Orthen furnace core material stack — NOT 'masterwork platebody' as worn gear, and NOT trimmed MW melee. Current hard req still mirrors prior Orthen ruling: Forinthry + Desert + Anachronia. Pending user call whether this combo row should stay, split, or drop. · Hosts⊆req forinthry/desert/anachronia.";
    u.requiredRegions = ["forinthry", "desert", "anachronia"];
    u.regionId = r.id;
  }
  // hosts only those three
  keep(name, ["forinthry", "desert", "anachronia"], ["forinthry", "desert", "anachronia"], {
    detail:
      "SKILLING COMBO ROW (not combat armour BiS). Links masterwork plate smithing pressure into Orthen furnace core materials — not worn masterwork platebody / not trimmed MW. Prior Orthen ruling: Forinthry + Desert + Anachronia. Awaiting user decision to keep, rename, or remove this row.",
  });
}

dedupeRegionUpgrades(cat);
fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");
console.log(log.join("\n"));

for (const n of [
  "Masterwork staff",
  "Masterwork 2h",
  "Masterwork bow",
  "Spear of Annihilation",
  "Masterwork Spear",
  "Masterwork plate → Orthen",
  "glorious-bar",
]) {
  const hits = [];
  for (const r of cat.regions)
    for (const u of r.upgrades)
      if (u.name.includes(n) || u.name.startsWith(n.slice(0, 20)))
        hits.push(
          `${r.id}: req=${JSON.stringify(u.requiredRegions || [])} uo=${/UNOBTAINABLE/i.test(u.detail || "")}`,
        );
  console.log("\n" + n + "\n  " + (hits.join("\n  ") || "NONE"));
}
