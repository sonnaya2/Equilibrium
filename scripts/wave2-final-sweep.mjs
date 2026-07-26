import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));

const digNames = [
  "Ancient Invention blueprints (Howl's workshop)",
  "Inspire Genius (Howl's Thinking Cap)",
  "Divine Conversion (Cres Framework)",
];
const asg = cat.regions.find((r) => r.id === "asgarnia");
const kan = cat.regions.find((r) => r.id === "kandarin");
for (const name of digNames) {
  const i = asg.upgrades.findIndex((u) => u.name === name);
  if (i >= 0) {
    const u = asg.upgrades.splice(i, 1)[0];
    u.regionId = "kandarin";
    u.requiredRegions = ["kandarin"];
    const j = kan.upgrades.findIndex((x) => x.name === name);
    if (j >= 0) {
      Object.assign(kan.upgrades[j], u, {
        regionId: "kandarin",
        requiredRegions: ["kandarin"],
      });
    } else kan.upgrades.push(u);
  }
}

const kill = [
  "Master camouflage outfit",
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
  "Full slayer helmet and point upgrades (reinforced through corrupted)",
];
for (const name of kill) {
  for (const r of cat.regions) {
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
  }
}

// volcanic anachronia only
let vt = null;
for (const r of cat.regions) {
  const u = r.upgrades.find((x) => x.name === "Volcanic trapper outfit");
  if (u) vt = JSON.parse(JSON.stringify(u));
  r.upgrades = r.upgrades.filter((x) => x.name !== "Volcanic trapper outfit");
}
if (vt) {
  vt.regionId = "anachronia";
  vt.requiredRegions = ["anachronia"];
  cat.regions.find((r) => r.id === "anachronia").upgrades.push(vt);
}

// clamp multi-req hosts
const byName = new Map();
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    if (!byName.has(u.name)) byName.set(u.name, []);
    byName.get(u.name).push({ r, u });
  }
}
for (const [, copies] of byName) {
  if (copies.length < 2) continue;
  const req = copies[0].u.requiredRegions || [];
  if (req.length < 2) continue;
  const same = copies.every((c) => {
    const r = c.u.requiredRegions || [];
    return r.length === req.length && r.every((id) => req.includes(id));
  });
  if (!same) continue;
  for (const { r, u } of copies) {
    if (!req.includes(r.id)) {
      r.upgrades = r.upgrades.filter((x) => x !== u);
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
const asg2 = cat.regions.find((r) => r.id === "asgarnia");

const report = {
  generatedAt: new Date().toISOString(),
  metrics: {
    totalUpgrades: cat.regions.reduce((a, r) => a + r.upgrades.length, 0),
    multiHost: multi.length,
    emptyReqMulti: empty.length,
    singleReqPollution: poll.length,
    multiReqOutside: outside.length,
    stormOnAsgarnia: asg2.upgrades.filter((u) =>
      /Howl|Inspire Genius|Divine Conversion|Ancient Invention blueprints/i.test(
        u.name,
      ),
    ).length,
    herbNetwork: cat.regions.some((r) =>
      r.upgrades.some((u) => /Herb patch network/i.test(u.name)),
    ),
  },
  intentionalMultiHost: multi.map((e) => ({
    name: e.name,
    hosts: e.hosts,
    requiredRegions: e.req,
  })),
  trueWalls: empty.concat(outside).map((e) => ({
    name: e.name,
    hosts: e.hosts,
    req: e.req,
  })),
};
fs.writeFileSync(
  "scraped-data/data-audit-wave2-final-2026-07-26.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report.metrics, null, 2));
console.log("true walls", report.trueWalls.length);
console.log(
  "intentional multi sample:",
  report.intentionalMultiHost
    .slice(0, 15)
    .map((m) => m.name)
    .join(" | "),
);
