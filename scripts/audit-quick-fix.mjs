import fs from "node:fs";
import { dedupeRegionUpgrades } from "./lib/dedupe-region-upgrades.mjs";

const cat = JSON.parse(fs.readFileSync("data/research/catalog.json", "utf8"));

function keep(name, hosts, req) {
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

// Blessed flask combat residual removed (user rule 2026-07-26). Production model stays in progression-unlocks.
// keep("Blessed flask production chain", ...) intentionally omitted.
keep("Asylum surgeon's ring", ["misthalin"], ["misthalin"]);

for (const name of [
  "Hatchet of Bloom and Blight",
  "Hatchet of Ember and Glade",
  "Artificer's measure",
]) {
  for (const r of cat.regions) {
    const u = r.upgrades.find((x) => x.name === name);
    if (u && !(u.detail || "").includes("UNOBTAINABLE")) {
      u.detail =
        (u.detail || "") +
        " · UNOBTAINABLE under Equilibrium 3-elective cap (region pressure exceeds picks).";
    }
  }
}

let n = 0;
for (const r of cat.regions) {
  for (const u of r.upgrades) {
    const req = u.requiredRegions || [];
    if (
      req.length === 1 &&
      req[0] === "asgarnia" &&
      /invention|gizmo|augment|siphon|turtling perk/i.test(u.name)
    ) {
      u.requiredRegions = [];
      n++;
    }
  }
}

// Re-add missing asgarnia content if gone
const asg = cat.regions.find((r) => r.id === "asgarnia");
const need = [
  [
    "Temple of Aminishi",
    "Elite Dungeon / The Arc",
    "ED1 on Aminishi via Arc access (Port Sarim). Equilibrium lists under Asgarnia combat.",
  ],
  [
    "Pest Control",
    "Void Knights' Outpost",
    "Void Knights boat from Port Sarim pier.",
  ],
  [
    "Warriors' Guild",
    "minigame",
    "Warriors' Guild in Burthorpe / Asgarnia.",
  ],
  [
    "Troll Invasion",
    "minigame",
    "Troll Invasion activity (Burthorpe).",
  ],
  [
    "Taverley Dungeon",
    "dungeon",
    "Taverley Dungeon content access.",
  ],
];
for (const [name, kind, detail] of need) {
  if (!asg.content.some((c) => c.name === name)) {
    asg.content.push({
      name,
      kind,
      detail,
      confidence: "confirmed_wiki",
      source: {
        source: "runescape-wiki",
        url: "https://runescape.wiki/w/" + name.replace(/ /g, "_"),
        title: name,
        verifiedAt: "2026-07-26",
      },
    });
    console.log("added content", name);
  }
}

dedupeRegionUpgrades(cat);
fs.writeFileSync(
  "data/research/catalog.json",
  JSON.stringify(cat, null, 2) + "\n",
);
console.log("cleared inv asg-only", n);
console.log(
  "asgarnia content",
  asg.content.map((c) => c.name).join(" | "),
);
