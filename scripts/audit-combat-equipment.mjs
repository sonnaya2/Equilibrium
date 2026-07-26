/**
 * Read-only audit of data/combat/equipment.json — style×slot matrix and
 * wearable (has slot) vs unlock-only / material (no slot) split.
 *
 * Usage: node scripts/audit-combat-equipment.mjs
 */

import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(ROOT, "data/combat/equipment.json");
const data = JSON.parse(await readFile(path, "utf8"));
const records = data.records ?? [];

const STYLES = ["melee", "ranged", "magic", "necromancy", "hybrid", "(none)"];
const SLOTS = [
  "mainhand", "offhand", "twohand",
  "helmet", "body", "legs", "gloves", "boots",
  "cape", "amulet", "ring", "pocket", "ammo", "aura",
  "(none)",
];

const matrix = Object.fromEntries(STYLES.map((s) => [s, Object.fromEntries(SLOTS.map((sl) => [sl, 0]))]));
let wearables = 0;
let unlocks = 0;
const noStyle = [];
const noSlotWearableSuspect = [];

for (const r of records) {
  const style = r.style ?? "(none)";
  const slot = r.slot ?? "(none)";
  if (!matrix[style]) matrix[style] = Object.fromEntries(SLOTS.map((sl) => [sl, 0]));
  if (matrix[style][slot] == null) matrix[style][slot] = 0;
  matrix[style][slot] += 1;

  if (r.slot) {
    wearables += 1;
  } else {
    unlocks += 1;
    // Materials / unlock tokens often lack slot on purpose
    noSlotWearableSuspect.push(r.id);
  }
  if (!r.style) noStyle.push(r.id);
}

const pad = (s, n) => String(s).padStart(n);
const padEnd = (s, n) => String(s).padEnd(n);

console.log("COMBAT EQUIPMENT AUDIT");
console.log(`file: ${path}`);
console.log(`lastSynced: ${data.lastSynced ?? "?"}  trackedSince: ${data.trackedSince ?? "?"}`);
console.log(`records: ${records.length}`);
console.log(`  wearables (has slot): ${wearables}`);
console.log(`  unlocks / materials (no slot): ${unlocks}`);
console.log(`  missing style: ${noStyle.length}`);
console.log("");

// Compact matrix — only columns that have any count
const usedSlots = SLOTS.filter((sl) => STYLES.some((s) => (matrix[s]?.[sl] ?? 0) > 0) ||
  Object.keys(matrix).some((s) => (matrix[s]?.[sl] ?? 0) > 0));
const usedStyles = [...new Set([...STYLES, ...Object.keys(matrix)])].filter((s) =>
  usedSlots.some((sl) => (matrix[s]?.[sl] ?? 0) > 0),
);

const colW = 8;
console.log("style × slot matrix");
console.log(padEnd("style", 12) + usedSlots.map((s) => pad(s.slice(0, colW), colW)).join(" ") + pad("total", 8));
for (const style of usedStyles) {
  let total = 0;
  const cells = usedSlots.map((slot) => {
    const n = matrix[style]?.[slot] ?? 0;
    total += n;
    return pad(n || "-", colW);
  });
  console.log(padEnd(style, 12) + cells.join(" ") + pad(total, 8));
}

// Style totals
console.log("");
console.log("by style:");
for (const style of usedStyles) {
  const total = usedSlots.reduce((a, sl) => a + (matrix[style]?.[sl] ?? 0), 0);
  const withSlot = usedSlots.filter((s) => s !== "(none)").reduce((a, sl) => a + (matrix[style]?.[sl] ?? 0), 0);
  const noSlot = matrix[style]?.["(none)"] ?? 0;
  console.log(`  ${padEnd(style, 12)} total=${total}  wearables=${withSlot}  unlocks=${noSlot}`);
}

console.log("");
console.log("sample no-slot records (first 15):");
for (const id of noSlotWearableSuspect.slice(0, 15)) console.log(`  ${id}`);
if (noSlotWearableSuspect.length > 15) console.log(`  ... +${noSlotWearableSuspect.length - 15} more`);
