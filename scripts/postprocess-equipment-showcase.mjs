import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const file = path.join(root, "data/combat/equipment-showcase.json");
const document = JSON.parse(fs.readFileSync(file, "utf8"));
const records = Array.isArray(document.records) ? document.records : [];

function representative(records, preferredId) {
  return records.find((record) => record.memberIds?.includes(preferredId) || record.id === preferredId) || records[0];
}

function mergeFamily(family, label, ids, tierRange) {
  const idSet = new Set(ids);
  const members = records.filter((record) => (record.memberIds || [record.id]).some((id) => idSet.has(id)));
  if (!members.length) return;
  const keep = representative(members, ids.at(-1));
  const allMembers = members.flatMap((record) => record.members || []);
  const allIds = [...new Set(members.flatMap((record) => record.memberIds || [record.id]))];
  const sources = new Map();
  for (const source of members.flatMap((record) => record.sources || [])) {
    const key = [source?.source || "", source?.title || "", source?.url || ""].join("|");
    if (key !== "||") sources.set(key, source);
  }
  const merged = {
    ...keep,
    id: `showcase:variants:${family}`,
    name: label,
    kind: "variants",
    iconId: ids.at(-1),
    tier: tierRange.at(-1),
    tierRange,
    memberCount: allIds.length,
    memberIds: allIds,
    members: allMembers,
    sources: [...sources.values()],
  };
  const remove = new Set(members);
  document.records = document.records.filter((record) => !remove.has(record));
  document.records.push(merged);
}

const apex = records.find((record) => record.name === "Apex hide set" || record.memberIds?.includes("item:apex-hide-body"));
if (apex) {
  apex.iconId = "item:apex-hide-body";
  apex.tierRange = [85, 90];
  apex.tier = 90;
  apex.displayDescription = "Apex hide ranged tank armour, crafted in Havenhythe and upgradeable from tier 85 to tier 90 (+5).";
}

mergeFamily("havensilver-greatsword", "Havensilver greatsword", [
  "item:havensilver-greatsword", "item:havensilver-greatsword-plus-1", "item:havensilver-greatsword-plus-2",
], [5, 60]);
mergeFamily("havensilver-longsword", "Havensilver longsword", [
  "item:havensilver-longsword", "item:havensilver-longsword-plus-1", "item:havensilver-longsword-plus-2",
], [5, 60]);
mergeFamily("havensilver-off-hand-longsword", "Havensilver off-hand longsword", [
  "item:havensilver-off-hand-longsword", "item:havensilver-off-hand-longsword-plus-1", "item:havensilver-off-hand-longsword-plus-2",
], [5, 60]);
mergeFamily("havensilver-bolts", "Havensilver bolts", [
  "item:havensilver-bolt", "item:havensilver-bolt-plus-1", "item:havensilver-bolt-plus-2",
], [5, 60]);

document.records.sort((a, b) => (Number(b.tier) || -1) - (Number(a.tier) || -1) || String(a.name).localeCompare(String(b.name)));
document.showcaseCount = document.records.length;
document.collapsedCount = Math.max(0, (document.showcasableRecordCount || document.sourceRecordCount || document.records.length) - document.records.length);
fs.writeFileSync(file, `${JSON.stringify(document, null, 2)}\n`);
console.log(JSON.stringify({ file, showcaseCount: document.showcaseCount, collapsedCount: document.collapsedCount, apexIcon: apex?.iconId || null }, null, 2));
