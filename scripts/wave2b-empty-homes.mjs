import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];

function keep(name, hosts, req = hosts) {
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
        r.upgrades.push(c);
      } else {
        r.upgrades[idx].regionId = r.id;
        r.upgrades[idx].requiredRegions = [...req];
      }
    } else if (idx >= 0) {
      r.upgrades.splice(idx, 1);
    }
  }
  log.push("KEEP " + name + " → " + hosts.join(","));
}

const singles = [
  ["Wood box tier upgrades", ["desert"]],
  ["Prayer-book switch network (Zaros / Fort / Elven / War)", ["misthalin"]],
  ["Family Crest cooking and smelting gauntlets", ["asgarnia"]],
  ["Smelting gauntlets", ["asgarnia"]],
  ["Dalia's Tree Nursery eternal magic plots", ["havenhythe"]],
  ["Barbarian Training (Otto multi-skill package)", ["kandarin"]],
  ["Deadliest Catch skilling deposit boxes", ["kandarin"]],
  ["Jadinko Lair curly roots", ["karamja"]],
  ["Brooch of the Gods", ["tirannwn"]],
  ["Entrana Law altar and island skilling access", ["asgarnia"]],
  ["Mining Guild resource dungeon", ["asgarnia"]],
  ["Player-owned port (first-class hub)", ["asgarnia"]],
  ["Scrimshaw of the elements", ["asgarnia"]],
  ["The Arc Waiko reward shop (chime economy)", ["asgarnia"]],
  ["Skillchompas", ["kandarin"]],
  ["Skillchompa Hunter and Player-Owned Farm supply", ["kandarin"]],
  ["Ferocious ring", ["kandarin"]],
  ["Kuradal's Dungeon and ferocious ring hub", ["kandarin"]],
  ["Holy wrench", ["fremennik"]],
  ["Skeka hypnowand Anachronia piece sources", ["anachronia"]],
  ["Red sandstone and potion flasks", ["desert"]],
  ["Slayer helmet craft + full upgrade chain", ["morytania"]],
];

const multis = [
  [
    "Edgeville skilling and Wilderness on-ramp hub",
    ["misthalin", "forinthry"],
  ],
  [
    "Masterwork ranged armour material pressure (Havenhythe/Anachronia Hunter)",
    ["havenhythe", "anachronia"],
  ],
  ["Sirenic armour (T90 ranged power craft)", ["forinthry", "morytania"]],
  ["Sirenic → elite sirenic armour", ["forinthry", "tirannwn"]],
];

for (const [n, h] of singles) keep(n, h, h);
for (const [n, h] of multis) keep(n, h, h);

const stats = dedupeRegionUpgrades(cat);
log.push("DEDUPE " + JSON.stringify(stats));
fs.writeFileSync("data/research/catalog.json", JSON.stringify(cat, null, 2) + "\n");

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
const empty = multi.filter((e) => !e.req.length);
const outside = multi.filter(
  (e) => e.req.length > 1 && e.hosts.some((h) => !e.req.includes(h)),
);

console.log(log.join("\n"));
console.log(
  JSON.stringify(
    {
      total: cat.regions.reduce((a, r) => a + r.upgrades.length, 0),
      multi: multi.length,
      empty: empty.length,
      singlePoll: multi.filter((e) => e.req.length === 1).length,
      outside: outside.length,
      emptyList: empty,
      multiSample: multi.slice(0, 40).map((e) => ({
        name: e.name,
        hosts: e.hosts,
        req: e.req,
      })),
    },
    null,
    2,
  ),
);
