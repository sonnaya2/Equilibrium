import fs from "node:fs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const remaining = JSON.parse(
  fs.readFileSync("scraped-data/foreign-upgrades-remaining-2026-07-26.json", "utf8"),
);

/** Extra name → home when requiredRegions empty but wiki home is locked. */
const EXTRA_CLEAR = {
  "Kuradal's Dungeon and ferocious ring hub": "kandarin",
  "Thieves' Guild master thief tools": "misthalin",
  "Invention Guild named machine room": "asgarnia",
  "Dragon hatchet (Dagannoth Kings pressure)": "fremennik",
};

/** Dubious name-only classifications — leave for advice, do not auto-home. */
const SKIP_AUTO = new Set([
  "Edgeville skilling and Wilderness on-ramp hub",
]);

const toApply = [];
for (const e of remaining.buckets["clear-single"] || []) {
  if (SKIP_AUTO.has(e.name)) continue;
  if (e.requiredRegions && e.requiredRegions.length === 1) {
    toApply.push({ name: e.name, home: e.requiredRegions[0] });
  } else if (EXTRA_CLEAR[e.name]) {
    toApply.push({ name: e.name, home: EXTRA_CLEAR[e.name] });
  }
}

const byName = new Map(toApply.map((x) => [x.name, x.home]));
let removed = 0;
let ensured = 0;

for (const r of cat.regions) {
  const keep = [];
  for (const u of r.upgrades) {
    const home = byName.get(u.name);
    if (!home) {
      keep.push(u);
      continue;
    }
    if (r.id === home) {
      u.regionId = home;
      if (!u.requiredRegions || u.requiredRegions.length === 0) {
        u.requiredRegions = [home];
      }
      keep.push(u);
      ensured++;
    } else {
      removed++;
    }
  }
  r.upgrades = keep;
}

const missing = [];
for (const { name, home } of toApply) {
  const r = cat.regions.find((x) => x.id === home);
  if (!r.upgrades.some((u) => u.name === name)) missing.push({ home, name });
}

fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");

// Rebuild multi-host list for user advice
const map = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!map.has(u.name)) {
      map.set(u.name, { name: u.name, hosts: [], req: u.requiredRegions || [] });
    }
    const e = map.get(u.name);
    if (!e.hosts.includes(r.id)) e.hosts.push(r.id);
    if ((u.requiredRegions || []).length) e.req = u.requiredRegions;
  }
}
const multi = [...map.values()]
  .filter((e) => e.hosts.length > 1)
  .sort((a, b) => b.hosts.length - a.hosts.length || a.name.localeCompare(b.name));

function bucket(e) {
  const n = e.name;
  const req = e.req || [];
  if (/Area Tasks|herb patch|Slayer prefer|Learn broad|Learn quicker|Hoardstalker|Prayer training|Construction Contracts|Cremation|Games necklace|Ring of duelling|Mattock tier|Wood box|Ore box/i.test(n)) {
    return "global-or-network";
  }
  if (/Pickaxe of|Hatchet of|Mattock of|crystal tools|Imcando|Earth and Song|Life and Death|Ember|Bloom|Orthen furnace|Superheat|Always Adze|Bait and Switch|Masterwork plate|GOTE|Grace of the elves|Dark Facet|Blessed flask|elite skilling|Artificer|Seedicide|Fury shark|Auto-burn/i.test(n)) {
    return "tool-chain-multi-region";
  }
  if (/POH|portal town|Player-owned house|Aquarium|Prawn/i.test(n)) {
    return "poh-construction";
  }
  if (/outfit|camouflage|sentinel|ethereal|trapper|witchdoctor|golem|divination outfit|constructor/i.test(n)) {
    return "outfit-multi-source";
  }
  if (/slayer helmet|Spiny helmet|face mask|Ring of slaying|Full slayer/i.test(n)) {
    return "slayer-components";
  }
  if (req.length > 1) return "explicit-multi-req";
  return "empty-req-or-other";
}

const adviceBuckets = {};
for (const e of multi) {
  const b = bucket(e);
  if (!adviceBuckets[b]) adviceBuckets[b] = [];
  adviceBuckets[b].push({
    name: e.name,
    hosts: e.hosts,
    requiredRegions: e.req,
    ask:
      e.req.length > 1
        ? `requiredRegions=${e.req.join("+")}. multi-ok on all hosts, or primary-only (which)?`
        : "no requiredRegions. single home (which region), multi-ok, or global (remove from region lists)?",
  });
}

const out = {
  generatedAt: new Date().toISOString(),
  appliedClearSingle: {
    count: toApply.length,
    removedForeignCopies: removed,
    ensuredOnHome: ensured,
    missingOnHome: missing,
    names: toApply,
  },
  needYourAdvice: {
    count: multi.length,
    howToReply:
      "For each name (or whole bucket): primary:<regionId> | multi-ok | global | primary:<regionId> keep-req",
    buckets: adviceBuckets,
  },
};

fs.writeFileSync(
  "scraped-data/foreign-upgrades-need-advice-2026-07-26.json",
  JSON.stringify(out, null, 2) + "\n",
);

console.log(
  JSON.stringify(
    {
      applied: toApply.length,
      removed,
      missing,
      needAdvice: multi.length,
      bucketSizes: Object.fromEntries(
        Object.entries(adviceBuckets).map(([k, v]) => [k, v.length]),
      ),
    },
    null,
    2,
  ),
);
