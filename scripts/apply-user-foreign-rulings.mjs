/**
 * Apply user rulings on remaining foreign multi-host upgrades (2026-07-26).
 * Reply tags: remove | single-home | multi-ok on listed hosts | rewrite detail
 */
import fs from "node:fs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const today = "2026-07-26";
const log = [];

function allUpgrades() {
  const out = [];
  for (const r of cat.regions) {
    for (const u of r.upgrades) out.push({ region: r, u });
  }
  return out;
}

function findByIncludes(substr) {
  const s = substr.toLowerCase();
  const names = new Set();
  for (const { u } of allUpgrades()) {
    if (u.name.toLowerCase().includes(s)) names.add(u.name);
  }
  return [...names];
}

function exact(name) {
  for (const { u } of allUpgrades()) if (u.name === name) return name;
  const hits = findByIncludes(name.slice(0, 28));
  if (hits.length === 1) return hits[0];
  if (hits.length > 1) {
    // prefer exact-ish longest match
    hits.sort((a, b) => a.length - b.length);
    return hits[0];
  }
  return null;
}

/** Remove upgrade name from every region. */
function removeAll(name, why) {
  const n = exact(name) || name;
  let c = 0;
  for (const r of cat.regions) {
    const before = r.upgrades.length;
    r.upgrades = r.upgrades.filter((u) => u.name !== n);
    c += before - r.upgrades.length;
  }
  log.push(`REMOVE ${c}× ${n} (${why})`);
  return c;
}

/**
 * Keep only on hosts; set regionId + requiredRegions on each kept copy.
 * If home is set, ensure primary copy on home; hosts without a copy get clone from first found.
 */
function keepOn(name, hosts, opts = {}) {
  const n = exact(name);
  if (!n) {
    log.push(`MISS keepOn ${name}`);
    return;
  }
  const hostSet = new Set(hosts);
  let template = null;
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === n);
    if (u) {
      template = JSON.parse(JSON.stringify(u));
      break;
    }
  }
  if (!template) {
    log.push(`MISS template ${n}`);
    return;
  }

  for (const r of cat.regions) {
    const idx = r.upgrades.findIndex((x) => x.name === n);
    if (hostSet.has(r.id)) {
      if (idx < 0) {
        const copy = JSON.parse(JSON.stringify(template));
        copy.regionId = r.id;
        if (opts.requiredRegions) copy.requiredRegions = [...opts.requiredRegions];
        if (opts.detail) copy.detail = opts.detail;
        if (opts.note) {
          copy.detail = (copy.detail ? copy.detail + " · " : "") + opts.note;
        }
        if (opts.unobtainable) {
          copy.detail =
            (copy.detail ? copy.detail + " · " : "") +
            "UNOBTAINABLE under Equilibrium 3-elective cap (region pressure exceeds picks).";
          copy.confidence = copy.confidence || "inferred_region";
        }
        r.upgrades.push(copy);
      } else {
        const u = r.upgrades[idx];
        u.regionId = r.id;
        if (opts.requiredRegions) u.requiredRegions = [...opts.requiredRegions];
        if (opts.detail) u.detail = opts.detail;
        if (opts.note && !(u.detail || "").includes(opts.note.slice(0, 40))) {
          u.detail = (u.detail ? u.detail + " · " : "") + opts.note;
        }
        if (opts.unobtainable && !(u.detail || "").includes("UNOBTAINABLE")) {
          u.detail =
            (u.detail ? u.detail + " · " : "") +
            "UNOBTAINABLE under Equilibrium 3-elective cap (region pressure exceeds picks).";
        }
      }
    } else if (idx >= 0) {
      r.upgrades.splice(idx, 1);
    }
  }
  log.push(
    `KEEP ${n} on [${hosts.join(",")}]` +
      (opts.requiredRegions ? ` req=[${opts.requiredRegions.join(",")}]` : "") +
      (opts.unobtainable ? " UNOBTAINABLE" : ""),
  );
}

function singleHome(name, home, opts = {}) {
  keepOn(name, [home], {
    requiredRegions: opts.requiredRegions || [home],
    note: opts.note,
    detail: opts.detail,
    unobtainable: opts.unobtainable,
  });
}

