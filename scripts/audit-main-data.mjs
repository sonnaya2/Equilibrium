import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const TODAY = "2026-07-25";
const failures = [];
const stats = {
  files: 0,
  jsonObjects: 0,
  arrays: 0,
  ids: 0,
  sourceUrls: 0,
  unresolvedRows: 0,
  unverifiedRows: 0,
};

const fail = (file, path, message) => failures.push(`${file}${path ? `:${path}` : ""} ${message}`);
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

function walk(directory) {
  if (!existsSync(directory)) return [];
  const results = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) results.push(...walk(full));
    else if (entry.endsWith(".json")) results.push(full);
  }
  return results;
}

function validateUrl(file, path, value) {
  if (typeof value !== "string") return;
  stats.sourceUrls += 1;
  if (!value.startsWith("https://")) fail(file, path, `source URL must use HTTPS: ${value}`);
  if (/localhost|example\.com|127\.0\.0\.1/i.test(value)) fail(file, path, `placeholder source URL is not allowed: ${value}`);
}

function inspect(file, value, path = "$", key = "") {
  if (Array.isArray(value)) {
    stats.arrays += 1;
    const ids = new Map();
    const tiers = new Map();
    for (let index = 0; index < value.length; index += 1) {
      const row = value[index];
      if (row && typeof row === "object" && !Array.isArray(row)) {
        if (typeof row.id === "string") {
          stats.ids += 1;
          if (ids.has(row.id)) fail(file, path, `duplicate id ${row.id} at indexes ${ids.get(row.id)} and ${index}`);
          ids.set(row.id, index);
        }
        if (Number.isInteger(row.tier)) {
          if (tiers.has(row.tier)) fail(file, path, `duplicate tier ${row.tier} at indexes ${tiers.get(row.tier)} and ${index}`);
          tiers.set(row.tier, index);
        }
      }
      inspect(file, row, `${path}[${index}]`);
    }
    return;
  }

  if (value && typeof value === "object") {
    stats.jsonObjects += 1;
    const statusText = [value.region_status, value.availability, value.status, value.confidence]
      .filter((entry) => typeof entry === "string")
      .join(" ")
      .toLowerCase();
    if (/unresolved|provisional|unknown/.test(statusText)) {
      stats.unresolvedRows += 1;
      if (value.verified === true) fail(file, path, "unresolved/provisional row cannot be verified true");
      if (value.hard_region_requirement === true) fail(file, path, "unresolved/provisional row cannot be a hard region requirement");
    }
    if (value.verified === false) stats.unverifiedRows += 1;
    if (value.revealed === false && value.verified === true) fail(file, path, "unrevealed row cannot be verified true");

    for (const [childKey, child] of Object.entries(value)) {
      const childPath = `${path}.${childKey}`;
      if (childKey === "url" || childKey === "source_url") validateUrl(file, childPath, child);
      if (childKey === "source_urls" && Array.isArray(child)) {
        child.forEach((url, index) => validateUrl(file, `${childPath}[${index}]`, url));
      }
      if ((childKey === "snapshot_date" || childKey === "lastSynced") && typeof child === "string") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(child)) fail(file, childPath, `invalid date format ${child}`);
        if (child > TODAY) fail(file, childPath, `date is in the future: ${child}`);
      }
      if (typeof child === "number" && /(?:quantity|cost|level|points|tokens|tier|count|maximum|minimum|duration|cooldown)/i.test(childKey) && child < 0) {
        fail(file, childPath, `negative progression quantity is not allowed: ${child}`);
      }
      inspect(file, child, childPath, childKey);
    }
    return;
  }

  if (typeof value === "string") {
    if (value.includes("Troll Country")) fail(file, path, "canonical naming violation: use Asgarnia");
    if (key === "id" && /troll[-_ ]country/i.test(value)) fail(file, path, "canonical region id must not use Troll Country");
  }
}

const jsonFiles = [...walk(join(ROOT, "data")), ...walk(join(ROOT, "scraped-data"))].sort();
for (const absolute of jsonFiles) {
  const file = relative(ROOT, absolute).replaceAll("\\", "/");
  try {
    const value = JSON.parse(readFileSync(absolute, "utf8"));
    stats.files += 1;
    inspect(file, value);
  } catch (error) {
    fail(file, "", `invalid JSON: ${error.message}`);
  }
}

