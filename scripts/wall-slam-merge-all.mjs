/**
 * Merge all wall-slam agent decision files with high/medium confidence.
 */
import fs from "node:fs";
import path from "node:path";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));
const log = [];
const askUser = [];

function keep(name, hosts, req = hosts, extra = {}) {
  let t = null;
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name || x.name.startsWith(name.slice(0, 40)));
    if (u && (u.name === name || name.length > 20)) {
      if (u.name === name) {
        t = JSON.parse(JSON.stringify(u));
        break;
      }
    }
  }
  // exact only
  t = null;
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u) {
      t = JSON.parse(JSON.stringify(u));
      break;
    }
  }
  if (!t) {
    log.push("MISS " + name);
    return false;
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
  log.push(`KEEP ${name} → [${hosts.join(",")}]`);
  return true;
}

function removeAll(name) {
  let c = 0;
  for (const r of cat.regions) {
    const b = r.upgrades.length;
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
    c += b - r.upgrades.length;
  }
  if (c) log.push(`RM ${c}× ${name}`);
}

// --- Hard consensus from agents A–J + G wiki ---
const decisions = [
  // Tools A
  {
    name: "Pickaxe of Life and Death",
    hosts: ["fremennik", "tirannwn", "asgarnia"],
  },
  {
    name: "Pickaxe of Earth and Song",
    hosts: ["fremennik", "tirannwn", "kandarin"],
  },
  {
    name: "Imcando tools family (pickaxe, hatchet, related craft pressure)",
    hosts: ["fremennik", "misthalin", "asgarnia"],
  },
  {
    name: "Hatchet of Ember and Glade",
    hosts: ["forinthry", "tirannwn", "fremennik", "asgarnia"],
    uo: true,
  },
  {
    name: "Hatchet of Bloom and Blight",
    hosts: [
      "tirannwn",
      "misthalin",
      "asgarnia",
      "fremennik",
      "desert",
      "morytania",
    ],
    uo: true,
  },
  {
    name: "Mattock of Time and Space",
    hosts: ["tirannwn", "misthalin", "kandarin", "anachronia"],
  },
  // Orthen B
  {
    name: "Masterwork plate → Orthen furnace core pressure stack",
    hosts: ["forinthry", "desert", "anachronia", "asgarnia"],
    req: ["forinthry", "desert", "anachronia"],
  },
  {
    name: "Orthen furnace core + Superheat Form + smithing autoheater stack",
    hosts: ["anachronia", "tirannwn", "forinthry"],
  },
  {
    name: "Orthen furnace core full skilling stack",
    hosts: ["anachronia", "tirannwn"],
    req: ["anachronia", "tirannwn", "forinthry"],
  },
  {
    name: "Masterwork Spear of Annihilation",
    hosts: ["asgarnia", "morytania"],
  },
  {
    name: "Masterwork ranged armour material pressure (Havenhythe/Anachronia Hunter)",
    hosts: ["havenhythe"],
    req: [],
  },
  {
    name: "Trimmed / custom-fit trimmed masterwork melee armour",
    hosts: ["asgarnia", "morytania"],
  },
  {
    name: "Elite tectonic robe armour",
    hosts: ["asgarnia", "forinthry"],
  },
  {
    name: "Bonecrusher auto-pickup upgrade (Waiko / Boni)",
    hosts: ["asgarnia", "forinthry"],
  },
  // Invention C + G
  {
    name: "Artificer's measure",
    hosts: ["anachronia"],
    req: ["anachronia", "forinthry", "tirannwn", "morytania"],
    uo: true,
  },
  {
    name: "Extreme invention supply combo (Guild + webbing + Herblore)",
    hosts: ["asgarnia", "kandarin"],
    req: ["asgarnia", "kandarin"],
  },
  {
    name: "Elder divination outfit path (Cache base + Invention elite)",
    hosts: ["asgarnia"],
    req: ["asgarnia"],
  },
  {
    name: "All Fired Up → Inferno adze reward chain",
    hosts: ["asgarnia", "forinthry"],
  },
  {
    name: "Death Ward relic chain",
    hosts: ["asgarnia", "kandarin"],
  },
  {
    name: "Conservation of Energy relic chain",
    hosts: ["kandarin", "asgarnia", "misthalin"],
  },
  {
    name: "Fury of the Small relic chain",
    hosts: ["kandarin", "misthalin"],
  },
  {
    name: "Expansive essence pouch (70 essence, non-degrading)",
    hosts: ["misthalin", "forinthry"],
  },
  // GOTE D
  {
    name: "Grace of the elves (GOTE)",
    hosts: ["forinthry", "tirannwn"],
  },
  {
    name: "Balarak's sash brush",
    hosts: ["forinthry", "anachronia"],
  },
  {
    name: "Skeka's hypnowand",
    hosts: ["forinthry", "anachronia"],
  },
  {
    name: "Crystal fishing rod + Prif waterfall + Fury shark stack",
    hosts: ["tirannwn"],
    req: ["tirannwn"],
  },
  {
    name: "Perfect juju potion production path",
    hosts: ["karamja", "tirannwn"],
  },
  {
    name: "Blessed flask production chain",
    hosts: ["desert", "morytania", "tirannwn", "forinthry"],
    uo: true,
  },
  // Slayer E
  {
    name: "Slayer Introspection (Amascut's Enchanted Gem)",
    hosts: ["kandarin", "morytania", "desert"],
  },
  {
    name: "Slayer helmet (craft unlock + base helm)",
    hosts: ["morytania"],
    req: ["morytania"],
  },
  {
    name: "Slayer helmet component farms",
    hosts: ["morytania", "karamja", "desert", "misthalin"],
  },
  {
    name: "Ring of slaying (craft unlock)",
    hosts: ["misthalin"],
    req: [],
  },
  {
    name: "Sirenic armour (T90 ranged power craft)",
    hosts: ["forinthry", "morytania"],
  },
  {
    name: "Sirenic → elite sirenic armour",
    hosts: ["forinthry", "tirannwn"],
  },
  {
    name: "Stalker's ring",
    hosts: ["anachronia", "fremennik"],
  },
  {
    name: "Reaver's ring",
    hosts: ["anachronia", "fremennik"],
  },
  {
    name: "Channeller's ring",
    hosts: ["anachronia", "fremennik"],
  },
  // Infra F
  {
    name: "Area Tasks (achievement diaries) skilling overview",
    hosts: [
      "misthalin",
      "karamja",
      "asgarnia",
      "kandarin",
      "fremennik",
      "forinthry",
      "desert",
      "morytania",
      "tirannwn",
    ],
  },
  {
    name: "Fairy ring network (Zanaris hub)",
    hosts: ["misthalin", "morytania"],
    req: ["misthalin"],
  },
  {
    name: "POH gilded altar (Chapel offering)",
    hosts: ["fremennik", "tirannwn", "forinthry"],
    req: ["fremennik", "tirannwn", "forinthry"],
  },
  {
    name: "Edgeville skilling and Wilderness on-ramp hub",
    hosts: ["misthalin", "forinthry"],
  },
  {
    name: "Elite skilling outfits core set (ironman fragment paths)",
    hosts: ["kandarin", "forinthry", "anachronia"],
    req: ["kandarin", "forinthry", "anachronia"],
  },
  // Dark Facet forinthry only (user B2)
  {
    name: "Dark Facet of Grace (GOTE enchantment)",
    hosts: ["forinthry"],
    req: ["forinthry"],
  },
];

