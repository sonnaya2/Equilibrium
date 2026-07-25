import { existsSync, readFileSync } from "node:fs";

const overlayPath = "scraped-data/progression-enrichment-summoning-2026-07-25.json";
const overlay = JSON.parse(readFileSync(overlayPath, "utf8"));
const fail = (message) => { throw new Error(`Summoning progression audit: ${message}`); };
const byId = (rows, id) => (rows || []).find((row) => row?.id === id);

const activities = overlay.activity_additions || [];
const accounts = overlay.account_additions || [];
const ids = new Set();
for (const row of [...activities, ...accounts]) {
  if (!row.id || ids.has(row.id)) fail(`duplicate or missing id: ${row.id}`);
  ids.add(row.id);
  const urls = row.source_urls || (row.source_url ? [row.source_url] : []);
  if (!urls.length) fail(`${row.id}: missing source URLs`);
  for (const url of urls) {
    try { new URL(url); } catch { fail(`${row.id}: invalid URL ${url}`); }
  }
}

const ancient = byId(activities, "archaeology:ancient-summoning-binding-contracts");
if (!ancient) fail("missing Ancient Summoning system");
if (!String(ancient.base_unlock?.requirement || "").includes("Dagon Bye")) fail("Dagon Bye gate missing");
const blank = Object.fromEntries((ancient.base_unlock?.blank_contract_recipe || []).map((row) => [row.item, row.quantity]));
for (const [item, quantity] of [["Blue charm", 1], ["Pouch", 1], ["Blood of Orcus", 2], ["Hellfire metal", 2], ["Spirit shards", 200]]) {
  if (blank[item] !== quantity) fail(`blank binding contract recipe drifted: ${item}`);
}
const ancientByName = new Map((ancient.key_combat_contracts || []).map((row) => [row.name, row]));
for (const [name, level] of [["Hellhound", 45], ["Blood reaver", 73], ["Kal'gerion demon", 90], ["Ripper demon", 96]]) {
  const row = ancientByName.get(name);
  if (!row || row.summoning_level !== level || row.slayer_level !== level) fail(`${name} binding requirements drifted`);
}
if (!ancientByName.get("Hellhound")?.passive?.includes("20%")) fail("Hellhound tank passive drifted");
if (!ancientByName.get("Kal'gerion demon")?.special_move?.includes("+5%")) fail("Kal'gerion critical buff drifted");
if (!ancientByName.get("Kal'gerion demon")?.special_move?.includes("60 seconds")) fail("Kal'gerion buff duration drifted");
if (!ancientByName.get("Ripper demon")?.special_move?.includes("200-320%")) fail("Ripper Demon scroll range drifted");
if ((ancientByName.get("Ripper demon")?.source_regions || []).length < 2) fail("Ripper Demon multi-region source pressure collapsed");

const nihil = byId(activities, "fate-of-the-gods:nihil-familiars");
if (!nihil || !nihil.base_requirements?.includes("Fate of the Gods") || !nihil.base_requirements?.includes("87 Summoning")) fail("Nihil base gate drifted");
const sharedNihil = Object.fromEntries((nihil.shared_recipe || []).map((row) => [row.item, row.quantity]));
if (sharedNihil["Elder charm"] !== 1 || sharedNihil["Elder energy"] !== 150 || sharedNihil.Pouch !== 1) fail("Nihil shared recipe drifted");
const nihilStyles = Object.fromEntries((nihil.variants || []).map((row) => [row.accuracy_style, row]));
for (const style of ["melee", "ranged", "magic", "necromancy"]) {
  if (nihilStyles[style]?.accuracy_bonus_percent !== 5) fail(`${style} nihil accuracy bonus drifted`);
}
if (nihil.region_status !== "unresolved_external_region") fail("Freneskae was incorrectly assigned to an elective region");

