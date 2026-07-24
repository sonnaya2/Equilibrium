import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();

function read(path) {
  return JSON.parse(readFileSync(join(ROOT, path), "utf8"));
}

function canonicalize(value) {
  const serialized = JSON.stringify(value)
    .replaceAll("Asgarnia + Troll Country", "Asgarnia")
    .replaceAll("Troll Country", "Asgarnia");
  return JSON.parse(serialized);
}

function write(path, value) {
  const target = join(ROOT, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(canonicalize(value), null, 2)}\n`);
}

function mergeAddition(target, addition) {
  if (typeof addition?.id !== "string" || !addition.id) throw new Error("Progression enrichment addition is missing id");
  const index = target.findIndex((row) => row.id === addition.id);
  if (index < 0) target.push(addition);
  else target[index] = { ...addition, ...target[index] };
}

function applyEnrichment(progressionUnlocks, enrichment, sourceName) {
  progressionUnlocks.account_unlocks ||= [];
  progressionUnlocks.activity_unlocks ||= [];
  progressionUnlocks.equipment_models ||= [];
  progressionUnlocks.consumable_unlocks ||= [];

  const excluded = new Set(enrichment.policy?.activity_exclusions ?? []);
  progressionUnlocks.activity_unlocks = progressionUnlocks.activity_unlocks.filter((row) => !excluded.has(row.id));

  for (const patch of enrichment.activity_patches ?? []) {
    const row = progressionUnlocks.activity_unlocks.find((entry) => entry.id === patch.id);
    if (!row) throw new Error(`Progression enrichment patch target not found in ${sourceName}: ${patch.id}`);
    Object.assign(row, patch.set ?? {});
    if (Array.isArray(row.source_urls) && row.source_url) delete row.source_url;
  }

  for (const addition of enrichment.activity_additions ?? []) mergeAddition(progressionUnlocks.activity_unlocks, addition);
  for (const addition of enrichment.account_additions ?? []) mergeAddition(progressionUnlocks.account_unlocks, addition);
  for (const addition of enrichment.equipment_additions ?? []) mergeAddition(progressionUnlocks.equipment_models, addition);
  for (const addition of enrichment.consumable_additions ?? []) mergeAddition(progressionUnlocks.consumable_unlocks, addition);

  progressionUnlocks.snapshot_date = [progressionUnlocks.snapshot_date, enrichment.snapshot_date].filter(Boolean).sort().at(-1);
}

const combat = read("scraped-data/combat-2026.json");
const combatAbilityAudit = read("scraped-data/combat-ability-audit-2026-07-24.json");
const catalyst = read("scraped-data/catalyst.json");
const changes = read("scraped-data/2026-changes.json");
const rebalance = read("scraped-data/midgame-rebalance-2026-07-20.json");
const progressionUnlocks = read("scraped-data/progression-unlocks.json");
const regionDependencies = read("scraped-data/region-dependencies.json");
const referenceHarvest = read("scraped-data/reference-site-harvest.json");
const masterworkStaffChain = read("scraped-data/masterwork-staff-chain.json");
const unknowns = read("scraped-data/unknowns.json");

const progressionAuditPath = join(ROOT, "scraped-data/progression-unlocks-audit-2026-07-24.json");
if (existsSync(progressionAuditPath)) {
  const progressionAudit = JSON.parse(readFileSync(progressionAuditPath, "utf8"));
  const knownQuestIds = new Set(progressionUnlocks.quest_unlocks.map((row) => row.id));
  const knownActivityIds = new Set(progressionUnlocks.activity_unlocks.map((row) => row.id));

  for (const addition of progressionAudit.quest_unlock_additions ?? []) {
    if (typeof addition.id !== "string" || !addition.id) throw new Error("Progression quest unlock audit addition is missing id");
    if (!knownQuestIds.has(addition.id)) {
      progressionUnlocks.quest_unlocks.push(addition);
      knownQuestIds.add(addition.id);
    }
  }

  for (const addition of progressionAudit.activity_unlock_additions ?? []) {
    if (typeof addition.id !== "string" || !addition.id) throw new Error("Progression activity unlock audit addition is missing id");
    if (!knownActivityIds.has(addition.id)) {
      progressionUnlocks.activity_unlocks.push(addition);
      knownActivityIds.add(addition.id);
    }
  }
}

const enrichmentFiles = readdirSync(join(ROOT, "scraped-data"))
  .filter((name) => /^progression-enrichment-.*\.json$/.test(name))
  .sort();
for (const file of enrichmentFiles) {
  applyEnrichment(progressionUnlocks, read(`scraped-data/${file}`), file);
}

write("data/combat/modernisation-2026.json", combat);
write("data/combat/ability-audit-2026-07-24.json", combatAbilityAudit);
write("data/league/catalyst.json", catalyst);
write("data/league/region-dependencies.json", regionDependencies);
write("data/reference/changes-2026.json", changes);
write("data/reference/midgame-rebalance-2026-07-20.json", rebalance);
write("data/reference/progression-unlocks.json", progressionUnlocks);
write("data/research/reference-site-harvest.json", referenceHarvest);
write("data/research/masterwork-staff-chain.json", masterworkStaffChain);
write("data/reference/unknowns.json", unknowns);

console.log(`REFERENCE DATA SYNC\nCombat system data, audited ability records, Catalyst, region dependencies, 2026 changes, mid-game rebalance, permanent unlocks, ${enrichmentFiles.length} progression enrichment overlay(s), reference research, Masterwork staff chain and unknowns updated.`);
