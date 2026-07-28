import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const equipmentPath = path.join(root, "data/combat/equipment.json");
const iconsPath = path.join(root, "data/combat/equipment-icon-slugs.json");
const outPath = path.join(root, "data/combat/equipment-showcase.json");

const equipment = JSON.parse(fs.readFileSync(equipmentPath, "utf8"));
const iconSlugs = new Set(JSON.parse(fs.readFileSync(iconsPath, "utf8")));
const records = exactById(equipment.records || []);

const ARMOUR_SLOTS = new Set(["helmet", "head", "body", "torso", "legs", "gloves", "boots"]);
const SLOT_PRIORITY = new Map([
  ["body", 0], ["torso", 0], ["twohand", 1], ["mainhand", 2], ["helmet", 3], ["head", 3],
  ["legs", 4], ["offhand", 5], ["cape", 6], ["gloves", 7], ["boots", 8], ["ring", 9],
  ["amulet", 10], ["neck", 10], ["pocket", 11], ["ammo", 12],
]);

function exactById(input) {
  const seen = new Set();
  return input.filter((record) => record?.id && !seen.has(record.id) && seen.add(record.id));
}

function slugFromId(id) {
  return String(id || "").replace(/^(?:item|equipment):/, "");
}

function normalized(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function regionsOf(record) {
  return [...new Set((record?.unlock?.regions || []).filter(Boolean))].sort();
}

function stripTier(value) {
  return String(value || "")
    .replace(/\s*\((?:tier\s*)?\d+\)\s*/gi, " ")
    .replace(/\b(?:tier|t)\s*\d+\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const slotPhrases = [
  "robe bottom", "robe bottoms", "robe top", "platebody", "chestplate", "hauberk", "cuirass",
  "robe legs", "platelegs", "leggings", "legguards", "greaves", "bottoms", "chaps", "body",
  "hood", "helmet", "helm", "mask", "cowl", "coif", "crown", "gauntlets", "vambraces",
  "hand wraps", "hand wrap", "wrist wraps", "gloves", "boots", "foot wraps", "foot wrap",
];

function armourFamilyLabel(name) {
  let value = stripTier(name)
    .replace(/^(?:superior|elite)\s+/i, "")
    .replace(/^(?:robe top|robe bottom|mask|gloves|boots|crown|hood|helmet|helm|coif|cowl)\s+of\s+/i, "")
    .replace(/^(?:the\s+)/i, "")
    .trim();

  for (const phrase of slotPhrases) {
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    value = value.replace(new RegExp(`\\b${escaped}\\b`, "ig"), " ");
  }

  value = value
    .replace(/\bof\s+the\b/gi, " ")
    .replace(/\bof\b$/i, " ")
    .replace(/\s+/g, " ")
    .trim();

  return value || stripTier(name);
}

function stableObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function sourceKey(source) {
  return [source?.source || "", source?.title || "", source?.url || ""].join("|");
}

function chooseRepresentative(members) {
  return [...members].sort((a, b) => {
    const iconA = iconSlugs.has(slugFromId(a.id)) ? 0 : 1;
    const iconB = iconSlugs.has(slugFromId(b.id)) ? 0 : 1;
    const slotA = SLOT_PRIORITY.get(a.slot) ?? 99;
    const slotB = SLOT_PRIORITY.get(b.slot) ?? 99;
    return iconA - iconB || (Number(b.tier) || -1) - (Number(a.tier) || -1) || slotA - slotB || String(a.name).localeCompare(String(b.name));
  })[0];
}

function groupName(members, kind) {
  if (kind !== "set") return chooseRepresentative(members).name;
  const counts = new Map();
  for (const member of members) {
    const label = armourFamilyLabel(member.name);
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  const family = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0]?.[0];
  return `${family || titleCase(members[0]?.setId || "Equipment")} set`;
}

function mergeGroup(members, kind) {
  const representative = chooseRepresentative(members);
  const regions = [...new Set(members.flatMap(regionsOf))].sort();
  const slots = [...new Set(members.map((member) => member.slot).filter(Boolean))];
  const sources = new Map();
  for (const source of members.flatMap((member) => member.sources || [])) {
    const key = sourceKey(source);
    if (key !== "||") sources.set(key, source);
  }
  const iconMember = members.find((member) => iconSlugs.has(slugFromId(member.id))) || representative;
  const tiers = [...new Set(members.map((member) => Number(member.tier)).filter(Number.isFinite))].sort((a, b) => a - b);

  return {
    id: kind === "item" ? representative.id : `showcase:${kind}:${slugFromId(representative.id)}`,
    name: groupName(members, kind),
    kind,
    iconId: iconMember.id,
    style: representative.style || null,
    tier: tiers.at(-1) ?? null,
    tierRange: tiers.length > 1 ? [tiers[0], tiers.at(-1)] : null,
    slots,
    regions,
    memberCount: members.length,
    memberIds: members.map((member) => member.id),
    members: members.map(({ id, name, slot, tier }) => ({ id, name, slot: slot || null, tier: tier ?? null })),
    displayDescription: representative.displayDescription || null,
    unlock: {
      type: representative?.unlock?.type || null,
      requirement: representative?.unlock?.requirement || null,
      regions,
    },
    bonuses: stableObject(representative.bonuses || {}),
    sources: [...sources.values()],
  };
}

const showcasable = records.filter((record) => record.slot || iconSlugs.has(slugFromId(record.id)));
const omittedNoIcon = [];
const armourBuckets = new Map();
const pending = [];

for (const record of showcasable) {
  if (!ARMOUR_SLOTS.has(record.slot)) {
    pending.push(record);
    continue;
  }
  const family = normalized(record.setId || armourFamilyLabel(record.name));
  const regionKey = regionsOf(record).join("+");
  const key = `armour:${family}:${record.style || ""}:${regionKey}`;
  if (!armourBuckets.has(key)) armourBuckets.set(key, []);
  armourBuckets.get(key).push(record);
}

const output = [];
for (const members of armourBuckets.values()) {
  const distinctSlots = new Set(members.map((member) => member.slot));
  const distinctTiers = new Set(members.map((member) => member.tier).filter((tier) => tier != null));
  if (members.length > 1 && (distinctSlots.size > 1 || distinctTiers.size > 1)) output.push(mergeGroup(members, "set"));
  else pending.push(...members);
}

const variantBuckets = new Map();
for (const record of pending) {
  const baseName = normalized(stripTier(record.name).replace(/^(?:superior|elite)\s+/i, ""));
  const effect = JSON.stringify({
    baseName,
    style: record.style || "",
    slot: record.slot || "",
    regions: regionsOf(record),
    description: normalized(record.displayDescription),
    bonuses: stableObject(record.bonuses || {}),
  });
  if (!variantBuckets.has(effect)) variantBuckets.set(effect, []);
  variantBuckets.get(effect).push(record);
}

for (const members of variantBuckets.values()) {
  const withIcon = members.filter((member) => iconSlugs.has(slugFromId(member.id)));
  if (!withIcon.length) {
    omittedNoIcon.push(...members.map(({ id, name }) => ({ id, name })));
    continue;
  }
  output.push(mergeGroup(withIcon, withIcon.length > 1 ? "variants" : "item"));
}

output.sort((a, b) => (Number(b.tier) || -1) - (Number(a.tier) || -1) || a.name.localeCompare(b.name));

const result = {
  generatedAt: new Date().toISOString().slice(0, 10),
  sourceLastSynced: equipment.lastSynced || equipment.snapshotDate || null,
  sourceRecordCount: records.length,
  showcasableRecordCount: showcasable.length,
  showcaseCount: output.length,
  collapsedCount: Math.max(0, showcasable.length - output.length),
  omittedNoIcon,
  records: output,
};

fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ outPath, ...Object.fromEntries(Object.entries(result).filter(([key]) => key !== "records" && key !== "omittedNoIcon")), omittedNoIcon: omittedNoIcon.length }, null, 2));