// Walls for user (not auto)
askUser.push({
  id: "poh-portals",
  name: "Player-owned house portal towns and Construction utilities",
  question:
    "POH portal towns: (A) multi-ok full map on all portal regions, (B) primary Asgarnia Rimmington only, (C) split into per-region portal rows without all_required, or (D) remove as convenience-only?",
});
askUser.push({
  id: "sirenic-confirm",
  name: "Sirenic T90 + elite",
  question:
    "Agents set Sirenic T90 = forinthry+morytania and elite = forinthry+tirannwn. Confirm or correct?",
});
askUser.push({
  id: "extreme-invention-webbing",
  name: "Extreme invention supply combo",
  question:
    "Wiki agent says mycelial webbing is POF zygomite (Kandarin Manor Farm), not Anachronia. We set hosts asgarnia+kandarin. Confirm? (was asgarnia+anachronia)",
});
askUser.push({
  id: "elder-div-path",
  name: "Elder divination outfit path",
  question:
    "Wiki agent demotes Kandarin Cache to optional; primary Asgarnia Invention only. Confirm single asgarnia or keep dual asgarnia+kandarin?",
});
askUser.push({
  id: "masterwork-ranged-host",
  name: "Masterwork ranged armour material pressure",
  question:
    "Agent B: primary havenhythe only (Anachronia densify support). Keep dual havenhythe+anachronia instead?",
});

for (const d of decisions) {
  const req = d.req !== undefined ? d.req : d.hosts;
  keep(d.name, d.hosts, req);
  if (d.uo) {
    for (const r of cat.regions) {
      const u = r.upgrades.find((x) => x.name === d.name);
      if (u && !(u.detail || "").includes("UNOBTAINABLE")) {
        u.detail =
          (u.detail || "") +
          " · UNOBTAINABLE under Equilibrium 3-elective cap (region pressure exceeds picks).";
      }
    }
  }
}

// Remove checklists if any remain
for (const name of [
  "Hatchet progression checklist (dragon → Imcando → crystal → Ember and Glade → Bloom and Blight)",
  "Mattock progression checklist (dragon → crystal / Imcando → MoTaS → Tony)",
  "Pickaxe progression checklist (dragon → Imcando → crystal → Earth and Song → Life and Death)",
  "Full slayer helmet and point upgrades (reinforced through corrupted)",
]) {
  for (const r of cat.regions) {
    r.upgrades = r.upgrades.filter((u) => u.name !== name);
  }
}

// Stormguard again
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
  log,
  askUser,
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
  remainingMulti: multi.map((e) => ({
    name: e.name,
    hosts: e.hosts,
    req: e.req,
  })),
};
fs.writeFileSync(
  "scraped-data/wall-slam-merge-report.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report.metrics, null, 2));
console.log("\nASK USER:");
for (const q of askUser) {
  console.log(`\n[${q.id}] ${q.name}\n  ${q.question}`);
}
console.log("\nremaining multi", multi.length);
for (const e of multi) {
  console.log("-", e.name, "|", e.hosts.join(","), "| req", e.req.join("+") || "[]");
}
