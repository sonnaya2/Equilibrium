import fs from "node:fs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const league = JSON.parse(fs.readFileSync("data/league/regions.json", "utf8"));
const anchors = fs.readFileSync("src/map/data/placeAnchors.ts", "utf8");
const issues = [];
const warn = [];

if (cat.regions.length !== 11) issues.push("region count " + cat.regions.length);
if (league.records.length !== 11) issues.push("league count " + league.records.length);

for (const r of cat.regions) {
  const L = league.records.find((x) => x.id === r.id);
  if (!L) {
    issues.push("league missing " + r.id);
    continue;
  }
  const a1 = [...r.areas].sort().join("|");
  const a2 = [...(L.areas || [])].sort().join("|");
  if (a1 !== a2) warn.push({ k: "areas-desync", r: r.id, cat: r.areas, league: L.areas });
  if (r.areas.some((a) => /^(dinosaurs|hunting|farming)$/i.test(a))) {
    issues.push(r.id + " has stub area names");
  }
  if (r.areas.includes("Karamja") || r.areas.includes("TzHaar area") || r.areas.includes("Araxxor")) {
    issues.push(r.id + " bad area name: " + r.areas.filter((a) => /Karamja|TzHaar area|Araxxor/.test(a)));
  }
}

let noSrcC = 0;
let noSrcU = 0;
for (const r of cat.regions) {
  for (const c of r.content || []) {
    if (!String(c.name || "").trim()) issues.push("blank content " + r.id);
    if (!c.source) noSrcC++;
  }
  for (const u of r.upgrades || []) {
    if (!String(u.name || "").trim()) issues.push("blank upgrade " + r.id);
    if (!u.source) noSrcU++;
  }
}

const coll = [];
const collC = [];
const dups = [];
for (const r of cat.regions) {
  const A = new Set(r.areas);
  const un = r.upgrades.filter((u) => A.has(u.name)).map((u) => u.name);
  const cn = r.content.filter((c) => A.has(c.name)).map((c) => c.name);
  if (un.length) coll.push({ r: r.id, names: un });
  if (cn.length) collC.push({ r: r.id, names: cn });
  const m = new Map();
  for (const u of r.upgrades) m.set(u.name, (m.get(u.name) || 0) + 1);
  for (const [n, c] of m) if (c > 1) dups.push({ r: r.id, n, c });
}

const map = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!u.name || /^Herb patches \(\d+\)$/.test(u.name)) continue;
    if (!map.has(u.name)) {
      map.set(u.name, { name: u.name, hosts: [], req: u.requiredRegions || [] });
    }
    const e = map.get(u.name);
    if (!e.hosts.includes(r.id)) e.hosts.push(r.id);
    if ((u.requiredRegions || []).length) e.req = u.requiredRegions;
  }
}
const multi = [...map.values()].filter((e) => e.hosts.length > 1);
const empty = multi.filter((e) => !e.req.length);
const poll = multi.filter((e) => e.req.length === 1);
const outside = multi.filter(
  (e) => e.req.length > 1 && e.hosts.some((h) => !e.req.includes(h)),
);

const skip = [
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
  "Nature's sentinel outfit",
  "Master camouflage outfit",
  "Magic golem outfit",
];
const skipHits = [];
for (const s of skip) {
  for (const r of cat.regions) {
    for (const u of r.upgrades) {
      if (u.name === s) skipHits.push(r.id + ": " + u.name);
    }
  }
}

const storm = [];
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (
      /Howl|Inspire Genius|Divine Conversion \(Cres\)|Stormguard Citadel|Ancient Invention blueprints/i.test(
        u.name,
      )
    ) {
      storm.push({ host: r.id, name: u.name, req: u.requiredRegions || [] });
    }
  }
}

const invAsg = [];
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    const req = u.requiredRegions || [];
    if (
      req.length === 1 &&
      req[0] === "asgarnia" &&
      /invention|gizmo|augment|siphon|workbench/i.test(u.name + " " + (u.detail || ""))
    ) {
      invAsg.push(u.name);
    }
  }
}

const uo = new Set();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if ((u.detail || "").includes("UNOBTAINABLE")) uo.add(u.name);
  }
}

const anchorAreas = new Map();
for (const m of anchors.matchAll(/region: "([^"]+)", area: "([^"]+)"/g)) {
  if (!anchorAreas.has(m[1])) anchorAreas.set(m[1], new Set());
  anchorAreas.get(m[1]).add(m[2]);
}
const anchorGaps = [];
const orphanAnchors = [];
for (const r of cat.regions) {
  const have = anchorAreas.get(r.id) || new Set();
  const miss = r.areas.filter((a) => !have.has(a));
  if (miss.length) anchorGaps.push({ r: r.id, miss });
  for (const a of have) {
    if (!r.areas.includes(a)) orphanAnchors.push(r.id + "/" + a);
  }
}

