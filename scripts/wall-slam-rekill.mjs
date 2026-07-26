import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));

const kill = [
  "Grace of the elves / signs of the porter supply chain",
  "GOTE + Dark Facet of Grace + ancient elven ritual shard sustain",
  "GOTE gather + porter sustain checklist",
  "Signs of the porter (Divination supply system)",
  "Fury shark outfit + Bait and Switch Fishing stack",
  "Nature's sentinel outfit",
  "Spiny helmet, face mask, earmuffs, nose peg (shop pack)",
  "Igneous cape progression",
  "Curly roots Firemaking ceiling stack (Jadinko + All Fired Up gear)",
  "Scroll of cleansing + herb bag + botanist/factory Herblore stack",
  "Magic golem outfit",
  "Master camouflage outfit",
  "Cooking dual-brewery network (Keldagrim + Phasmatys)",
  "Player-owned house Aquarium and Prawnbroker",
  "Prifddinas spirit tree + Glouron three-tree unlock",
  "Hoardstalker ring",
  "Learn broad arrow / bolt fletching (300 Slayer points)",
  "Learn quicker killing blows (400 Slayer points)",
  "Games necklace teleport package",
  "Ring of duelling",
  "Cremation ability unlock",
  "Ore box tier upgrades",
  "Herb patch network (global herb-run map)",
  "Slayer prefer / block / extend (Assignment Rewards)",
  "Prefer / block slot ladder (quest-point scaled)",
];

for (const name of kill) {
  for (const r of cat.regions) {
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
  }
}

function keep(name, hosts, req = hosts) {
  let t = null;
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u) {
      t = JSON.parse(JSON.stringify(u));
      break;
    }
  }
  if (!t) return;
  const allow = new Set(hosts);
  for (const r of cat.regions) {
    const i = r.upgrades.findIndex((x) => x.name === name);
    if (allow.has(r.id)) {
      if (i < 0) {
        const c = JSON.parse(JSON.stringify(t));
        c.regionId = r.id;
        c.requiredRegions = [...req];
        r.upgrades.push(c);
      } else {
        r.upgrades[i].regionId = r.id;
        r.upgrades[i].requiredRegions = [...req];
      }
    } else if (i >= 0) r.upgrades.splice(i, 1);
  }
}

keep("Volcanic trapper outfit", ["anachronia"], ["anachronia"]);
keep("Toolbelt attach: Seedicide", ["kandarin"], ["kandarin"]);
keep("Seedicide collector upgrade", ["kandarin"], ["kandarin"]);
keep(
  "Auto-burn Woodcutting paths (Superheat Form vs Always Adze vs partial outfit/adze)",
  ["kandarin"],
  ["kandarin"],
);
keep(
  "Bait and Switch + Always Adze dual monolith skilling paths",
  ["anachronia"],
  ["anachronia"],
);
keep("Abyssal Link (The Subtle Blade)", ["kandarin"], ["kandarin"]);
keep("Grasping rune pouch", ["forinthry"], ["forinthry"]);
keep("Dark Facet of Grace (GOTE enchantment)", ["forinthry"], ["forinthry"]);
keep("Always Adze (Seed of the Charyou Tree)", ["kandarin"], ["kandarin"]);

// clamp multi-req
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

// storm
const dig = [
  "Ancient Invention blueprints (Howl's workshop)",
  "Inspire Genius (Howl's Thinking Cap)",
  "Divine Conversion (Cres Framework)",
];
const asg = cat.regions.find((r) => r.id === "asgarnia");
const kan = cat.regions.find((r) => r.id === "kandarin");
for (const name of dig) {
  const i = asg.upgrades.findIndex((u) => u.name === name);
  if (i >= 0) {
    const u = asg.upgrades.splice(i, 1)[0];
    u.regionId = "kandarin";
    u.requiredRegions = ["kandarin"];
    const j = kan.upgrades.findIndex((x) => x.name === name);
    if (j >= 0) Object.assign(kan.upgrades[j], u);
    else kan.upgrades.push(u);
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
const report = {
  metrics: {
    total: cat.regions.reduce((a, r) => a + r.upgrades.length, 0),
    multi: multi.length,
    empty: multi.filter((e) => !e.req.length).length,
    poll: multi.filter((e) => e.req.length === 1).length,
    outside: multi.filter(
      (e) => e.req.length > 1 && e.hosts.some((h) => !e.req.includes(h)),
    ).length,
    stormAsg: asg.upgrades.filter((u) =>
      /Howl|Inspire Genius|Divine Conversion|Ancient Invention blueprints/i.test(
        u.name,
      ),
    ).length,
  },
  multi: multi.map((e) => ({ name: e.name, hosts: e.hosts, req: e.req })),
  askUser: [
    {
      id: "poh-portals",
      q: "POH portal towns: (A) multi-ok all portal regions (B) primary Asgarnia only (C) per-region rows no all_required (D) remove?",
    },
    {
      id: "sirenic",
      q: "Confirm Sirenic T90=forinthry+morytania and elite=forinthry+tirannwn?",
    },
    {
      id: "extreme-webbing",
      q: "Extreme invention webbing: asgarnia+kandarin (POF zygomite) OK, or keep anachronia?",
    },
    {
      id: "elder-div",
      q: "Elder divination path: asgarnia only or dual asgarnia+kandarin?",
    },
    {
      id: "mw-ranged",
      q: "Masterwork ranged pressure: havenhythe only or dual havenhythe+anachronia?",
    },
  ],
};
fs.writeFileSync(
  "scraped-data/wall-slam-final-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report.metrics, null, 2));
console.log("multi remaining", multi.length);
for (const e of multi) {
  console.log("-", e.name);
}
console.log("\nASK USER:");
for (const a of report.askUser) console.log(`[${a.id}] ${a.q}`);