function expectTiers(file, records, expected) {
  const actual = records.map((row) => row.tier);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(file, "$.records", `expected tiers ${expected.join(", ")}; found ${actual.join(", ")}`);
}

const relics = read("data/league/relics.json");
expectTiers("data/league/relics.json", relics.records ?? [], [1, 2, 3, 4, 5, 6, 7]);
for (const row of relics.records ?? []) {
  if (row.revealed === false && (row.choices ?? []).length !== 0) fail("data/league/relics.json", `$.records[tier=${row.tier}]`, "unrevealed relic tier must not contain choices");
}

const blessings = read("data/league/blessings.json");
expectTiers("data/league/blessings.json", blessings.records ?? [], [1, 2, 3, 4, 5, 6, 7, 8]);
if (JSON.stringify(blessings.paths) !== JSON.stringify(["Order", "Balance", "Chaos"])) fail("data/league/blessings.json", "$.paths", "Blessing paths drifted");
if (JSON.stringify(blessings.godTiers) !== JSON.stringify([4, 8])) fail("data/league/blessings.json", "$.godTiers", "God Tier positions drifted");
if (blessings.resetCount !== 3) fail("data/league/blessings.json", "$.resetCount", "Blessing reset count drifted");
for (const row of blessings.records ?? []) {
  if (row.godTier !== [4, 8].includes(row.tier)) fail("data/league/blessings.json", `$.records[tier=${row.tier}].godTier`, "God Tier flag is inconsistent");
  if (row.revealed === false && (row.choices ?? []).length !== 0) fail("data/league/blessings.json", `$.records[tier=${row.tier}]`, "unrevealed Blessing tier must not contain choices");
}

const tasks = read("data/league/tasks.json");
if (!Array.isArray(tasks.records)) fail("data/league/tasks.json", "$.records", "task records must be an array, including while unrevealed");

const progression = read("data/reference/progression-unlocks.json");
for (const section of ["quest_unlocks", "account_unlocks", "activity_unlocks", "equipment_models", "consumable_unlocks", "ability_unlocks", "prayer_unlocks"]) {
  const rows = progression[section];
  if (!Array.isArray(rows)) {
    fail("data/reference/progression-unlocks.json", `$.${section}`, "progression section must be an array");
    continue;
  }
  const ids = new Set();
  for (const row of rows) {
    if (typeof row.id !== "string" || row.id.length === 0) fail("data/reference/progression-unlocks.json", `$.${section}`, "progression row is missing a stable id");
    else if (ids.has(row.id)) fail("data/reference/progression-unlocks.json", `$.${section}`, `duplicate progression id ${row.id}`);
    else ids.add(row.id);
    const hasSource = typeof row.source_url === "string" || (Array.isArray(row.source_urls) && row.source_urls.length > 0) || Array.isArray(row.sources);
    if (!hasSource) fail("data/reference/progression-unlocks.json", `$.${section}.${row.id ?? "missing-id"}`, "progression row is missing provenance");
  }
}

const removedActiveNames = new Set(["Blood Tendrils", "Salt the Wound", "Greater Dazing Shot"]);
function scanActiveUnlocks(value, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanActiveUnlocks(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    const nextPath = `${path}.${entryKey}`;
    if (/historical|removed|warning|correction|note/i.test(entryKey)) continue;
    if ((entryKey === "name" || entryKey === "unlock" || entryKey === "unlocks") && typeof entryValue === "string" && removedActiveNames.has(entryValue)) {
      fail("data/reference/progression-unlocks.json", nextPath, `${entryValue} is removed and may only appear in historical/removal metadata`);
    }
    scanActiveUnlocks(entryValue, nextPath);
  }
}
scanActiveUnlocks(progression);

if (failures.length > 0) {
  console.error(`MAIN DATA AUDIT FAILED (${failures.length} issue${failures.length === 1 ? "" : "s"})`);
  for (const issue of failures) console.error(`- ${issue}`);
  process.exit(1);
}

console.log([
  "MAIN DATA AUDIT PASSED",
  `JSON files: ${stats.files}`,
  `Objects: ${stats.jsonObjects}`,
  `Arrays: ${stats.arrays}`,
  `Stable IDs inspected: ${stats.ids}`,
  `Source URLs inspected: ${stats.sourceUrls}`,
  `Unresolved/provisional rows preserved: ${stats.unresolvedRows}`,
  `Explicitly unverified rows preserved: ${stats.unverifiedRows}`,
].join("\n"));
