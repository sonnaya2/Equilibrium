import { existsSync, readFileSync } from "node:fs";

const overlayPath = "scraped-data/progression-enrichment-summoning-havenhythe-2026-07-25.json";
const overlay = JSON.parse(readFileSync(overlayPath, "utf8"));
const fail = (message) => { throw new Error(`Havenhythe Summoning audit: ${message}`); };
const byId = (id) => (overlay.activity_additions || []).find((row) => row?.id === id);

const ids = new Set();
for (const row of overlay.activity_additions || []) {
  if (!row.id || ids.has(row.id)) fail(`duplicate or missing id: ${row.id}`);
  ids.add(row.id);
  if (!Array.isArray(row.source_urls) || row.source_urls.length === 0) fail(`${row.id}: missing source URLs`);
  for (const url of row.source_urls) {
    try { new URL(url); } catch { fail(`${row.id}: invalid URL ${url}`); }
  }
}

const obelisks = byId("havenhythe:empowered-summoning-obelisks");
if (!obelisks || obelisks.region_hint !== "havenhythe" || obelisks.location !== "Shrine of Inanna") fail("Havenhythe obelisk locality drifted");
const connection = obelisks.spirit_plane_connection;
if (connection?.maximum_percent !== 100 || connection?.maximum_summoning_xp_bonus_percent !== 50 || connection?.maximum_material_save_chance_percent !== 10) fail("Spirit Plane Connection caps drifted");
if (!connection?.gain?.includes("1%") || !connection?.loss?.some((row) => row.includes("20 seconds"))) fail("Spirit Plane Connection gain/decay rules drifted");
if (obelisks.spirit_communion?.protected_pouch_infusions !== 100) fail("Spirit Communion pouch count drifted");
if (!obelisks.spirit_communion?.trigger?.includes("100 spirit shards")) fail("Spirit Communion shard offering drifted");
if (!obelisks.spirit_communion?.effect?.includes("4 ticks to 3 ticks")) fail("Spirit Communion speed effect drifted");
const achievementNames = new Set((obelisks.achievements || []).map((row) => row.name));
for (const name of ["Dialed In", "Getting Familiar"]) if (!achievementNames.has(name)) fail(`missing Havenhythe achievement: ${name}`);

const jackalope = byId("havenhythe:jackalope-familiar");
if (!jackalope || jackalope.region_hint !== "havenhythe" || jackalope.summoning_level !== 30) fail("Jackalope level/region drifted");
if (jackalope.duration_minutes !== 16 || jackalope.inventory_slots !== 30 || jackalope.inventory_restriction !== "Archaeology soil only") fail("Jackalope duration or soil-only burden state drifted");
if (!jackalope.passive?.includes("33%")) fail("Jackalope screening chance drifted");
const jackRecipe = Object.fromEntries((jackalope.pouch_recipe || []).map((row) => [row.item, row.quantity]));
for (const [item, quantity] of [["Gold charm", 1], ["Spirit shards", 10], ["Pouch", 1], ["Jackalope antlers", 1]]) {
  if (jackRecipe[item] !== quantity) fail(`Jackalope pouch recipe drifted: ${item}`);
}
if (jackalope.special_move?.special_move_points !== 12 || jackalope.special_move?.special_move_points_with_spirit_cape !== 9) fail("Dig for Soil point cost drifted");
if (!jackalope.special_move?.effect?.includes("10%") || jackalope.special_move?.maximum_stacked_duration_minutes !== 5) fail("Dig for Soil effect drifted");
if (jackalope.scroll_conversion?.normal_output !== 10 || jackalope.scroll_conversion?.amlodd_voice_of_seren_output !== 12) fail("Jackalope scroll conversion drifted");

const scarab = byId("hets-oasis:holy-scarab-familiar");
if (!scarab || scarab.region_hint !== "desert" || scarab.location !== "Het's Oasis") fail("Holy scarab was moved out of the Desert");
if (scarab.summoning_level !== 80 || scarab.duration_minutes !== 64 || scarab.prayer_drain_reduction_percent !== 50) fail("Holy scarab core values drifted");
const scarabRecipe = Object.fromEntries((scarab.pouch_recipe || []).map((row) => [row.item, row.quantity]));
for (const [item, quantity] of [
  ["Green charm", 1],
  ["Spirit shards", 154],
  ["Pouch", 1],
  ["Plain whirligig shell", 1],
  ["Gliding whirligig shell", 1],
  ["Swift whirligig shell", 1],
  ["Hasty whirligig shell", 1],
  ["Speedy whirligig shell", 1],
]) if (scarabRecipe[item] !== quantity) fail(`Holy scarab recipe drifted: ${item}`);
if (scarab.special_move?.name !== "Bone Conjure" || !scarab.special_move?.effect?.includes("random bone")) fail("Holy scarab special move drifted");

if (JSON.stringify(scarab).toLowerCase().includes("havenhythe")) fail("Holy scarab was incorrectly conflated with Havenhythe");
if (JSON.stringify(obelisks).toLowerCase().includes("holy scarab")) fail("Havenhythe obelisk record contains unrelated Holy scarab data");

const prose = JSON.stringify(overlay).toLowerCase();
for (const phrase of ["unlock the power", "game changer", "seamlessly", "robust solution", "comprehensive solution", "delve into", "revolutionize", "cutting edge", "elevate your", "supercharge your"]) {
  if (prose.includes(phrase)) fail(`clanker phrase: ${phrase}`);
}
if (/grand exchange|\"price\"|gp\/h|coins per hour/.test(prose)) fail("live-price or profit data leaked into Havenhythe Summoning overlay");

const canonicalPath = "data/reference/progression-unlocks.json";
if (existsSync(canonicalPath)) {
  const canonical = JSON.parse(readFileSync(canonicalPath, "utf8"));
  const canonicalIds = new Set((canonical.activity_unlocks || []).map((row) => row.id));
  const present = [...ids].filter((id) => canonicalIds.has(id));
  if (present.length > 0 && present.length !== ids.size) fail(`canonical Havenhythe overlay is only partially composed: ${present.length}/${ids.size}`);
}

console.log(`Havenhythe Summoning audit passed — ${ids.size} distinct sourced systems`);
