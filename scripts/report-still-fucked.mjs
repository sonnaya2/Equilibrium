import fs from "node:fs";
const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));

function find(sub) {
  const hits = [];
  for (const r of cat.regions) {
    for (const u of r.upgrades) {
      if (u.name.includes(sub) || u.name.toLowerCase().includes(sub.toLowerCase())) {
        hits.push({
          r: r.id,
          name: u.name,
          req: u.requiredRegions || [],
          d: (u.detail || "").slice(0, 160),
          uo: /UNOBTAINABLE/i.test(u.detail || ""),
        });
      }
    }
  }
  return hits;
}

const map = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!u.name || /^Herb patches/.test(u.name)) continue;
    if (!map.has(u.name)) map.set(u.name, { name: u.name, hosts: [], req: u.requiredRegions || [], d: (u.detail || "").slice(0, 120), uo: /UNOBTAINABLE/i.test(u.detail || "") });
    const e = map.get(u.name);
    if (!e.hosts.includes(r.id)) e.hosts.push(r.id);
  }
}
const multi = [...map.values()].filter((e) => e.hosts.length > 1);

const ruled = [
  /Area Tasks \(achievement/,
  /Elite skilling outfits core/,
  /Grace of the elves/,
  /Pickaxe of/,
  /Imcando tools/,
  /Hatchet of/,
  /Mattock of Time/,
  /Blessed flask/,
  /Sirenic/,
  /Masterwork (ranged armour|plate →)/,
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
];
const suspect = multi.filter((e) => !ruled.some((re) => re.test(e.name)));

console.log("HARD ISSUES (audit): 0 anchors/dups/skip-list/storm");
console.log("TOTAL multi-host names:", multi.length);
console.log("ALREADY RULED intentional:", multi.length - suspect.length);
console.log("STILL NEED CALL / LOOKS WRONG:", suspect.length);
console.log("");

for (const e of suspect.sort((a, b) => b.hosts.length - a.hosts.length)) {
  console.log("•", e.name);
  console.log("  hosts:", e.hosts.join(", "));
  console.log("  req:  ", e.req.join(", ") || "∅");
  if (e.uo) console.log("  tag:   UNOBTAINABLE");
  console.log("  note: ", e.d || "(no detail)");
  console.log("");
}

// host/req mismatches among intentional
console.log("--- HOST OUTSIDE REQ (cosmetic pollution) ---");
const outside = [];
for (const e of multi) {
  const req = e.req || [];
  if (!req.length) continue;
  const bad = e.hosts.filter((h) => !req.includes(h));
  if (bad.length) outside.push({ name: e.name, hosts: e.hosts, req, bad });
}
for (const o of outside) {
  console.log("•", o.name);
  console.log("  hosts", o.hosts.join(","), "req", o.req.join(","), "extra hosts:", o.bad.join(","));
}

console.log("\n--- INV ASGARNIA-ONLY HARD LOCKS (maybe wrong if workbench-global) ---");
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    const req = u.requiredRegions || [];
    if (req.length === 1 && req[0] === "asgarnia" && /invention|gizmo|augment|scrimshaw|essence of finality|arc journal|teletab/i.test(u.name)) {
      console.log("•", u.name, "@", r.id);
    }
  }
}

console.log("\n--- 4+ REGION AND (pressure / UO candidates) ---");
const seen = new Set();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    const req = u.requiredRegions || [];
    if (req.length >= 4 && !seen.has(u.name)) {
      seen.add(u.name);
      console.log("•", u.name, "req=[" + req.join(",") + "]", /UNOBTAINABLE/i.test(u.detail || "") ? "UO" : "NOT tagged UO");
    }
  }
}

// Mattock 4-req without UO is interesting
console.log("\n--- MATT OCK / ARTIFICER detail ---");
for (const sub of ["Mattock of Time", "Artificer"]) {
  for (const h of find(sub)) {
    if (h.name.includes("Mattock of Time") || h.name.includes("Artificer")) {
      console.log(h.r, h.name, "req", h.req.join(","), h.uo ? "UO" : "");
    }
  }
}
