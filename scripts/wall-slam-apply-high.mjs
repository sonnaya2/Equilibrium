/**
 * Apply high-confidence wall-slam decisions + merge agent patches that look safe.
 */
import fs from "node:fs";
import path from "node:path";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];

function keep(name, hosts, req = hosts, extra = {}) {
  let t = null;
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u) {
      t = JSON.parse(JSON.stringify(u));
      break;
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
    } else if (idx >= 0) r.upgrades.splice(idx, 1);
  }
  log.push(`KEEP ${name} → [${hosts.join(",")}] req=[${req.join(",")}]`);
}

// High confidence from prior user rulings + logic
keep("Artificer's measure", ["anachronia"], [
  "anachronia",
  "forinthry",
  "tirannwn",
  "morytania",
]);
// ensure UNOBTAINABLE tag
for (const r of cat.regions) {
  const u = r.upgrades.find((x) => x.name === "Artificer's measure");
  if (u && !(u.detail || "").includes("UNOBTAINABLE")) {
    u.detail =
      (u.detail || "") +
      " · UNOBTAINABLE under Equilibrium 3-elective cap (region pressure exceeds picks).";
  }
}

// Crystal rod is Tirannwn; drop fury-shark stack dual display onto tirannwn only
keep(
  "Crystal fishing rod + Prif waterfall + Fury shark stack",
  ["tirannwn"],
  ["tirannwn"],
);

// Ring of slaying craft — no region req
keep("Ring of slaying (craft unlock)", ["misthalin"], []);
{
  const r = cat.regions.find((x) => x.id === "misthalin");
  const u = r.upgrades.find((x) => x.name === "Ring of slaying (craft unlock)");
  if (u) u.requiredRegions = [];
}

// Slayer helm base craft — morytania primary (user D6 style)
keep("Slayer helmet (craft unlock + base helm)", ["morytania"], ["morytania"]);

// Component farms — keep multi material sources OR primary morytania?
// Keep multi with req — user said D3/D4 doesn't matter; leave multi

// Expansive essence pouch — Daemonheim/forinthry + craft misthalin? Keep both if both in req

// Elder divination path — asgarnia invention + kandarin cache: keep dual

// Extreme invention — keep asgarnia+anachronia

// Remove redundant progression checklists if individual tools exist (aggressive but clean)
const checklists = [
  "Hatchet progression checklist (dragon → Imcando → crystal → Ember and Glade → Bloom and Blight)",
  "Mattock progression checklist (dragon → crystal / Imcando → MoTaS → Tony)",
  "Pickaxe progression checklist (dragon → Imcando → crystal → Earth and Song → Life and Death)",
];
for (const name of checklists) {
  for (const r of cat.regions) {
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
  }
  log.push("REMOVE checklist " + name);
}

// Merge agent high-confidence primary decisions if files exist
const dir = "scraped-data/fix-patches/wall-slam";
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    try {
      const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const items = j.decisions || j.items || j.ops || [];
      // handle J-consensus style ops
      if (Array.isArray(j.ops)) {
        for (const op of j.ops) {
          if (op.op === "removeUpgrade" && op.regionId && op.name) {
            const r = cat.regions.find((x) => x.id === op.regionId);
            if (r) r.upgrades = r.upgrades.filter((u) => u.name !== op.name);
          }
          if (op.op === "removeUpgradeByNameAllHosts" && op.name) {
            for (const r of cat.regions)
              r.upgrades = r.upgrades.filter((u) => u.name !== op.name);
          }
          if (op.op === "keepHosts" && op.name && op.hosts) {
            keep(op.name, op.hosts, op.requiredRegions || op.hosts);
          }
          if (op.op === "primary" && op.name && op.home) {
            keep(op.name, [op.home], op.requiredRegions || [op.home]);
          }
        }
        log.push("merged ops from " + f);
      }
      // decisions array
      if (Array.isArray(j.decisions)) {
        for (const d of j.decisions) {
          if (d.confidence !== "high" && d.confidence !== "medium") continue;
          if (d.action === "primary" && d.home) {
            keep(d.name, [d.home], d.requiredRegions || [d.home]);
          } else if (d.action === "keepHosts" && d.hosts) {
            keep(d.name, d.hosts, d.requiredRegions || d.hosts);
          } else if (d.action === "remove" || d.action === "remove_all") {
            for (const r of cat.regions)
              r.upgrades = r.upgrades.filter((u) => u.name !== d.name);
            log.push("REMOVE " + d.name + " via " + f);
          }
        }
        log.push("merged decisions from " + f);
      }
    } catch (e) {
      log.push("skip " + f + " " + e.message);
    }
  }
}

dedupeRegionUpgrades(cat);
fs.writeFileSync(
  "data/research/catalog.json",
  JSON.stringify(cat, null, 2) + "\n",
);

const map = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!u.name || /^Herb patches/.test(u.name)) continue;
    if (!map.has(u.name))
      map.set(u.name, { name: u.name, hosts: [], req: u.requiredRegions || [] });
    const e = map.get(u.name);
    if (!e.hosts.includes(r.id)) e.hosts.push(r.id);
    if ((u.requiredRegions || []).length) e.req = u.requiredRegions;
  }
}
const multi = [...map.values()].filter((e) => e.hosts.length > 1);
console.log(log.join("\n"));
console.log(
  JSON.stringify(
    {
      total: cat.regions.reduce((a, r) => a + r.upgrades.length, 0),
      multi: multi.length,
      empty: multi.filter((e) => !e.req.length).length,
      poll: multi.filter((e) => e.req.length === 1).length,
      multi: multi.map((e) => ({
        n: e.name,
        h: e.hosts,
        r: e.req,
      })),
    },
    null,
    2,
  ),
);
