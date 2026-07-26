/**
 * Hunt false region locks / wrong availability:
 * - multi-host with host ⊄ req
 * - empty-req multi (OR/general) without user-known OR pattern
 * - 4+ elective AND not tagged UO
 * - global-sounding names with hard single-region req
 * - anvil/workbench/global smithing language with hard req
 * - invent workbench-ish with asgarnia-only hard
 * - diary multi false positive
 * - requiredRegions containing free-only hosts oddly
 * - skip-list residuals
 */
import fs from "node:fs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const FREE = new Set(["misthalin", "havenhythe"]);
const AUTO = new Set(["karamja"]); // early automatic, not elective pick

const map = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!u.name || /^Herb patches/.test(u.name)) continue;
    if (!map.has(u.name)) {
      map.set(u.name, {
        name: u.name,
        hosts: [],
        reqs: [],
        details: [],
        uo: false,
      });
    }
    const e = map.get(u.name);
    if (!e.hosts.includes(r.id)) e.hosts.push(r.id);
    e.reqs.push([...(u.requiredRegions || [])]);
    e.details.push((u.detail || "").slice(0, 200));
    if (/UNOBTAINABLE/i.test(u.detail || "")) e.uo = true;
  }
}

function electives(req) {
  return req.filter((id) => !FREE.has(id));
}

const multi = [...map.values()].filter((e) => e.hosts.length > 1);
const findings = {
  hostOutsideReq: [],
  multiReqMismatch: [], // same name, different reqs across hosts
  emptyReqMulti: [],
  overCapNotUo: [],
  globalNameHardLock: [],
  anvilGlobalHardLock: [],
  inventAsgOnly: [],
  freeOnlyHardLock: [], // req is only free regions but multi elective hosts
  suspectSingleHard: [],
};

