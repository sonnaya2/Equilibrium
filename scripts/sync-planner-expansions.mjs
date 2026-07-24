import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const inputPath = join(ROOT, "scraped-data/planner-expansions.json");
const auditPath = join(ROOT, "scraped-data/planner-expansions-audit-2026-07-24.json");
const enrichmentPath = join(ROOT, "scraped-data/planner-enrichment-2026-07-24.json");
const outputPath = join(ROOT, "data/research/planner-expansions.json");
const data = JSON.parse(readFileSync(inputPath, "utf8"));

const requiredArrays = [
  "combat_training_spots",
  "runecrafting_altars",
  "invention_progression",
  "invention_component_sources",
  "archaeology_progression",
  "archaeology_combat_relics",
  "regional_unique_drops",
];

for (const key of requiredArrays) {
  if (!Array.isArray(data[key])) throw new Error(`planner-expansions.json is missing array: ${key}`);
}

if (existsSync(auditPath)) {
  const audit = JSON.parse(readFileSync(auditPath, "utf8"));

  for (const patch of audit.confidence_patches ?? []) {
    if (patch.match?.section !== "combat_training_spots") continue;
    const sourceUrl = patch.match.source_url;
    const confidence = patch.set?.confidence;
    if (typeof sourceUrl !== "string" || typeof confidence !== "string") continue;

    const matched = data.combat_training_spots.filter((row) => row.source_url === sourceUrl);
    if (!matched.length) throw new Error(`Planner audit confidence patch matched no combat rows: ${sourceUrl}`);
    for (const row of matched) row.confidence = confidence;
  }

  for (const addition of audit.additions?.combat_training_spots ?? []) {
    if (typeof addition.id !== "string" || !addition.id) throw new Error("Planner audit combat addition is missing id");
    if (!data.combat_training_spots.some((row) => row.id === addition.id)) data.combat_training_spots.push(addition);
  }

  for (const correction of audit.archaeology_relic_audit ?? []) {
    if (correction.target_field !== "archaeology_level") continue;
    const row = data.archaeology_combat_relics.find((entry) => entry.relic === correction.relic);
    if (!row) throw new Error(`Planner audit relic not found: ${correction.relic}`);
    row.archaeology_level = correction.recommended_value;
  }

  if (typeof audit.snapshot_date === "string" && audit.snapshot_date > data.snapshot_date) data.snapshot_date = audit.snapshot_date;
}

if (existsSync(enrichmentPath)) {
  const enrichment = JSON.parse(readFileSync(enrichmentPath, "utf8"));

  for (const patch of enrichment.archaeology_relic_patches ?? []) {
    const row = data.archaeology_combat_relics.find((entry) => entry.relic === patch.relic);
    if (!row) throw new Error(`Planner enrichment relic not found: ${patch.relic}`);
    for (const [key, value] of Object.entries(patch.set_if_missing ?? {})) {
      if (row[key] == null || row[key] === "PvM permanent unlock tracked by PvME") row[key] = value;
    }
  }

  for (const addition of enrichment.archaeology_relic_additions ?? []) {
    if (!data.archaeology_combat_relics.some((row) => row.relic === addition.relic)) data.archaeology_combat_relics.push(addition);
  }

  if (!data.archaeology_relic_system && enrichment.archaeology_relic_system) {
    data.archaeology_relic_system = enrichment.archaeology_relic_system;
  }

  if (typeof enrichment.snapshot_date === "string" && enrichment.snapshot_date > data.snapshot_date) data.snapshot_date = enrichment.snapshot_date;
}

function validateSources(rows, section) {
  for (const [index, row] of rows.entries()) {
    if (typeof row.source_url !== "string" || !row.source_url.startsWith("https://")) {
      throw new Error(`${section}[${index}] is missing a valid source_url`);
    }
  }
}

for (const key of requiredArrays) validateSources(data[key], key);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);

const counts = Object.fromEntries(requiredArrays.map((key) => [key, data[key].length]));
console.log("Synced planner expansions:", counts);
