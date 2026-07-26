import fs from "node:fs";
const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));

const claimGlobal =
  /\b(any anvil|any region|not region[- ]locked|not a hard (region|gate|lock)|global (recipe|item|unlock|points|craft)|account[- ]wide|no region (req|gate|lock)|region[- ]agnostic|obtainable anywhere|forge anywhere|smith anywhere|workbench is global|not Asgarnia-locked)/i;

const issues = [];
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    const req = u.requiredRegions || [];
    const d = u.detail || "";
    const n = u.name || "";

    if (req.length && claimGlobal.test(d + n)) {
      const softOk =
        /listing only|soft|optional|separately|Primed glorious|except |hosts only|planner listing|not a hard|practical listing/i.test(
          d,
        );
      if (!softOk) {
        issues.push({
          type: "detail_global_vs_req",
          name: n,
          region: r.id,
          req,
          snip: d.slice(0, 160),
        });
      }
    }

    if (
      !req.length &&
      /Region combo \(all required\)|hard[- ]requires? (asgarnia|kandarin|forinthry|desert|mory|tirann|frem|anach)/i.test(
        d,
      )
    ) {
      issues.push({
        type: "detail_hard_vs_empty_req",
        name: n,
        region: r.id,
        snip: d.slice(0, 160),
      });
    }
  }
}

function parseCombo(d) {
  const m = d.match(/Region combo \(all required\):\s*([a-z_ /+]+)/i);
  if (!m) return null;
  return m[1]
    .split(/\s*[+/]\s*|\s+and\s+/i)
    .map((s) => s.trim().toLowerCase().replace(/\s+/g, "_"))
    .filter(Boolean);
}
const REGION_ALIASES = {
  wilderness: "forinthry",
  wildy: "forinthry",
  mory: "morytania",
  asg: "asgarnia",
  kand: "kandarin",
  tir: "tirannwn",
  anach: "anachronia",
  misth: "misthalin",
};
function norm(id) {
  id = id.replace(/[^a-z_]/g, "");
  return REGION_ALIASES[id] || id;
}
const VALID = new Set([
  "misthalin",
  "asgarnia",
  "kandarin",
  "fremennik",
  "forinthry",
  "desert",
  "morytania",
  "tirannwn",
  "karamja",
  "anachronia",
  "havenhythe",
]);

let comboMismatch = [];
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    const combo = parseCombo(u.detail || "");
    if (!combo || combo.length < 2) continue;
    const req = [...(u.requiredRegions || [])].sort();
    const parsed = [
      ...new Set(combo.map(norm).filter((x) => VALID.has(x))),
    ].sort();
    if (parsed.length >= 2 && JSON.stringify(req) !== JSON.stringify(parsed)) {
      comboMismatch.push({
        name: u.name,
        region: r.id,
        req,
        detailCombo: parsed,
      });
    }
  }
}
const seen = new Set();
comboMismatch = comboMismatch.filter((x) => {
  if (seen.has(x.name)) return false;
  seen.add(x.name);
  return true;
});

function dedupe(arr, key = "name") {
  const s = new Set();
  return arr.filter((x) => {
    if (s.has(x[key])) return false;
    s.add(x[key]);
    return true;
  });
}

console.log("=== DETAIL GLOBAL VS REQ ===");
for (const x of dedupe(issues.filter((i) => i.type === "detail_global_vs_req"))) {
  console.log("-", x.name, "req=[" + x.req + "]", x.snip.slice(0, 110));
}

console.log("\n=== DETAIL HARD VS EMPTY REQ ===");
for (const x of dedupe(
  issues.filter((i) => i.type === "detail_hard_vs_empty_req"),
)) {
  console.log("-", x.name, x.snip.slice(0, 130));
}

console.log("\n=== REGION COMBO TEXT VS requiredRegions ===", comboMismatch.length);
for (const x of comboMismatch.slice(0, 50)) {
  console.log("-", x.name);
  console.log("  req:   ", x.req.join(",") || "∅");
  console.log("  detail:", x.detailCombo.join(","));
}

console.log("\n=== SPOT CHECK ===");
const keys = [
  "Seedicide",
  "Grace of the elves",
  "Fairy ring",
  "General urn",
  "Decorated and exquisite",
  "Mattock of Time",
  "Dragon mattock",
  "Hexcrest",
  "Focus sight",
  "Black mask",
  "Orthen furnace core",
  "Masterwork plate",
  "glorious-bar",
  "Masterwork staff",
  "Masterwork 2h",
  "Masterwork bow",
  "Masterwork Spear",
  "Spear of Annihilation (base",
  "Artificer",
  "Crystal fishing",
  "Always Adze",
  "Inferno adze",
  "Ring of Vigour",
  "Ring of slaying",
  "Elite skilling",
  "Corrupted / full",
  "POH gilded",
  "Extreme invention",
  "Sirenic",
];
for (const k of keys) {
  const hits = [];
  for (const r of cat.regions)
    for (const u of r.upgrades)
      if (u.name.toLowerCase().includes(k.toLowerCase()))
        hits.push(
          r.id + ":req=" + JSON.stringify(u.requiredRegions || []),
        );
  console.log(
    k,
    "→",
    hits.length
      ? hits.slice(0, 5).join(" | ") + (hits.length > 5 ? " …+" + (hits.length - 5) : "")
      : "MISSING",
  );
}

// Skip-list should be gone
console.log("\n=== SKIP LIST SHOULD BE GONE ===");
const skip = [
  "Hoardstalker ring",
  "Learn broad arrow",
  "Games necklace teleport",
  "Ring of duelling",
  "Herb patch network (global",
  "Player-owned house portal towns",
  "Igneous cape progression",
  "Nature's sentinel outfit",
  "Master camouflage outfit",
  "Signs of the porter",
  "Slayer prefer / block",
];
for (const s of skip) {
  let c = 0;
  for (const r of cat.regions)
    for (const u of r.upgrades) if (u.name.includes(s) || u.name.startsWith(s.slice(0, 20))) c++;
  console.log(c ? "STILL HERE " + c + "× " + s : "ok gone: " + s);
}

// req electives > 3 without UO (per unique name)
console.log("\n=== 4+ ELECTIVES SCAN ===");
const FREE = new Set(["misthalin", "havenhythe"]);
const byName = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!byName.has(u.name))
      byName.set(u.name, { req: u.requiredRegions || [], d: u.detail || "" });
  }
}
for (const [n, e] of byName) {
  const el = (e.req || []).filter((x) => !FREE.has(x));
  if (el.length > 3) {
    console.log(
      "-",
      n,
      "el=" + el.join(","),
      /UNOBTAINABLE/i.test(e.d) ? "UO" : "NOT UO",
    );
  }
}

// Write JSON
const out = {
  detailGlobalVsReq: dedupe(
    issues.filter((i) => i.type === "detail_global_vs_req"),
  ),
  detailHardVsEmpty: dedupe(
    issues.filter((i) => i.type === "detail_hard_vs_empty_req"),
  ),
  comboMismatch,
};
fs.writeFileSync(
  "scraped-data/audit-detail-req-mismatch-2026-07-26.json",
  JSON.stringify(out, null, 2) + "\n",
);
console.log("\nWrote scraped-data/audit-detail-req-mismatch-2026-07-26.json");