// Known intentional empty multi (OR / general)
const OK_EMPTY_MULTI = [
  /Sirenic/,
  /Black mask/,
  /Area Tasks \(achievement/,
];

// Known intentional multi (user-ruled or researched duals)
const OK_MULTI = [
  /Area Tasks \(achievement/,
  /Elite skilling outfits core/,
  /Grace of the elves/,
  /Pickaxe of/,
  /Imcando tools/,
  /Hatchet of/,
  /Mattock of Time/,
  /Blessed flask/,
  /Sirenic/,
  /Masterwork (staff|2h|bow|Spear|ranged)/,
  /Orthen furnace/,
  /Extreme invention supply/,
  /Slayer Introspection/,
  /All Fired Up/,
  /Death Ward/,
  /Balarak/,
  /Skeka/,
  /POH gilded altar/,
  /Edgeville skilling/,
  /Perfect juju/,
  /Artificer's measure/,
  /Reaver's ring/,
  /Stalker's ring/,
  /Channeller's ring/,
  /Elite tectonic/,
  /Trimmed \/ custom-fit/,
  /Emberkeen/,
  /Superior dragon claws/,
  /Fury of the Small/,
  /Conservation of Energy/,
  /Bonecrusher auto-pickup/,
  /Dark Facet of Passage/,
  /Expansive essence pouch/,
  /Corrupted \/ full multi-style/,
  /Black mask/,
  /Spear of Annihilation \(base/,
];

function okMulti(n) {
  return OK_MULTI.some((re) => re.test(n));
}

for (const e of multi) {
  // normalize req - use first non-empty or first
  const reqSets = e.reqs.map((r) => JSON.stringify([...r].sort()));
  const uniqReq = [...new Set(reqSets)];
  if (uniqReq.length > 1) {
    findings.multiReqMismatch.push({
      name: e.name,
      hosts: e.hosts,
      reqVariants: uniqReq,
    });
  }
  const req = e.reqs[0] || [];
  if (req.length) {
    const outside = e.hosts.filter((h) => !req.includes(h));
    // For Area Tasks each host has req=[self] - audit samples first only; detect properly
    const perHostOk = e.hosts.every((h, i) => {
      const r = e.reqs[i] || [];
      return r.length === 1 && r[0] === h;
    });
    if (perHostOk && /Area Tasks/.test(e.name)) {
      // fine
    } else if (outside.length) {
      findings.hostOutsideReq.push({
        name: e.name,
        hosts: e.hosts,
        req,
        outside,
      });
    }
  } else if (!OK_EMPTY_MULTI.some((re) => re.test(e.name))) {
    findings.emptyReqMulti.push({ name: e.name, hosts: e.hosts });
  }
}

// Over-cap electives without UO
for (const e of map.values()) {
  const req = e.reqs[0] || [];
  const el = electives(req);
  if (el.length > 3 && !e.uo) {
    findings.overCapNotUo.push({
      name: e.name,
      req,
      electives: el,
      hosts: e.hosts,
    });
  }
}

// Global-sounding names with hard locks
const GLOBAL_NAME =
  /global|any anvil|any region|account.?wide|not region|no region|workbench is global|portable|shop pack|point sink is global|any master/i;
const ANVIL =
  /any anvil|anvil works|forge at any|not region-locked|global recipe|global smith/i;

for (const r of cat.regions) {
  for (const u of r.upgrades) {
    const req = u.requiredRegions || [];
    const d = u.detail || "";
    const n = u.name || "";

    if (req.length === 1 && req[0] === "asgarnia" && /invention|gizmo|augment|scrimshaw|essence of finality|arc journal|teletab|machine|disassembl|siphon|separator|junk refiner/i.test(n)) {
      findings.inventAsgOnly.push({ name: n, region: r.id, req });
    }

    if (req.length >= 1 && (GLOBAL_NAME.test(d) || GLOBAL_NAME.test(n))) {
      // detail says global but has hard req - suspicious unless dual intentional
      if (req.length && !/soft|optional|pressure|listing only|host for|not a hard|not hard|geography only|practical listing/i.test(d)) {
        findings.globalNameHardLock.push({
          name: n,
          region: r.id,
          req,
          snippet: d.slice(0, 120),
        });
      }
    }

    if (ANVIL.test(d) && req.length > 0 && /plate|glorious|masterwork bar|smith/i.test(n + d)) {
      findings.anvilGlobalHardLock.push({
        name: n,
        region: r.id,
        req,
        snippet: d.slice(0, 100),
      });
    }

    // Single hard elective on names that sound universal
    if (
      req.length === 1 &&
      !FREE.has(req[0]) &&
      /^(Ring of |Games necklace|Skills necklace|Ore box|Herb patch network|Portable |Thaler |Prefer \/ block|Slayer prefer|Hoardstalker|Learn broad|Learn quicker|Cremation|Silverhawk|Nimble outfit|Witchdoctor|Fletcher|Master constructor|Infinity ethereal|Gemstone golem|Magic golem|Nature's sentinel|Master camouflage)/i.test(
        n,
      )
    ) {
      findings.suspectSingleHard.push({ name: n, region: r.id, req });
    }
  }
}

// Dedupe invent asg
{
  const seen = new Set();
  findings.inventAsgOnly = findings.inventAsgOnly.filter((x) => {
    if (seen.has(x.name)) return false;
    seen.add(x.name);
    return true;
  });
  findings.globalNameHardLock = findings.globalNameHardLock.filter((x, i, a) => a.findIndex((y) => y.name === x.name) === i);
}

// Unruled multi remaining
const unruledMulti = multi
  .filter((e) => !okMulti(e.name) && !/Area Tasks|Herb patches/.test(e.name))
  .map((e) => ({
    name: e.name,
    hosts: e.hosts,
    req: e.reqs[0] || [],
    uo: e.uo,
    electives: electives(e.reqs[0] || []),
    detail: (e.details[0] || "").slice(0, 140),
  }))
  .sort((a, b) => b.hosts.length - a.hosts.length || b.electives.length - a.electives.length);

// Single-host with 3+ electives (tight but ok) vs 4+
const singleFat = [];
for (const e of map.values()) {
  if (e.hosts.length !== 1) continue;
  const el = electives(e.reqs[0] || []);
  if (el.length >= 3) {
    singleFat.push({
      name: e.name,
      host: e.hosts[0],
      req: e.reqs[0],
      electives: el,
      uo: e.uo,
    });
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  totals: {
    upgrades: cat.regions.reduce((a, r) => a + r.upgrades.length, 0),
    multiHostNames: multi.length,
    unruledMulti: unruledMulti.length,
  },
  findings: {
    hostOutsideReq: findings.hostOutsideReq,
    multiReqMismatch: findings.multiReqMismatch,
    emptyReqMulti: findings.emptyReqMulti,
    overCapNotUo: findings.overCapNotUo,
    globalNameHardLock: findings.globalNameHardLock.slice(0, 40),
    anvilGlobalHardLock: findings.anvilGlobalHardLock,
    inventAsgOnly: findings.inventAsgOnly,
    suspectSingleHard: findings.suspectSingleHard,
  },
  unruledMulti,
  singleHost3plusElectives: singleFat.filter((x) => !x.uo),
  singleHostUo: singleFat.filter((x) => x.uo),
};

fs.writeFileSync(
  "scraped-data/audit-false-region-locks-2026-07-26.json",
  JSON.stringify(report, null, 2) + "\n",
);

console.log("=== TOTALS ===");
console.log(JSON.stringify(report.totals, null, 2));
console.log("\n=== HOST OUTSIDE REQ ===", findings.hostOutsideReq.length);
for (const x of findings.hostOutsideReq) console.log("-", x.name, "outside:", x.outside.join(","), "req:", x.req.join(","));
console.log("\n=== MULTI REQ MISMATCH ===", findings.multiReqMismatch.length);
for (const x of findings.multiReqMismatch) console.log("-", x.name, x.reqVariants.join(" | "));
console.log("\n=== EMPTY REQ MULTI ===", findings.emptyReqMulti.length);
for (const x of findings.emptyReqMulti) console.log("-", x.name, x.hosts.join(","));
console.log("\n=== OVER CAP NOT UO ===", findings.overCapNotUo.length);
for (const x of findings.overCapNotUo) console.log("-", x.name, "el:", x.electives.join(","));
console.log("\n=== ANVIL GLOBAL + HARD ===", findings.anvilGlobalHardLock.length);
for (const x of findings.anvilGlobalHardLock) console.log("-", x.name, x.req);
console.log("\n=== GLOBAL-ISH DETAIL + HARD ===", findings.globalNameHardLock.length);
for (const x of findings.globalNameHardLock.slice(0, 25)) console.log("-", x.name, "@", x.region, "req", x.req.join(","));
console.log("\n=== INV ASG-ONLY ===", findings.inventAsgOnly.length);
for (const x of findings.inventAsgOnly) console.log("-", x.name);
console.log("\n=== SUSPECT SKIP-LIST STYLE SINGLE HARD ===", findings.suspectSingleHard.length);
for (const x of findings.suspectSingleHard) console.log("-", x.name, x.req);
console.log("\n=== UNRULED MULTI ===", unruledMulti.length);
for (const x of unruledMulti) {
  console.log("-", x.name);
  console.log("  hosts", x.hosts.join(","), "req", x.req.join(",") || "∅", "el", x.electives.length, x.uo ? "UO" : "");
  console.log(" ", x.detail);
}
console.log("\n=== SINGLE 3+ EL NOT UO ===", singleFat.filter((x) => !x.uo).length);
for (const x of singleFat.filter((x) => !x.uo)) console.log("-", x.name, "el", x.electives.join(","));