const asg = cat.regions.find((r) => r.id === "asgarnia");
const tir = cat.regions.find((r) => r.id === "tirannwn");
const contentChecks = {
  asgarniaHasAminishi: asg.content.some((c) =>
    /Aminishi|Pest Control|Warriors|Taverley Dungeon/i.test(c.name),
  ),
  tirHasLletya:
    tir.areas.includes("Lletya") &&
    tir.areas.includes("Isafdar") &&
    tir.areas.includes("Port Tyras"),
  upOnKandarin: cat.regions
    .find((r) => r.id === "kandarin")
    .areas.includes("Underground Pass"),
  mwRanged: cat.regions
    .filter((r) =>
      r.upgrades.some((u) =>
        /Masterwork ranged armour \(Anachronia/i.test(u.name),
      ),
    )
    .map((r) => r.id),
  extremeInv: cat.regions
    .filter((r) =>
      r.upgrades.some((u) => u.name.includes("Extreme invention supply")),
    )
    .map((r) => r.id),
  portalsGone: !cat.regions.some((r) =>
    r.upgrades.some((u) => /portal towns/i.test(u.name)),
  ),
  sirenicReq: (() => {
    for (const r of cat.regions) {
      const u = r.upgrades.find((x) => x.name.startsWith("Sirenic armour (T90"));
      if (u) return u.requiredRegions || [];
    }
    return null;
  })(),
};

function norm(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
const byNorm = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    const n = norm(u.name);
    if (!byNorm.has(n)) byNorm.set(n, new Set());
    byNorm.get(n).add(u.name);
  }
}
const nearDups = [...byNorm.entries()]
  .filter(([, s]) => s.size > 1)
  .map(([, s]) => [...s]);

const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    hardIssues: issues.length,
    totalUpgrades: cat.regions.reduce((a, r) => a + r.upgrades.length, 0),
    multiHost: multi.length,
    emptyReqMulti: empty.length,
    singleReqPollution: poll.length,
    multiReqOutside: outside.length,
    skipListHits: skipHits.length, // count
    stormAsgarniaDig: storm.filter(
      (s) =>
        s.host === "asgarnia" &&
        /Howl|Inspire|Divine Conversion|blueprints/i.test(s.name),
    ).length,
    inventionAsgarniaOnlyReq: invAsg.length,
    unobtainableFamilies: uo.size,
    areaUpgradeCollisions: coll.length,
    areaContentCollisions: collC.length,
    intraDups: dups.length,
    anchorGaps: anchorGaps.length,
    orphanAnchors: orphanAnchors.length,
    noSrcContent: noSrcC,
    noSrcUpgrades: noSrcU,
    nearDups: nearDups.length,
  },
  hardIssues: issues,
  areasDesync: warn.filter((w) => w.k === "areas-desync"),
  areaUpgradeCollisions: coll,
  areaContentCollisions: collC,
  intraDups: dups,
  emptyReqMulti: empty,
  singleReqPollution: poll,
  multiReqOutside: outside,
  skipListHits: skipHits,
  storm,
  inventionAsgarniaOnlyReq: invAsg,
  unobtainable: [...uo],
  anchorGaps,
  orphanAnchors,
  contentChecks,
  nearDups,
  multiHostList: multi
    .map((e) => ({ name: e.name, hosts: e.hosts, req: e.req }))
    .sort((a, b) => b.hosts.length - a.hosts.length),
  regionCounts: cat.regions.map((r) => ({
    id: r.id,
    areas: r.areas.length,
    content: r.content.length,
    upgrades: r.upgrades.length,
  })),
};

fs.writeFileSync(
  "scraped-data/data-audit-continue-2026-07-26.json",
  JSON.stringify(report, null, 2) + "\n",
);

console.log(JSON.stringify(report.summary, null, 2));
console.log("\n=== HARD ===");
console.log(issues.length ? issues : "none");
console.log("\n=== SKIP LIST RESIDUALS ===");
console.log(skipHits.length ? skipHits : "none");
console.log("\n=== STORM ON ASGARNIA ===");
console.log(
  storm.filter((s) => s.host === "asgarnia" && /Howl|Inspire|Divine|blueprints/i.test(s.name)),
);
console.log("\n=== EMPTY MULTI ===");
console.log(empty.map((e) => e.name + " @ " + e.hosts.join(",")));
console.log("\n=== SINGLE-REQ POLLUTION ===");
console.log(poll.slice(0, 20));
console.log("\n=== MULTI OUTSIDE REQ ===");
console.log(outside.slice(0, 15));
console.log("\n=== AREA=UPGRADE ===");
console.log(coll);
console.log("\n=== AREA=CONTENT ===");
console.log(collC);
console.log("\n=== INTRA DUPS ===");
console.log(dups);
console.log("\n=== ANCHOR GAPS ===");
console.log(anchorGaps);
console.log("\n=== ORPHAN ANCHORS ===");
console.log(orphanAnchors);
console.log("\n=== INV ASG-ONLY REQ ===");
console.log(invAsg);
console.log("\n=== CHECKS ===");
console.log(contentChecks);
console.log("\n=== NEAR DUPS ===");
console.log(nearDups);
console.log("\n=== REGION COUNTS ===");
console.log(report.regionCounts);
console.log("\n=== MULTI (all) ===");
for (const e of report.multiHostList) {
  console.log(
    e.hosts.length + "x",
    e.name.slice(0, 55),
    "| req",
    (e.req || []).join("+") || "[]",
  );
}
