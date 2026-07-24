import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
    if (typeof addition.id !== "string" || !addition.id) {
      throw new Error("Progression quest unlock audit addition is missing id");
    }
    if (!knownQuestIds.has(addition.id)) {
      progressionUnlocks.quest_unlocks.push(addition);
      knownQuestIds.add(addition.id);
    }
  }

  for (const addition of progressionAudit.activity_unlock_additions ?? []) {
    if (typeof addition.id !== "string" || !addition.id) {
      throw new Error("Progression activity unlock audit addition is missing id");
    }
    if (!knownActivityIds.has(addition.id)) {
      progressionUnlocks.activity_unlocks.push(addition);
      knownActivityIds.add(addition.id);
    }
  }
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

console.log("REFERENCE DATA SYNC\nCombat system data, audited ability records, Catalyst, region dependencies, 2026 changes, mid-game rebalance, permanent unlocks, reference research, Masterwork staff chain and unknowns updated.");
