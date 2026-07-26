/**
 * User answers to wall-slam askUser:
 * 1. POH portals → D remove
 * 2. Sirenic — Algarium thread = forinthry OR kandarin
 * 3. Extreme invention webbing = normal POF farm (Kandarin), not dino
 * 4. Invention workbench is global (not Asgarnia-locked)
 * 5. Masterwork ranged = Anachronia + Wildy + Kandarin hard; check other reqs
 */
import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];

function removeAll(name) {
  let c = 0;
  for (const r of cat.regions) {
    const b = r.upgrades.length;
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
    c += b - r.upgrades.length;
  }
  if (c) log.push(`RM ${c}× ${name}`);
}

function keep(name, hosts, req, extra = {}) {
  let t = null;
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u) {
      t = JSON.parse(JSON.stringify(u));
      break;
    }
  }
  if (!t) {
    // fuzzy
    for (const r of cat.regions) {
      const u = r.upgrades.find((x) => x.name.includes(name.slice(0, 30)));
      if (u && u.name.includes(name.slice(0, 20))) {
        t = JSON.parse(JSON.stringify(u));
        name = u.name;
        break;
      }
    }
  }
  if (!t) {
    log.push("MISS " + name);
    return;
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
  log.push(`KEEP ${name} hosts=[${hosts}] req=[${req}]`);
}

function patchName(matchFn, fn) {
  for (const r of cat.regions) {
    for (const u of r.upgrades) {
      if (matchFn(u)) fn(r, u);
    }
  }
}

// ─── 1. POH portals → remove ───────────────────────────────────────────────
removeAll("Player-owned house portal towns and Construction utilities");

// ─── 2. Sirenic — Algarium thread forinthry OR kandarin ─────────────────────
// Scales: typically ED / aquatic content pressure; elite adds more.
// Hosts: forinthry + kandarin (thread) + morytania if scale farms still useful for T90.
// User specifically: Algarium thread = wildy OR Kandarin.
const sirenicT90 = "Sirenic armour (T90 ranged power craft)";
const sirenicElite = "Sirenic → elite sirenic armour";
const sirenicEliteAlt = "Elite sirenic armour (T92 ranged power)";

keep(
  sirenicT90,
  ["forinthry", "kandarin", "morytania"],
  ["forinthry", "kandarin"],
  {
    detail:
      "Sirenic T90 craft. Algarium thread is hard-gated to Forinthry (Wilderness) OR Kandarin (user ruling — either region supplies thread). Ancient scales / other materials stay multi-source pressure (e.g. Morytania listed for scale geography support). Not a single-region lock. · Thread: forinthry OR kandarin.",
  },
);

keep(
  sirenicElite,
  ["forinthry", "kandarin", "tirannwn"],
  ["forinthry", "kandarin"],
  {
    detail:
      "Elite sirenic upgrade path. Algarium thread still Forinthry OR Kandarin. Additional elite materials may pressure Tirannwn / ED content — thread rule is the hard geography call. · Thread: forinthry OR kandarin.",
  },
);

// Demote Asgarnia-only elite sirenic residual if present
removeAll(sirenicEliteAlt);

// ─── 3. Extreme invention — Manor Farm / normal POF, not dino ───────────────
keep(
  "Extreme invention supply combo (Guild + webbing + Herblore)",
  ["asgarnia", "kandarin"],
  ["asgarnia", "kandarin"],
  {
    detail:
      "Extreme invention potion / power loop. Mycelial webbing is from normal Player-Owned Farm rare zygomites at Manor Farm (Kandarin) — not Anachronia dinosaur farm (user ruling). Invention Guild / boosts remain useful Asgarnia geography for discovery, but workbenches themselves are not Asgarnia-locked (see invention-global note). · Hard: asgarnia + kandarin (Manor Farm webbing).",
  },
);

// Also fix boost path if it hard-req only asgarnia for workbench reasons
patchName(
  (u) => /Extreme invention potion boost/i.test(u.name),
  (r, u) => {
    // Don't invent asgarnia-only hard lock for workbench
    if (
      Array.isArray(u.requiredRegions) &&
      u.requiredRegions.length === 1 &&
      u.requiredRegions[0] === "asgarnia"
    ) {
      u.requiredRegions = [];
      u.detail =
        (u.detail || "") +
        " · Invention workbench is global (not Asgarnia-locked). Asgarnia hosts remain natural for Guild discovery geography only.";
      log.push(`cleared asgarnia-only req on ${u.name} @ ${r.id}`);
    }
  },
);

// ─── 4. Invention workbench global ──────────────────────────────────────────
// Clear false Asgarnia-only requiredRegions on invention progression that only
// need a workbench / machine UI, not the Guild landmass.
const inventionWorkbenchGlobal = (u) => {
  const n = u.name || "";
  return (
    /gizmo shell|invention machine|invention guild named|ancient weapon \/ armour \/ tool gizmo|Gizmo shells/i.test(
      n,
    ) ||
    (/invention/i.test(n) &&
      /workbench|machine|gizmo|blueprint discovery/i.test(u.detail || ""))
  );
};

