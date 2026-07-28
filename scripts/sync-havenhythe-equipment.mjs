import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const equipmentPath = path.join(root, "data/combat/equipment.json");
const document = JSON.parse(fs.readFileSync(equipmentPath, "utf8"));
const records = Array.isArray(document.records) ? document.records : [];
const byId = new Map(records.map((record) => [record.id, record]));
const verifiedAt = new Date().toISOString().slice(0, 10);

function source(title) {
  return [{ source: "runescape-wiki", url: `https://runescape.wiki/w/${encodeURIComponent(title).replaceAll("%2F", "/")}`, verifiedAt }];
}

function regions(record) {
  return [...new Set((record?.unlock?.regions || []).filter(Boolean))];
}

function addRegion(record, region) {
  record.unlock ||= { type: "drop", requirement: null, regions: [] };
  record.unlock.regions = [...new Set([...regions(record), region])];
}

function upsert(record) {
  const current = byId.get(record.id);
  if (current) Object.assign(current, record, { unlock: { ...(current.unlock || {}), ...(record.unlock || {}) } });
  else {
    records.push(record);
    byId.set(record.id, record);
  }
}

const havensilver = [
  ["item:havensilver-greatsword", "Havensilver greatsword", "twohand", 5, 111.8, 150, "Havensilver_greatsword", "havensilver-greatsword"],
  ["item:havensilver-greatsword-plus-1", "Havensilver greatsword +1", "twohand", 30, 670.5, 454, "Havensilver_greatsword_+1", "havensilver-greatsword"],
  ["item:havensilver-greatsword-plus-2", "Havensilver greatsword +2", "twohand", 60, 1341, 1132, "Havensilver_greatsword_+2", "havensilver-greatsword"],
  ["item:havensilver-longsword", "Havensilver longsword", "mainhand", 5, 61.3, 150, "Havensilver_longsword", "havensilver-longsword"],
  ["item:havensilver-longsword-plus-1", "Havensilver longsword +1", "mainhand", 30, 367.5, 454, "Havensilver_longsword_+1", "havensilver-longsword"],
  ["item:havensilver-longsword-plus-2", "Havensilver longsword +2", "mainhand", 60, 735, 1132, "Havensilver_longsword_+2", "havensilver-longsword"],
  ["item:havensilver-off-hand-longsword", "Havensilver off-hand longsword", "offhand", 5, 30.6, 150, "Havensilver_off-hand_longsword", "havensilver-off-hand-longsword"],
  ["item:havensilver-off-hand-longsword-plus-1", "Havensilver off-hand longsword +1", "offhand", 30, 183.7, 454, "Havensilver_off-hand_longsword_+1", "havensilver-off-hand-longsword"],
  ["item:havensilver-off-hand-longsword-plus-2", "Havensilver off-hand longsword +2", "offhand", 60, 367.5, 1132, "Havensilver_off-hand_longsword_+2", "havensilver-off-hand-longsword"],
];

for (const [id, name, slot, tier, damage, accuracy, title, family] of havensilver) {
  upsert({
    id, name, style: "melee", slot, tier,
    bonuses: { damage, accuracy },
    showcaseFamily: family,
    showcaseLabel: name.replace(/ \+[12]$/, ""),
    showcaseTierRange: [5, 60],
    displayDescription: "Havenhythe havensilver weapon; base, +1 and +2 upgrades collapse into one showcase entry.",
    unlock: { type: "craft", requirement: "Havensilver smithing and Hearts of Sanguine progression", regions: ["havenhythe"] },
    sources: source(title),
  });
}

const bolts = [
  ["item:havensilver-bolt", "Havensilver bolt", 5, 48, "Havensilver_bolt"],
  ["item:havensilver-bolt-plus-1", "Havensilver bolt +1", 30, 288, "Havensilver_bolt_+1"],
  ["item:havensilver-bolt-plus-2", "Havensilver bolt +2", 60, 576, "Havensilver_bolt_+2"],
];
for (const [id, name, tier, damage, title] of bolts) {
  upsert({
    id, name, style: "ranged", slot: "ammo", tier,
    bonuses: { damage },
    showcaseFamily: "havensilver-bolts",
    showcaseLabel: "Havensilver bolts",
    showcaseTierRange: [5, 60],
    displayDescription: "Havenhythe crossbow ammunition; base, +1 and +2 upgrades collapse into one showcase entry.",
    unlock: { type: "craft", requirement: "Havensilver smithing and fletching; Silverquill spines for upgrades", regions: ["havenhythe"] },
    sources: source(title),
  });
}

upsert({
  id: "item:bonecrusher-maul",
  name: "Bonecrusher maul",
  style: "melee",
  slot: "twohand",
  tier: 50,
  displayDescription: "Tier 50 two-handed maul dropped by Ivar, King of Bones.",
  unlock: { type: "drop", requirement: "Ivar, King of Bones", regions: ["havenhythe"] },
  sources: source("Bonecrusher_maul"),
});

upsert({
  id: "item:magic-skull-mask",
  name: "Magic skull mask",
  style: "magic",
  slot: "helmet",
  tier: 45,
  bonuses: { armour: 125.6, damage: 11.2, accuracy: 29 },
  displayDescription: "Tier 45 magic power headgear dropped by Ivar, King of Bones.",
  unlock: { type: "drop", requirement: "Ivar, King of Bones", regions: ["havenhythe"] },
  sources: source("Magic_skull_mask"),
});

upsert({
  id: "item:vampyrism-gloves",
  name: "Vampyrism gloves",
  style: "hybrid",
  slot: "gloves",
  tier: 25,
  displayDescription: "Tier 25 hybrid gloves dropped by Sanguine crawlers; heals 2% of damage dealt, capped at 20 life points per hit.",
  unlock: { type: "drop", requirement: "Sanguine crawlers in Havenhythe", regions: ["havenhythe"] },
  sources: source("Vampyrism_gloves"),
});

upsert({
  id: "item:black-chinchompa",
  name: "Black chinchompa",
  style: "ranged",
  slot: "mainhand",
  tier: 65,
  displayDescription: "Stackable multi-target ranged weapon caught from volatile chinchompas in Havenhythe.",
  unlock: { type: "hunter", requirement: "Box trap volatile chinchompas in Havenhythe", regions: ["havenhythe"] },
  sources: source("Black_chinchompa"),
});

for (const record of records) {
  if (record.id?.startsWith("item:apex-hide-")) {
    record.setId = "apex-hide";
    record.showcaseTierRange = [85, 90];
    record.displayDescription = "Apex hide ranged tank armour, upgradeable from tier 85 to tier 90 (+5), crafted in Havenhythe.";
    record.unlock = { ...(record.unlock || {}), type: "craft", requirement: "Apex-hide tailoring in Havenhythe", regions: ["havenhythe"] };
  }

  if (/^item:(?:custom-fit-)?masterwork-ranged-(?:cowl|body|chaps|vambraces|boots)$/.test(record.id || "")) {
    addRegion(record, "havenhythe");
    record.unlock.requirement = "League self-supply requires Havenhythe apex-hide progression plus Anachronia, Forinthry and Kandarin materials";
  }
}

document.records = records;
document.lastSynced = verifiedAt;
fs.writeFileSync(equipmentPath, `${JSON.stringify(document, null, 2)}\n`);
console.log(JSON.stringify({ records: records.length, havenhythe: records.filter((record) => regions(record).includes("havenhythe")).length, updatedAt: verifiedAt }, null, 2));
