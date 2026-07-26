/**
 * Merge slotted candidates from equipment-sync-report into data/combat/equipment.json.
 * Preserves existing records (bonuses, tiers). Adds missing wearables only.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eqPath = path.join(root, "data/combat/equipment.json");
const reportPath = path.join(root, "scraped-data/equipment-sync-report-2026-07-26.json");

const JUNK =
  /armoursmith|flakes|abilities|achievement|category:|cloth|repair|components?$|energy$|codex$|artefact$|nilas|core of leng|genesis|progress|shard of|update:|template:|file:|defence abilities|liberation of mazcab|croesus$/i;

const SET_ONLY =
  /^(malevolent|tectonic|sirenic|elite sirenic|virtus|torva|bandos|pernix|anima core of \w+|cryptbloom|dracolich|ganodermic|subjugation) (armour|equipment|set)$/i;

function wikiUrl(title) {
  const t = String(title || "").replace(/ /g, "_");
  return `https://runescape.wiki/w/${t}`;
}

const eq = JSON.parse(fs.readFileSync(eqPath, "utf8"));
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const byId = new Map(eq.records.map((r) => [r.id, r]));

let added = 0;
let updated = 0;
let skipped = 0;

for (const c of report.candidates ?? []) {
  if (!c.slot || c.tier == null || c.tier < 70) {
    skipped++;
    continue;
  }
  if (JUNK.test(c.name) || JUNK.test(c.wikiTitle || "") || SET_ONLY.test(c.name)) {
    skipped++;
    continue;
  }
  const existing = byId.get(c.id);
  if (existing) {
    let ch = false;
    if (!existing.slot && c.slot) {
      existing.slot = c.slot;
      ch = true;
    }
    if (existing.tier == null && c.tier != null) {
      existing.tier = c.tier;
      ch = true;
    }
    if (!existing.style && c.style) {
      existing.style = c.style;
      ch = true;
    }
    if (ch) updated++;
    continue;
  }
  const rec = {
    id: c.id,
    name: c.name,
    style: c.style,
    slot: c.slot,
    tier: c.tier,
    bonuses: {},
    sources: [
      {
        source: "runescape-wiki",
        url: wikiUrl(c.wikiTitle || c.name),
        verifiedAt: "2026-07-26",
      },
    ],
  };
  if (c.setName) {
    rec.setId = c.setName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }
  eq.records.push(rec);
  byId.set(c.id, rec);
  added++;
}

const EXTRA = [
  { id: "item:reaper-necklace", name: "Reaper necklace", style: "hybrid", slot: "amulet", tier: 90 },
  { id: "item:amulet-of-souls", name: "Amulet of souls", style: "hybrid", slot: "amulet", tier: 90 },
  { id: "item:ring-of-death", name: "Ring of death", style: "hybrid", slot: "ring", tier: 90 },
  { id: "item:luck-of-the-dwarves", name: "Luck of the Dwarves", style: "hybrid", slot: "ring", tier: 90 },
  { id: "item:cinderbane-gloves", name: "Cinderbane gloves", style: "melee", slot: "gloves", tier: 90 },
  { id: "item:gloves-of-passage", name: "Gloves of passage", style: "melee", slot: "gloves", tier: 85 },
  { id: "item:nightmare-gauntlets", name: "Nightmare gauntlets", style: "ranged", slot: "gloves", tier: 85 },
  { id: "item:enhanced-excalibur", name: "Enhanced Excalibur", style: "melee", slot: "offhand", tier: 75 },
  { id: "item:igneous-kal-zuk", name: "Igneous Kal-Zuk", style: "hybrid", slot: "cape", tier: 99 },
  { id: "item:igneous-kal-xil", name: "Igneous Kal-Xil", style: "ranged", slot: "cape", tier: 99 },
  { id: "item:igneous-kal-mej", name: "Igneous Kal-Mej", style: "magic", slot: "cape", tier: 99 },
  { id: "item:igneous-kal-ket", name: "Igneous Kal-Ket", style: "melee", slot: "cape", tier: 99 },
  { id: "item:igneous-kal-mor", name: "Igneous Kal-Mor", style: "necromancy", slot: "cape", tier: 99 },
  { id: "item:blast-diffusion-boots", name: "Blast diffusion boots", style: "magic", slot: "boots", tier: 90 },
  { id: "item:hailfire-boots", name: "Hailfire boots", style: "magic", slot: "boots", tier: 90 },
  { id: "item:flarefrost-boots", name: "Flarefrost boots", style: "ranged", slot: "boots", tier: 90 },
  { id: "item:emberkeen-boots", name: "Emberkeen boots", style: "melee", slot: "boots", tier: 90 },
];

for (const e of EXTRA) {
  if (byId.has(e.id)) continue;
  const rec = {
    ...e,
    bonuses: {},
    sources: [{ source: "runescape-wiki", url: wikiUrl(e.name), verifiedAt: "2026-07-26" }],
  };
  eq.records.push(rec);
  byId.set(e.id, rec);
  added++;
}

eq.lastSynced = "2026-07-26";
fs.writeFileSync(eqPath, `${JSON.stringify(eq, null, 2)}\n`);

const wear = eq.records.filter((r) => r.slot);
const byStyle = {};
for (const r of wear) byStyle[r.style || "none"] = (byStyle[r.style || "none"] || 0) + 1;
console.log(
  JSON.stringify(
    { total: eq.records.length, wearables: wear.length, added, updated, skipped, byStyle },
    null,
    2,
  ),
);
