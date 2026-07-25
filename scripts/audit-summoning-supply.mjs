import { existsSync, readFileSync } from "node:fs";

const overlayPath = "scraped-data/progression-enrichment-summoning-supply-2026-07-25.json";
const overlay = JSON.parse(readFileSync(overlayPath, "utf8"));
const fail = (message) => { throw new Error(`Summoning supply audit: ${message}`); };
const byId = (rows, id) => (rows || []).find((row) => row?.id === id);

const rows = [
  ...(overlay.activity_additions || []),
  ...(overlay.equipment_additions || []),
  ...(overlay.consumable_additions || []),
];
const ids = new Set();
for (const row of rows) {
  if (!row.id || ids.has(row.id)) fail(`duplicate or missing id: ${row.id}`);
  ids.add(row.id);
  const urls = row.source_urls || (row.source_url ? [row.source_url] : []);
  if (!urls.length) fail(`${row.id}: missing source URLs`);
  for (const url of urls) {
    try { new URL(url); } catch { fail(`${row.id}: invalid URL ${url}`); }
  }
}

const familiarisation = byId(overlay.activity_additions, "familiarisation:triple-charm-throughput");
if (!familiarisation || familiarisation.reward_duration_minutes !== 40 || !familiarisation.effect.includes("Triples")) {
  fail("Familiarisation duration/effect drifted");
}
for (const exception of ["Elder charms", "Talon beast charms", "Bork's guaranteed charm drops", "Ork legion charm drops"]) {
  if (!familiarisation.exceptions?.includes(exception)) fail(`Familiarisation exception missing: ${exception}`);
}
if (!familiarisation.interaction_order?.includes("before")) fail("Familiarisation/charming-potion ordering guard missing");

const amlodd = byId(overlay.activity_additions, "amlodd:summoning-conversion-efficiency");
if (!amlodd || amlodd.region_hint !== "tirannwn") fail("Amlodd region hint drifted");
if (amlodd.pouch_and_scroll_xp_multiplier !== 1.2 || amlodd.scroll_output_multiplier !== 1.2) fail("Amlodd 20% modifiers drifted");
if (!amlodd.base_access?.includes("Plague's End") || !amlodd.base_access?.includes("Prifddinas")) fail("Amlodd access chain incomplete");
const exampleText = JSON.stringify(amlodd.examples || []);
if (!exampleText.includes("10 scrolls produces 12") || !exampleText.includes("20 scrolls produces 24")) fail("Amlodd scroll examples drifted");

const tools = byId(overlay.equipment_additions, "summoning:charm-conservation-tools");
const toolMap = new Map((tools?.records || []).map((row) => [row.name, row]));
if (JSON.stringify(toolMap.get("Spirit gems")?.save_chance_percent_range) !== JSON.stringify([10, 60])) fail("Spirit gem save range drifted");
if (toolMap.get("Modified shaman's headdress")?.save_chance_percent !== 5) fail("Modified shaman's headdress chance drifted");
if (toolMap.get("Summoning cape")?.save_chance_percent !== 2 || toolMap.get("Summoning cape")?.summoning_level !== 99) fail("Summoning cape charm-save effect drifted");

const potion = byId(overlay.consumable_additions, "potion:charming");
if (!potion || potion.herblore_level !== 102 || potion.duration_minutes !== 6) fail("Charming potion level/duration drifted");
if (!potion.effect.includes("base number") || !potion.effect.includes("1")) fail("Charming potion effect drifted");
const ingredients = Object.fromEntries((potion.ingredients || []).map((row) => [row.item, row.quantity]));
for (const charm of ["Gold charm", "Green charm", "Crimson charm", "Blue charm"]) {
  if (ingredients[charm] !== 4) fail(`Charming potion ingredient drifted: ${charm}`);
}
if (ingredients["Primal extract"] !== 1 || ingredients["Spark chitin"] !== 1) fail("Charming potion secondary ingredients drifted");

const prose = JSON.stringify(overlay).toLowerCase();
for (const phrase of ["unlock the power", "game changer", "seamlessly", "robust solution", "comprehensive solution", "delve into", "revolutionize", "cutting edge", "elevate your", "supercharge your"]) {
  if (prose.includes(phrase)) fail(`clanker phrase: ${phrase}`);
}
if (/grand exchange|\"price\"|gp\/h|coins per hour/.test(prose)) fail("live-price or profit data leaked into Summoning supply overlay");
if (/charms per hour|charm drop rate|kills per hour/.test(prose)) fail("unsourced monster throughput leaked into Summoning supply overlay");

const canonicalPath = "data/reference/progression-unlocks.json";
if (existsSync(canonicalPath)) {
  const canonical = JSON.parse(readFileSync(canonicalPath, "utf8"));
  const canonicalIds = new Set([
    ...(canonical.activity_unlocks || []).map((row) => row.id),
    ...(canonical.equipment_models || []).map((row) => row.id),
    ...(canonical.consumable_unlocks || []).map((row) => row.id),
  ]);
  const present = [...ids].filter((id) => canonicalIds.has(id));
  if (present.length > 0 && present.length !== ids.size) fail(`canonical supply overlay is only partially composed: ${present.length}/${ids.size}`);
}

console.log(`Summoning supply audit passed — ${rows.length} sourced modifier groups`);