patchName(inventionWorkbenchGlobal, (r, u) => {
  const req = u.requiredRegions || [];
  // If only asgarnia, clear — workbench is global
  if (req.length === 1 && req[0] === "asgarnia") {
    u.requiredRegions = [];
    if (!(u.detail || "").includes("workbench is global")) {
      u.detail =
        (u.detail || "") +
        " · Invention workbench access is treated as global (user ruling) — not an Asgarnia hard gate. Guild geography still labels Asgarnia for on-site machines.";
    }
    log.push(`invention-global cleared req ${u.name} @ ${r.id}`);
  }
  // Machines at Guild: keep asgarnia as host display but empty hard req for workbench-only
  if (/Invention machines \(Invention Guild/i.test(u.name)) {
    u.requiredRegions = [];
    u.detail =
      (u.detail || "") +
      " · Guild machine room sits in Asgarnia, but workbench/crafting is not region-locked (user: invention workbench global).";
    log.push(`invention machines globalized ${r.id}`);
  }
});

// Elder divination path — workbench not asgarnia-locked; Cache optional
// User: invention workbench global → don't dual-lock asgarnia+kandarin for workbench
// Prefer single row with empty hard reqs or only optional pressure notes
keep(
  "Elder divination outfit path (Cache base + Invention elite)",
  ["asgarnia", "kandarin"],
  [],
  {
    detail:
      "Elder divination outfit: fragments while training Div anywhere; elite path uses Invention. Invention workbench is global (user ruling) — not Asgarnia-locked. Kandarin Guthixian Cache helps base/inheritance diviners gear but is not a hard elective gate. Hosts Asgarnia (Guild labelling) + Kandarin (Cache labelling) for planner visibility only.",
  },
);

// Invention Guild named machine room — place is Asgarnia, workbench global
keep("Invention Guild named machine room", ["asgarnia"], [], {
  detail:
    "Named Guild machine list. Building sits in Asgarnia; Invention workbench use is global (user ruling).",
});

// Gizmo shells — manufacture at workbench = global
patchName(
  (u) => /Gizmo shells|gizmo shells/i.test(u.name),
  (r, u) => {
    u.requiredRegions = [];
    if (!(u.detail || "").includes("workbench is global")) {
      u.detail =
        (u.detail || "") +
        " · Shell crafting at Invention workbench is global (user ruling). Stormguard/ancient discovery pressure may still be Kandarin.";
    }
  },
);

// ─── 5. Masterwork ranged — Anachronia + Wildy + Kandarin hard ───────────────
// Check other common masterwork ranged reqs: glorious bar / plate often Asgarnia
// smithing, but user said hard required are the three. Note possible other pressure.
const mwRangedNames = [
  "Masterwork ranged armour material pressure (Havenhythe/Anachronia Hunter)",
  "Apex hide → Masterwork Ranged craft path",
];

// Normalize to one clear row name on the three hard regions
const mwDetail =
  "Masterwork ranged materials. HARD required regions (user ruling): Anachronia + Forinthry/Wilderness + Kandarin. " +
  "Anachronia: BGH / hide / densify path. Forinthry: Wilderness material pressure. Kandarin: non-dino farm / supply pressure in the chain. " +
  "Other possible pressure (not hard-locked here): Asgarnia masterwork smithing / plate infrastructure, Havenhythe BGH alternate densify — re-check recipe if ironman self-source maps change. " +
  "Glorious bar / trimmed paths may still cross Asgarnia independently.";

// Remove havenhythe-only soft rows; place on anachronia, forinthry, kandarin
for (const n of mwRangedNames) removeAll(n);

const mwName = "Masterwork ranged armour (Anachronia + Wildy + Kandarin)";
for (const rid of ["anachronia", "forinthry", "kandarin"]) {
  const r = cat.regions.find((x) => x.id === rid);
  r.upgrades.push({
    name: mwName,
    category: "Masterwork ranged",
    detail: mwDetail,
    requirements: [
      "Anachronia (hard)",
      "Forinthry/Wilderness (hard)",
      "Kandarin (hard)",
    ],
    confidence: "user_ruling_2026-07-26",
    source: {
      source: "derived",
      url: "https://runescape.wiki/w/Masterwork_ranged_armour",
      title: "Masterwork ranged armour",
      verifiedAt: "2026-07-26",
    },
    regionId: rid,
    requiredRegions: ["anachronia", "forinthry", "kandarin"],
  });
}
log.push("MW ranged hard anachronia+forinthry+kandarin");

// Other masterwork ranged mentions
patchName(
  (u) =>
    /masterwork ranged|Masterwork Ranged/i.test(u.name) &&
    u.name !== mwName,
  (r, u) => {
    u.requiredRegions = ["anachronia", "forinthry", "kandarin"];
    u.detail =
      (u.detail || "") +
      " · Hard req aligned: Anachronia + Wildy + Kandarin (user ruling).";
    log.push(`aligned other MW ranged ${u.name} @ ${r.id}`);
  },
);

dedupeRegionUpgrades(cat);
fs.writeFileSync(
  "data/research/catalog.json",
  JSON.stringify(cat, null, 2) + "\n",
);

// Verify
const checks = {};
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (
      /portal towns|Sirenic|Extreme invention supply|Elder divination outfit path|Masterwork ranged armour \(Anachronia/i.test(
        u.name,
      )
    ) {
      if (!checks[u.name]) checks[u.name] = [];
      checks[u.name].push({
        host: r.id,
        req: u.requiredRegions || [],
      });
    }
  }
}
console.log(log.join("\n"));
console.log(JSON.stringify(checks, null, 2));
console.log(
  "portal remaining",
  cat.regions.some((r) =>
    r.upgrades.some((u) => /portal towns/i.test(u.name)),
  ),
);
