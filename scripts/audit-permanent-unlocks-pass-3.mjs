import fs from "node:fs";

const path = "scraped-data/permanent-unlocks-pass-3.json";
const doc = JSON.parse(fs.readFileSync(path, "utf8"));
const errors = [];
const bannedCopy = [
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

const checkUrls = (id, urls) => {
  if (!Array.isArray(urls) || urls.length === 0) errors.push(`${id}: missing source URLs`);
  for (const url of urls ?? []) {
    try {
      new URL(url);
    } catch {
      errors.push(`${id}: invalid URL ${url}`);
    }
  }
};

const necro = doc.necromancy;
if (!necro?.id) errors.push("missing Necromancy system id");
checkUrls(necro?.id ?? "necromancy", necro?.source_urls);

const expectedTiers = [
  [1, 1, 1],
  [2, 20, 50],
  [3, 40, 400],
  [4, 60, 2000],
  [5, 70, 4500],
  [6, 80, 8500],
  [7, 90, 35000],
];
const actualTiers = (necro?.tiers ?? []).map((row) => [row.tier, row.necromancy_level, row.souls]);
if (JSON.stringify(actualTiers) !== JSON.stringify(expectedTiers)) {
  errors.push(`Well of Souls tier thresholds drifted: ${JSON.stringify(actualTiers)}`);
}
if (necro?.talent_points?.maximum !== 21) errors.push("Necromancy talent-point maximum must be 21");
if (necro?.talent_points?.total_xp_for_all_21 !== 5_740_080) errors.push("Necromancy 21-point cumulative XP drifted");
if (!String(necro?.talent_points?.next_point_xp_formula ?? "").includes("2000")) errors.push("Necromancy talent-point formula missing");

const questGateMap = new Map((necro?.quest_gates ?? []).map((row) => [row.quest, row]));
for (const quest of ["Rune Mythos", "Tomes of the Warlock", "The Temple at Senntisten"]) {
  if (!questGateMap.has(quest)) errors.push(`missing Necromancy quest gate: ${quest}`);
}

const arch = doc.archaeology;
if (arch?.active_relic_limit !== 3) errors.push("Archaeology active-relic limit must remain 3");
if (JSON.stringify(arch?.monolith_energy_caps) !== JSON.stringify([150, 250, 400, 500, 650])) {
  errors.push("Archaeology monolith energy-cap ladder drifted");
}
checkUrls(arch?.id ?? "archaeology", arch?.source_urls);

const relics = arch?.relics ?? [];
const seen = new Set();
for (const relic of relics) {
  if (!relic.id || seen.has(relic.id)) errors.push(`duplicate/missing relic id: ${relic.id}`);
  seen.add(relic.id);
  if (!relic.name) errors.push(`${relic.id}: missing name`);
  if (!relic.effect) errors.push(`${relic.id}: missing effect`);
  if (!relic.region_status) errors.push(`${relic.id}: missing region_status`);
  checkUrls(relic.id ?? "relic", relic.source_urls);
  if (relic.monolith_energy !== null && relic.monolith_energy !== undefined) {
    if (!Number.isInteger(relic.monolith_energy) || relic.monolith_energy <= 0 || relic.monolith_energy > 650) {
      errors.push(`${relic.id}: invalid monolith energy ${relic.monolith_energy}`);
    }
  }
  const prose = JSON.stringify(relic).toLowerCase();
  for (const phrase of bannedCopy) if (prose.includes(phrase)) errors.push(`${relic.id}: clanker phrase ${phrase}`);
}

const byId = new Map(relics.map((row) => [row.id, row]));
for (const [id, level, energy] of [
  ["arch-relic:font-of-life", 5, 50],
  ["arch-relic:berserkers-fury", 56, 250],
  ["arch-relic:shadows-grace", 67, 50],
  ["arch-relic:blessing-of-het", 74, 100],
  ["arch-relic:death-ward", 81, 150],
  ["arch-relic:fury-of-the-small", 97, 150],
  ["arch-relic:persistent-rage", 98, 150],
  ["arch-relic:heightened-senses", 105, 350],
  ["arch-relic:conservation-of-energy", 118, 350],
]) {
  const row = byId.get(id);
  if (!row) {
    errors.push(`missing relic: ${id}`);
    continue;
  }
  if (row.archaeology_level !== level) errors.push(`${id}: expected Archaeology ${level}`);
  if (row.monolith_energy !== energy) errors.push(`${id}: expected ${energy} monolith energy`);
}

const wolf = byId.get("arch-relic:hungry-like-the-wolf");
if (!wolf) errors.push("missing current 2026 Hungry Like the Wolf relic");
if (wolf && wolf.monolith_energy !== null) errors.push("Hungry Like the Wolf energy must stay unknown until a current primary/Wiki source verifies it");
if (wolf && !String(wolf.verification_note ?? "").includes("Do not fill")) errors.push("Hungry Like the Wolf needs explicit unknown-value guardrail");

const deathWard = byId.get("arch-relic:death-ward");
if (!Array.isArray(deathWard?.region_pressure) || deathWard.region_pressure.length < 2) {
  errors.push("Death Ward must preserve its cross-region acquisition chain");
}
const fots = byId.get("arch-relic:fury-of-the-small");
if (fots?.region_status !== "needs_equilibrium_boundary_confirmation") {
  errors.push("Fury of the Small must not receive an invented Equilibrium region");
}

const whole = JSON.stringify(doc).toLowerCase();
for (const phrase of bannedCopy) if (whole.includes(phrase)) errors.push(`document clanker phrase ${phrase}`);
if (whole.includes('"league relic"') && whole.includes('"monolith_energy"')) {
  // This is intentionally broad only as a warning against accidentally serializing League relics into the archaeology list.
  // The prose can discuss the separation, but relic objects themselves must all use arch-relic IDs.
}
for (const relic of relics) {
  if (!String(relic.id).startsWith("arch-relic:")) errors.push(`${relic.id}: archaeology relic id namespace violation`);
}

if (errors.length) {
  console.error("PERMANENT UNLOCK PASS 3 AUDIT FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`PERMANENT UNLOCK PASS 3 AUDIT OK — ${relics.length} relics + ${necro.tiers.length} Necromancy tiers`);
}
