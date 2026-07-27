/**
 * Post-pass reaffirm for items that may still need a durable unlock stamp.
 * pass10 (2026-07-26): no intentional empties for combat residual —
 * second-age + skilling bows are REMOVE_IDS in stamp-equipment-regions.mjs.
 * This script only reaffirms multi-source / late stamps if still present.
 */
import { readFileSync, writeFileSync } from "node:fs";

const eqPath = "data/combat/equipment.json";
const eq = JSON.parse(readFileSync(eqPath, "utf8"));

/** @type {Record<string, { regions: string[], requirement: string }>} */
const stamps = {
  // Base sirenic — Algarium thread Forinthry OR Kandarin; list both for filter visibility.
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
  // POP / Arc scrimshaws — Asgarnia packaging under Equilibrium Arc mapping.
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
  // Bakriminel — Wilderness bloodwood (Forinthry).
  "item:hydra-bakriminel-bolts-e": {
    regions: ["forinthry"],
    requirement: "Bakriminel bolts (Wilderness bloodwood tree, Forinthry)",
  },
  "item:onyx-bakriminel-bolts-e": {
    regions: ["forinthry"],
    requirement: "Bakriminel bolts (Wilderness bloodwood tree, Forinthry)",
  },
  // Ancient lantern — Nex emblem + chaotic splint.
  "item:ancient-lantern": {
    regions: ["asgarnia", "forinthry"],
    requirement: "Ancient lantern (Nex emblem Asgarnia + chaotic splint Forinthry)",
  },
  // Greater runic — Runespan via Wizards' Tower.
  "item:greater-runic-staff": {
    regions: ["misthalin"],
    requirement: "Greater runic staff (Runespan / Wizards' Tower, Misthalin)",
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
      bakriminel: eq.records.find((r) => r.id === "item:onyx-bakriminel-bolts-e")?.unlock,
      lantern: eq.records.find((r) => r.id === "item:ancient-lantern")?.unlock,
      grs: eq.records.find((r) => r.id === "item:greater-runic-staff")?.unlock,
    },
    null,
    2,
  ),
);