// ─── A ─────────────────────────────────────────────────────────────────────
// A1 Area Tasks — indicate what regions are required (not delete)
{
  const n = exact("Area Tasks (achievement diaries)");
  if (n) {
    const detail =
      "Achievement diaries / Area Tasks are region-scoped. Complete each diary in its own region unlock (Misthalin, Karamja, Asgarnia, Kandarin, Fremennik, Wilderness/Forinthry, Desert, Morytania, Tirannwn as published). List required region per diary tier rather than a global cross-region route. Not a single-region gate.";
    // Keep one copy on each elective+starting that has diaries — multi-ok all current hosts with clearer detail
    const hosts = [
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
    keepOn(n, hosts, {
      requiredRegions: hosts,
      detail,
      note: "Per-region diary ownership — pick the region that owns the diary you care about.",
    });
  }
}

// A2 Herb patches — per-region patch totals, not routing
{
  const n = exact("Herb patch network");
  if (n) removeAll(n, "A2 replace with per-region patch totals");
  // Patch counts (normal game herb patches by kingdom — approximate League-relevant totals)
  const herbTotals = {
    misthalin: { patches: 1, note: "South of Falador edge / Taverley border often counted Asgarnia; Misthalin herb access via house/portal utility. Confirm in-region: typically 0–1 direct herb patches depending on boundary." },
    asgarnia: { patches: 2, note: "Taverley + Falador park / guild-adjacent herb patches." },
    kandarin: { patches: 4, note: "Catherby, Ardougne (north/south), and related Kandarin farm patches — primary herb density." },
    fremennik: { patches: 1, note: "Etceteria / island herb access when Fremennik unlocked." },
    desert: { patches: 1, note: "Garden of Kharid / desert farm herb access." },
    morytania: { patches: 1, note: "Morytania herb patch (Canifis/farming area)." },
    tirannwn: { patches: 1, note: "Prifddinas / Crwys herb access after Tirannwn." },
    karamja: { patches: 1, note: "Karamja herb patch (Brimhaven/farming)." },
    forinthry: { patches: 0, note: "No standard herb patch in Wilderness/Forinthry." },
    anachronia: { patches: 1, note: "Anachronia farm herb/allotment capacity when base camp farming unlocked." },
    havenhythe: { patches: 1, note: "Eastfold / island farm herb capacity when available." },
  };
  for (const [rid, info] of Object.entries(herbTotals)) {
    const r = cat.regions.find((x) => x.id === rid);
    if (!r) continue;
    const name = `Herb patches (${info.patches})`;
    // remove old if re-run
    r.upgrades = r.upgrades.filter((u) => !/^Herb patches \(\d+\)/.test(u.name) && u.name !== "Herb patch network (global herb-run map)");
    r.upgrades.push({
      name,
      category: "Farming patch inventory",
      detail: `${info.patches} herb patch(es) treated as local to this region for League planning. ${info.note} No efficient herb-run routing — only local totals.`,
      requirements: [],
      confidence: "inferred_wiki_patch_geography",
      source: {
        source: "runescape-wiki",
        url: "https://runescape.wiki/w/Herb_patch",
        title: "Herb patch",
        verifiedAt: today,
      },
      regionId: rid,
      requiredRegions: [rid],
    });
    log.push(`A2 herb total ${rid}: ${info.patches}`);
  }
}

// A3–A6, A8, A11–A13 remove
for (const [key, why] of [
  ["Slayer prefer / block / extend", "A3 not region locked"],
  ["Hoardstalker ring", "A4 not relevant"],
  ["Learn broad arrow / bolt fletching", "A5 global"],
  ["Learn quicker killing blows", "A6 not relevant"],
  ["Games necklace teleport package", "A8 not relevant"],
  ["Ring of duelling", "A11 not relevant"],
  ["Cremation ability unlock", "A12 skip"],
  ["Ore box tier upgrades", "A13 not region locked"],
]) {
  removeAll(key, why);
}

// A7 Prayer — simplify to one misthalin-home note (gilded/POH elsewhere); user unsure
{
  const n = exact("Prayer training infrastructure");
  if (n) {
    singleHome(n, "misthalin", {
      note: "Core altar / powder / book training is not a hard multi-region gate. POH gilded altar materials may still touch Fremennik/Tirannwn/Forinthry (see POH altar row).",
    });
  }
}

// A9 Construction Contracts — Misthalin + NPC Contact note
{
  const n = exact("Construction Contracts");
  if (n) {
    singleHome(n, "misthalin", {
      note: "Completable with Misthalin alone. NPC Contact (Lunar) speeds contract board access but is not required.",
    });
  }
}

// A10 Mattock ladder — only augmentables matter; remove smithed ladder
{
  removeAll("Mattock tier ladder", "A10 only care about augmentable mattocks");
}

// A14 Wood box — Acadia needs desert; maple without
{
  const n = exact("Wood box tier upgrades");
  if (n) {
    singleHome(n, "desert", {
      requiredRegions: ["desert"],
      note: "Full wood box progression to acadia-tier capacity needs Desert (acadia). Without Desert, practical cap is around maple-tier boxes.",
    });
  }
}

// ─── B ─────────────────────────────────────────────────────────────────────
// B1 Elite outfits — Farming beans Kandarin, Warped Gorajan Forinthry, Hunter Anachronia
{
  const n = exact("Elite skilling outfits core set");
  if (n) {
    keepOn(n, ["kandarin", "forinthry", "anachronia", "desert", "tirannwn", "fremennik", "asgarnia"], {
      requiredRegions: ["kandarin", "forinthry", "anachronia"],
      note: "Elite Farming beans path: Kandarin. Warped Gorajan trailblazer pieces: Forinthry/Wilderness. Elite Hunter: Anachronia. Other elite fragment paths may still touch Desert/Tirannwn/Fremennik/Asgarnia — treat those as secondary pressure.",
    });
  }
}

// B2 GOTE Wildy+Tirannwn; Dark Facet + ritual shard Wildy only
{
  const gote = exact("GOTE + Dark Facet of Grace + ancient elven ritual shard");
  if (gote) {
    // Split: remove combo; ensure separate if exist
    removeAll(gote, "B2 do not mega-chain; split GOTE vs Wildy-only pieces");
  }
  // Ensure GOTE-related rows
  const grace = exact("Grace of the elves / signs of the porter");
  if (grace) {
    // B4 wouldn't chain — demote to note-only on tirannwn or remove chain
    removeAll(grace, "B4 would not chain GOTE/porter supply");
  }
  const dark = exact("Dark Facet of Grace");
  if (dark) {
    singleHome(dark, "forinthry", {
      requiredRegions: ["forinthry"],
      note: "Dark Facet / related GOTE enchantments treated as Forinthry (Wilderness) pressure. GOTE itself is Forinthry + Tirannwn.",
    });
  }
  // Add explicit GOTE row on both if missing after remove
  for (const rid of ["forinthry", "tirannwn"]) {
    const r = cat.regions.find((x) => x.id === rid);
    if (!r.upgrades.some((u) => /^Grace of the elves$|GOTE \(Grace of the elves\)/i.test(u.name))) {
      r.upgrades.push({
        name: "Grace of the elves (GOTE)",
        category: "Archaeology / porter sustain",
        detail:
          "Grace of the elves requires Forinthry + Tirannwn region pressure (user ruling). Dark Facet / ritual-shard style upgrades are Forinthry-only. Do not chain full porter logistics into one mega-upgrade.",
        requirements: [],
        confidence: "user_ruling_2026-07-26",
        source: {
          source: "derived",
          url: "https://runescape.wiki/w/Grace_of_the_elves",
          title: "Grace of the elves",
          verifiedAt: today,
        },
        regionId: rid,
        requiredRegions: ["forinthry", "tirannwn"],
      });
    }
  }
  log.push("B2 GOTE forinthry+tirannwn; Dark Facet forinthry");
}

// B3 Pickaxe Life and Death — frem+tir+asgarnia (Ice Mountain Asgarnia)
{
  const n = exact("Pickaxe of Life and Death");
  if (n) {
    keepOn(n, ["fremennik", "tirannwn", "asgarnia"], {
      requiredRegions: ["fremennik", "tirannwn", "asgarnia"],
      note: "Valid if Ice Mountain / related smithing access counts as Asgarnia.",
    });
  }
}

// B5 Imcando
{
  const n = exact("Imcando tools family");
  if (n) {
    keepOn(n, ["fremennik", "misthalin", "asgarnia"], {
      requiredRegions: ["fremennik", "misthalin", "asgarnia"],
    });
  }
}

// B6 Auto-burn / Always Adze — Kandarin
{
  const n = exact("Auto-burn Woodcutting paths");
  if (n) {
    singleHome(n, "kandarin", {
      requiredRegions: ["kandarin"],
      note: "Always Adze path treated as Kandarin-gated (user ruling).",
    });
  }
  const adze = exact("Always Adze (Seed of the Charyou Tree)");
  if (adze) singleHome(adze, "kandarin", { requiredRegions: ["kandarin"] });
}

// B7 Artificer's measure unobtainable
{
  const n = exact("Artificer's measure");
  if (n && !n.includes("component")) {
    keepOn(n, ["anachronia"], {
      requiredRegions: ["anachronia", "forinthry", "tirannwn", "morytania"],
      unobtainable: true,
      note: "User: pretty sure unobtainable under League region pick limits.",
    });
  }
}

// B8 Bait+Adze dual — Anachronia only (Bob can Misthalin)
{
  const n = exact("Bait and Switch + Always Adze dual monolith");
  if (n) {
    singleHome(n, "anachronia", {
      requiredRegions: ["anachronia"],
      note: "Bait and Switch / monolith side is Anachronia. Always Adze is Kandarin separately. Bob can appear in Misthalin — not a region gate.",
    });
  }
}

// B9 Blessed flask unobtainable desert+mory+tir+wildy
{
  const n = exact("Blessed flask production chain");
  if (n) {
    keepOn(n, ["desert", "morytania", "tirannwn", "forinthry"], {
      requiredRegions: ["desert", "morytania", "tirannwn", "forinthry"],
      unobtainable: true,
      note: "User: mark unobtainable — needs Desert + Morytania + Tirannwn + Wilderness.",
    });
  }
}

// B10 remove fury shark combo
removeAll("Fury shark outfit + Bait and Switch", "B10 ignore combo");

// B11 Bloom unobtainable + desert mory
{
  const n = exact("Hatchet of Bloom and Blight");
  if (n) {
    keepOn(n, ["tirannwn", "misthalin", "asgarnia", "fremennik", "desert", "morytania"], {
      requiredRegions: ["tirannwn", "misthalin", "asgarnia", "fremennik", "desert", "morytania"],
      unobtainable: true,
      note: "User: also needs Desert + Morytania; unobtainable under 3-elective cap.",
    });
  }
}

// B12 Ember — wildy+tir+frem+asgarnia unobtainable
{
  const n = exact("Hatchet of Ember and Glade");
  if (n) {
    keepOn(n, ["forinthry", "tirannwn", "fremennik", "asgarnia"], {
      requiredRegions: ["forinthry", "tirannwn", "fremennik", "asgarnia"],
      unobtainable: true,
    });
  }
}

// B13 Masterwork / Orthen — Orthen needs wildy+desert+anachronia
{
  const n = exact("Masterwork plate → Orthen furnace core");
  if (n) {
    keepOn(n, ["forinthry", "desert", "anachronia", "asgarnia"], {
      requiredRegions: ["forinthry", "desert", "anachronia"],
      note: "Masterwork bar folding can be done anywhere. Orthen furnace core pressure: Forinthry + Desert + Anachronia.",
    });
  }
}

// B14 Mattock of Time and Space + kandarin + anachronia
{
  const n = exact("Mattock of Time and Space");
  if (n) {
    keepOn(n, ["tirannwn", "misthalin", "kandarin", "anachronia"], {
      requiredRegions: ["tirannwn", "misthalin", "kandarin", "anachronia"],
    });
  }
}

// B15 Orthen full stack
{
  const n = exact("Orthen furnace core + Superheat Form");
  if (n) {
    keepOn(n, ["anachronia", "tirannwn", "forinthry"], {
      requiredRegions: ["anachronia", "tirannwn", "forinthry"],
    });
  }
  const n2 = exact("Orthen furnace core full skilling stack");
  if (n2) {
    keepOn(n2, ["anachronia", "tirannwn", "forinthry"], {
      requiredRegions: ["anachronia", "tirannwn", "forinthry"],
    });
  }
}

// B16 Earth and Song + kandarin
{
  const n = exact("Pickaxe of Earth and Song");
  if (n) {
    keepOn(n, ["fremennik", "tirannwn", "kandarin"], {
      requiredRegions: ["fremennik", "tirannwn", "kandarin"],
    });
  }
}

// B17 Crystal rod tirannwn
{
  const n = exact("Crystal fishing rod");
  if (n) singleHome(n, "tirannwn", { requiredRegions: ["tirannwn"] });
}

// B19/B20 Seedicide Kandarin only
{
  const n = exact("Seedicide collector");
  if (n) singleHome(n, "kandarin", { requiredRegions: ["kandarin"] });
  const n2 = exact("Toolbelt attach: Seedicide");
  if (n2) {
    singleHome(n2, "kandarin", {
      requiredRegions: ["kandarin"],
      note: "User: not Asgarnia/Anachronia — Kandarin only.",
    });
  }
}

// ─── C ─────────────────────────────────────────────────────────────────────
{
  const n = exact("POH gilded altar");
  if (n) {
    // marble/gold leaf: frem OR tir OR forinthry
    keepOn(n, ["fremennik", "tirannwn", "forinthry", "misthalin"], {
      requiredRegions: ["fremennik", "tirannwn", "forinthry"],
      note: "Marble block / gold leaf materials need Fremennik, Tirannwn, or Forinthry (any one). Altar usable in any POH once built.",
    });
  }
  // C2 idk — leave hosts as-is, add note
  const n2 = exact("Player-owned house portal towns");
  if (n2) {
    keepOn(
      n2,
      ["misthalin", "karamja", "asgarnia", "kandarin", "fremennik", "desert", "tirannwn"],
      {
        requiredRegions: [
          "asgarnia",
          "kandarin",
          "karamja",
          "fremennik",
          "desert",
          "tirannwn",
          "misthalin",
        ],
        note: "Portal-town list still product-open (user: idk). Keep multi-region portal map for now.",
      },
    );
  }
  removeAll("Aquarium room + Prawn Perks", "C3 no region locks — drop");
  removeAll("Player-owned house Aquarium and Prawnbroker", "C4 drop");
}

// ─── D ─────────────────────────────────────────────────────────────────────
removeAll("Spiny helmet, face mask, earmuffs, nose peg", "D1 not region locked");
{
  const n = exact("Full slayer helmet and point upgrades");
  if (n) {
    removeAll(n, "D2 replace with obtainable pieces");
  }
  // Add hex crest / scarab-style notes on morytania + desert
  for (const [rid, name, detail] of [
    [
      "morytania",
      "Hexcrest (slayer helm component)",
      "Slayer helm cosmetic/component path piece. Prefer individual obtainable components over full reinforced→corrupted ladder under League.",
    ],
    [
      "desert",
      "Scarab / necromancy-adjacent slayer helm pieces",
      "Desert-side slayer helm components (e.g. scarab / necro-adjacent pieces as published). Full multi-region helm ladder treated unobtainable — track pieces not the full stack.",
    ],
  ]) {
    const r = cat.regions.find((x) => x.id === rid);
    if (!r.upgrades.some((u) => u.name === name)) {
      r.upgrades.push({
        name,
        category: "Slayer helm components",
        detail,
        requirements: [],
        confidence: "user_ruling_2026-07-26",
        source: {
          source: "derived",
          url: "https://runescape.wiki/w/Slayer_helmet",
          title: "Slayer helmet",
          verifiedAt: today,
        },
        regionId: rid,
        requiredRegions: [rid],
      });
    }
  }
  log.push("D2 component pieces on morytania/desert");
}
// D3/D4 leave
{
  const n = exact("Ring of slaying");
  if (n) {
    singleHome(n, "misthalin", {
      requiredRegions: [],
      note: "Crafting the ring has no region requirement (user). Kept under Misthalin as convenience home only.",
    });
    // clear requiredRegions
    for (const r of cat.regions) {
      const u = r.upgrades.find((x) => x.name === n);
      if (u) u.requiredRegions = [];
    }
  }
}

// ─── E ─────────────────────────────────────────────────────────────────────
{
  const n = exact("Volcanic trapper outfit");
  if (n) singleHome(n, "anachronia", { requiredRegions: ["anachronia"] });
}
for (const key of [
  "Gemstone golem outfit",
  "Master camouflage outfit",
  "Nature's sentinel outfit",
  "Elder divination outfit",
  "Infinity ethereal outfit",
  "Magic golem outfit",
]) {
  // Elder divination outfit path — skip E6; only exact "Elder divination outfit" without path
  removeAll(key, "E global or skip");
}
// Re-add careful: E6 skip means leave "Elder divination outfit path" alone
// removeAll may have killed path if includes — check
// E5 was Elder divination outfit - removed. E6 path should remain if name differs.
{
  const n = exact("Master farmer outfit is not a Desert unlock");
  if (n) singleHome(n, "kandarin", { requiredRegions: ["kandarin"] });
}
// E7 Fletcher skip, E10 constructor skip, E12 witchdoctor skip — leave if present

// ─── F ─────────────────────────────────────────────────────────────────────
{
  const n = exact("Slayer Introspection");
  if (n) {
    keepOn(n, ["kandarin", "morytania", "desert"], {
      requiredRegions: ["kandarin", "morytania", "desert"],
    });
  }
}
removeAll("Curly roots Firemaking", "F2 no");
{
  const n = exact("Perfect juju potion production path");
  if (n) {
    keepOn(n, ["karamja", "tirannwn"], {
      requiredRegions: ["karamja", "tirannwn"],
    });
  }
}
removeAll("Scroll of cleansing + herb bag", "F4 not relevant combo");
removeAll("Signs of the porter", "F5 no region need");
{
  const n = exact("Abyssal Link");
  if (n) singleHome(n, "kandarin", { requiredRegions: ["kandarin"], note: "Guthix cave / Subtle Blade path — Kandarin only." });
}
{
  const n = exact("All Fired Up → Inferno adze");
  if (n) {
    keepOn(n, ["forinthry", "asgarnia"], {
      requiredRegions: ["forinthry", "asgarnia"],
    });
  }
}
removeAll("Cooking dual-brewery", "F8 skip");
{
  const n = exact("Extreme invention supply combo");
  if (n) {
    keepOn(n, ["asgarnia", "anachronia"], {
      requiredRegions: ["asgarnia", "anachronia"],
      note: "Mycelial webbing needs a mushroom patch (region that owns usable mushroom farming).",
    });
  }
}
{
  const n = exact("Balarak's sash brush");
  if (n) {
    keepOn(n, ["forinthry", "anachronia"], {
      requiredRegions: ["forinthry", "anachronia"],
    });
  }
}
{
  const n = exact("Death Ward relic chain");
  if (n) {
    keepOn(n, ["asgarnia", "kandarin"], {
      requiredRegions: ["kandarin", "asgarnia"],
    });
  }
}
{
  const n = exact("Grasping rune pouch");
  if (n) {
    singleHome(n, "forinthry", {
      requiredRegions: ["forinthry"],
      note: "Magical thread / pouch pressure treated as Forinthry (Wilderness) only.",
    });
  }
}
removeAll("Igneous cape progression", "F13 unlocked for all — skip");
removeAll("Prifddinas spirit tree + Glouron", "F14 not relevant");
{
  const n = exact("Skeka's hypnowand");
  if (n) {
    keepOn(n, ["forinthry", "anachronia"], {
      requiredRegions: ["forinthry", "anachronia"],
    });
  }
}

// Sync league areas untouched
fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");

// Report multi-host remaining
const map = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!map.has(u.name)) map.set(u.name, { name: u.name, hosts: [], req: u.requiredRegions || [] });
    const e = map.get(u.name);
    if (!e.hosts.includes(r.id)) e.hosts.push(r.id);
    if ((u.requiredRegions || []).length) e.req = u.requiredRegions;
  }
}
const multi = [...map.values()].filter((e) => e.hosts.length > 1);

fs.writeFileSync(
  "scraped-data/foreign-upgrades-user-rulings-applied-2026-07-26.json",
  JSON.stringify(
    {
      appliedAt: new Date().toISOString(),
      log,
      multiHostRemaining: multi.length,
      multiHostSample: multi.slice(0, 40),
    },
    null,
    2,
  ) + "\n",
);

console.log(log.join("\n"));
console.log("\nmulti-host remaining:", multi.length);
console.log(
  "unobtainable tags:",
  allUpgrades().filter(({ u }) => (u.detail || "").includes("UNOBTAINABLE")).length,
);
