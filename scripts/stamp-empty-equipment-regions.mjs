import { readFileSync, writeFileSync } from "node:fs";

const eqPath = "data/combat/equipment.json";
const eq = JSON.parse(readFileSync(eqPath, "utf8"));

const stamps = {
  "item:sirenic-mask": {
    regions: ["forinthry", "kandarin"],
    requirement:
      "Sirenic armour craft (Algarium thread: Forinthry or Kandarin; multi-source scales)",
  },
  "item:sirenic-hauberk": {
    regions: ["forinthry", "kandarin"],
    requirement:
      "Sirenic armour craft (Algarium thread: Forinthry or Kandarin; multi-source scales)",
  },
  "item:sirenic-chaps": {
    regions: ["forinthry", "kandarin"],
    requirement:
      "Sirenic armour craft (Algarium thread: Forinthry or Kandarin; multi-source scales)",
  },
  "item:scrimshaw-of-vampyrism": {
    regions: ["asgarnia"],
    requirement: "Player-owned ports / Arc craft (Asgarnia mapping)",
  },
  "item:scrimshaw-of-the-elements": {
    regions: ["asgarnia"],
    requirement: "Player-owned ports / Arc craft (Asgarnia mapping)",
  },
  "item:scrimshaw-of-cruelty": {
    regions: ["asgarnia"],
    requirement: "Player-owned ports / Arc craft (Asgarnia mapping)",
  },
  "item:superior-scrimshaw-of-vampyrism": {
    regions: ["asgarnia"],
    requirement: "Player-owned ports / Arc craft (Asgarnia mapping)",
  },
  "item:superior-scrimshaw-of-the-elements": {
    regions: ["asgarnia"],
    requirement: "Player-owned ports / Arc craft (Asgarnia mapping)",
  },
  "item:superior-scrimshaw-of-cruelty": {
    regions: ["asgarnia"],
    requirement: "Player-owned ports / Arc craft (Asgarnia mapping)",
  },
  "item:hydra-bakriminel-bolts-e": {
    regions: [],
    requirement: "Invention/Fletching craft (not region-gated)",
  },
  "item:onyx-bakriminel-bolts-e": {
    regions: [],
    requirement: "Invention/Fletching craft (not region-gated)",
  },
  "item:ancient-lantern": {
    regions: [],
    requirement: "Invention craft (not region-gated)",
  },
  "item:second-age-staff": {
    regions: [],
    requirement: "Master clue / global reward (not region-gated)",
  },
  "item:second-age-sword": {
    regions: [],
    requirement: "Master clue / global reward (not region-gated)",
  },
  "item:second-age-bow": {
    regions: [],
    requirement: "Master clue / global reward (not region-gated)",
  },
  "item:greater-runic-staff": {
    regions: [],
    requirement: "Runespan reward (Wizards' Tower shop)",
  },
  "item:elder-longbow": {
    regions: [],
    requirement: "Skilling bow craft (not region-gated)",
  },
  "item:elder-shortbow": {
    regions: [],
    requirement: "Skilling bow craft (not region-gated)",
  },
  "item:magic-composite-bow": {
    regions: [],
    requirement: "Skilling bow craft (not region-gated)",
  },
  "item:magic-longbow": {
    regions: [],
    requirement: "Skilling bow craft (not region-gated)",
  },
  "item:magic-shortbow": {
    regions: [],
    requirement: "Skilling bow craft (not region-gated)",
  },
  "item:yew-composite-bow": {
    regions: [],
    requirement: "Skilling bow craft (not region-gated)",
  },
  "item:yew-longbow": {
    regions: [],
    requirement: "Skilling bow craft (not region-gated)",
  },
  "item:yew-shortbow": {
    regions: [],
    requirement: "Skilling bow craft (not region-gated)",
  },
};

let n = 0;
for (const r of eq.records) {
  const s = stamps[r.id];
  if (!s) continue;
  r.unlock = {
    type: r.unlock?.type || "drop",
    requirement: s.requirement,
    regions: [...s.regions],
  };
  n++;
}
writeFileSync(eqPath, `${JSON.stringify(eq, null, 2)}\n`);

try {
  const idxPath = "data/research/equipment-region-index.json";
  const idx = JSON.parse(readFileSync(idxPath, "utf8"));
  const map = idx.records || idx;
  for (const [id, s] of Object.entries(stamps)) {
    if (s.regions.length) map[id] = [...s.regions];
  }
  if (idx.records) {
    idx.count = Object.keys(idx.records).length;
    writeFileSync(idxPath, `${JSON.stringify(idx, null, 2)}\n`);
  } else {
    writeFileSync(idxPath, `${JSON.stringify(idx, null, 2)}\n`);
  }
} catch (e) {
  console.log("index skip", e.message);
}

const empty = eq.records.filter((r) => !(r.unlock?.regions || []).length);
console.log(
  JSON.stringify(
    {
      stamped: n,
      emptyLeft: empty.length,
      empty: empty.map((r) => r.id),
      sirenic: eq.records.find((r) => r.id === "item:sirenic-mask")?.unlock,
      scrim: eq.records.find((r) => r.id === "item:scrimshaw-of-vampyrism")?.unlock,
    },
    null,
    2,
  ),
);
