import fs from "node:fs";

const doc = JSON.parse(fs.readFileSync("scraped-data/permanent-unlocks-pass-5.json", "utf8"));
const errors = [];
const banned = [
  "unlock the power",
  "game changer",
  "seamlessly",
  "robust solution",
  "comprehensive solution",
  "delve into",
  "revolutionize",
  "cutting edge",
  "elevate your",
  "supercharge your",
];

const rows = [
  ...(doc.dungeoneering ?? []),
  ...(doc.anachronia_base_camp ?? []),
  ...(doc.region_achievement_passives ?? []),
  ...(doc.account_combat_infrastructure ?? []),
  ...(doc.farm_combat_perks?.records ?? []),
];
const ids = new Set();
for (const row of rows) {
  if (!row.id || ids.has(row.id)) errors.push(`duplicate/missing id: ${row.id}`);
  ids.add(row.id);
  const urls = row.source_urls ?? (row.source_url ? [row.source_url] : []);
  if (urls.length === 0) errors.push(`${row.id}: missing source URL`);
  for (const url of urls) {
    try { new URL(url); } catch { errors.push(`${row.id}: invalid URL ${url}`); }
  }
  const prose = JSON.stringify(row).toLowerCase();
  for (const phrase of banned) if (prose.includes(phrase)) errors.push(`${row.id}: clanker phrase ${phrase}`);
}

const spirit = (doc.dungeoneering ?? []).find((row) => row.id === "dungeoneering:spirit-cape-passive");
if (!spirit || spirit.token_cost !== 45_000 || !spirit.effect.includes("20%")) errors.push("Spirit cape current passive drifted");
if (spirit?.region_hint !== "forinthry") errors.push("Spirit cape must follow the hard Daemonheim/Forinthry dependency");

const slayer = (doc.anachronia_base_camp ?? []).find((row) => row.id === "anachronia:slayer-lodge");
const slayerTiers = (slayer?.tiers ?? []).map((row) => [row.tier, row.slayer_level, row.benefit]);
if (JSON.stringify(slayerTiers) !== JSON.stringify([
  [1, 40, "+1% damage on Anachronia"],
  [2, 70, "+3% damage on Anachronia"],
  [3, 90, "+6% damage on Anachronia plus Slayer helmet stand"],
])) errors.push("Anachronia Slayer Lodge tier ladder drifted");

const lodge = (doc.anachronia_base_camp ?? []).find((row) => row.id === "anachronia:player-lodge");
if (!lodge || lodge.tiers?.find((row) => row.tier === 3)?.construction_level !== 90) errors.push("Player Lodge T3 requirement drifted");
if (!String(lodge?.tier_3_passive ?? "").includes("skillcape")) errors.push("Player Lodge skillcape rack missing");

const farm = doc.farm_combat_perks;
if (!String(farm?.tier_1_account_rule ?? "").includes("22 January 2024")) errors.push("2024 breeding-log Tier 1 passive rule missing");
const farmById = new Map((farm?.records ?? []).map((row) => [row.id, row]));
for (const [id, t1, t2] of [
  ["farm-perk:nopenopenope", "2%", "3%"],
  ["farm-perk:king-of-beasts", "5%", "10%"],
  ["farm-perk:no-fear", "20%", "40%"],
  ["farm-perk:armoured-hide", "3 ticks", "6 ticks"],
]) {
  const row = farmById.get(id);
  if (!row) errors.push(`missing farm perk ${id}`);
  else {
    if (!row.tier_1.includes(t1)) errors.push(`${id}: Tier 1 drifted`);
    if (!row.tier_2.includes(t2)) errors.push(`${id}: Tier 2 drifted`);
  }
}

const achievements = new Map((doc.region_achievement_passives ?? []).map((row) => [row.id, row]));
const desert = achievements.get("achievements:desert-keris");
if (!desert?.effect?.includes("25%") || !desert.effect.includes("5%")) errors.push("Hard Desert Keris values drifted");
const frem = achievements.get("achievements:fremennik-combat");
const fremText = JSON.stringify(frem?.rewards ?? []);
if (!fremText.includes("10%") || !fremText.includes("5%")) errors.push("Elite Fremennik DKS bonuses drifted");
const seers = achievements.get("achievements:seers-combat");
if (!JSON.stringify(seers?.rewards ?? []).includes("+2 percentage points")) errors.push("Elite Seers bolt-proc bonus drifted");
const tir = achievements.get("achievements:tirannwn-combat");
if ((tir?.rewards ?? []).filter((row) => String(row.effect).includes("5%")).length < 4) errors.push("Tirannwn combat reward set incomplete");

const infra = new Map((doc.account_combat_infrastructure ?? []).map((row) => [row.id, row]));
const vitality = infra.get("anachronia:totem-of-vitality");
if (!vitality?.effect?.includes("25%") || !vitality.effect.includes("1,500")) errors.push("Totem of Vitality 2026 effect drifted");
const puzzle = infra.get("legacy-of-zamorak:infernal-puzzle-box");
if (puzzle?.region_status !== "unresolved_cross_boundary") errors.push("Infernal Puzzle Box must preserve ED4 boundary ambiguity");
const puzzleTiers = new Map((puzzle?.milestones ?? []).map((row) => [row.tier, row]));
if (!puzzleTiers.get(3)?.effect?.includes("Adrenaline")) errors.push("Infernal Puzzle Box T3 adrenaline passive missing");
if (!puzzleTiers.get(6)?.effect?.includes("tool belt")) errors.push("Infernal Puzzle Box T6 toolbelt milestone missing");
const reaper = infra.get("pvm:reaper-crew");
if (reaper?.effect?.life_points !== 200 || reaper?.effect?.prayer_bonus !== 2 || reaper?.effect?.armour !== 20) errors.push("Reaper Crew defensive bonuses drifted");
for (const style of ["melee_damage_bonus", "ranged_damage_bonus", "magic_damage_bonus", "necromancy_damage_bonus"]) {
  if (reaper?.effect?.[style] !== 12) errors.push(`Reaper Crew ${style} drifted`);
}

const whole = JSON.stringify(doc).toLowerCase();
for (const phrase of banned) if (whole.includes(phrase)) errors.push(`document clanker phrase ${phrase}`);

if (errors.length) {
  console.error("PERMANENT UNLOCK PASS 5 AUDIT FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`PERMANENT UNLOCK PASS 5 AUDIT OK — ${rows.length} sourced passive groups/rows`);
}