const milestones = byId(activities, "summoning:combat-and-burden-milestones");
if (!milestones) fail("missing standard familiar milestones");
const steel = (milestones.combat_milestones || []).find((row) => row.name === "Steel titan");
if (steel?.summoning_level !== 99) fail("Steel titan level drifted");
const steelRecipe = Object.fromEntries((steel?.recipe || []).map((row) => [row.item, row.quantity]));
if (steelRecipe["Crimson charm"] !== 1 || steelRecipe["Spirit shards"] !== 178 || steelRecipe["Steel ingot"] !== 1 || steelRecipe.Pouch !== 1) fail("Steel titan recipe drifted");
const burdens = new Map((milestones.burden_milestones || []).map((row) => [row.name, row]));
for (const [name, level, slots] of [["Spirit kalphite", 25, 6], ["Bull ant", 40, 9], ["Spirit terrorbird", 52, 12], ["War tortoise", 67, 18], ["Pack yak", 96, 30], ["Pack mammoth", 99, 32]]) {
  const row = burdens.get(name);
  if (!row || row.summoning_level !== level || row.inventory_slots !== slots) fail(`${name} burden milestone drifted`);
}
const yakRecipe = Object.fromEntries((burdens.get("Pack yak")?.recipe || []).map((row) => [row.item, row.quantity]));
if (yakRecipe["Crimson charm"] !== 1 || yakRecipe["Spirit shards"] !== 211 || yakRecipe["Yak-hide"] !== 1 || yakRecipe.Pouch !== 1) fail("Pack yak recipe drifted");
const mammothRecipe = Object.fromEntries((burdens.get("Pack mammoth")?.recipe || []).map((row) => [row.item, row.quantity]));
if (mammothRecipe["Crimson charm"] !== 1 || mammothRecipe["Spirit shards"] !== 222 || mammothRecipe["Mammoth tusk"] !== 1 || mammothRecipe.Pouch !== 1) fail("Pack mammoth recipe drifted");
if (burdens.get("Pack yak")?.source_region_hint !== "fremennik") fail("Pack yak regional ingredient pressure drifted");
if (burdens.get("Pack mammoth")?.source_region_hint !== "forinthry") fail("Pack mammoth regional ingredient pressure drifted");

const totem = byId(accounts, "anachronia:totem-of-summoning");
if (!totem || totem.duration_bonus_minutes !== 16 || totem.region_hint !== "anachronia") fail("Totem of Summoning drifted");
const related = new Map((totem.related_unlocks || []).map((row) => [row.id, row]));
if (!related.get("livid-farm:lunar-spells")?.interaction?.includes("20%")) fail("Spiritual Healing duration link drifted");
if (!related.get("dungeoneering:spirit-cape-passive")?.interaction?.includes("20%")) fail("Spirit Cape scroll-cost link drifted");

const banned = ["unlock the power", "game changer", "seamlessly", "robust solution", "comprehensive solution", "delve into", "revolutionize", "cutting edge", "elevate your", "supercharge your"];
const prose = JSON.stringify(overlay).toLowerCase();
for (const phrase of banned) if (prose.includes(phrase)) fail(`clanker phrase: ${phrase}`);
if (/grand exchange|\"price\"|gp\/h|coins per hour/.test(prose)) fail("live-price or profit data leaked into Summoning progression");

// Once normalized, the canonical graph must receive all overlay IDs together. Before the next
// normalization pass, absence is allowed; partial composition is not.
const canonicalPath = "data/reference/progression-unlocks.json";
if (existsSync(canonicalPath)) {
  const canonical = JSON.parse(readFileSync(canonicalPath, "utf8"));
  const canonicalIds = new Set([
    ...(canonical.activity_unlocks || []).map((row) => row.id),
    ...(canonical.account_unlocks || []).map((row) => row.id),
  ]);
  const present = [...ids].filter((id) => canonicalIds.has(id));
  if (present.length > 0 && present.length !== ids.size) fail(`canonical Summoning overlay is only partially composed: ${present.length}/${ids.size}`);
}

console.log(`Summoning progression audit passed — ${activities.length} activity groups + ${accounts.length} account row`);
