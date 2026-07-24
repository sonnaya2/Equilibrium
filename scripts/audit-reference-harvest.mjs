import { readFileSync } from "node:fs";

const harvest = JSON.parse(readFileSync("scraped-data/reference-site-harvest.json", "utf8"));
const records = Array.isArray(harvest.records) ? harvest.records : [];
const errors = [];

const normalize = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

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

function fail(message) {
  errors.push(message);
}

function validHttps(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

if (harvest.schemaVersion !== 1) fail("schemaVersion must be 1");
if (!harvest.policy?.noCopy) fail("policy.noCopy is required");
if (!harvest.policy?.bossGuides) fail("policy.bossGuides is required");
if (!records.length) fail("records must not be empty");

const seenIds = new Set();
const seenConcepts = new Map();

for (const [index, record] of records.entries()) {
  const where = `records[${index}]`;
  for (const field of ["id", "kind", "summary", "leagueUse", "status"]) {
    if (!record[field]) fail(`${where} missing ${field}`);
  }

  if (record.id) {
    if (seenIds.has(record.id)) fail(`${where} duplicate id ${record.id}`);
    seenIds.add(record.id);
  }

  const conceptKey = `${normalize(record.kind)}::${normalize(record.summary)}`;
  if (seenConcepts.has(conceptKey)) {
    fail(`${where} duplicates concept from ${seenConcepts.get(conceptKey)}`);
  } else {
    seenConcepts.set(conceptKey, record.id || where);
  }

  const prose = normalize(`${record.summary} ${record.leagueUse}`);
  for (const phrase of bannedCopy) {
    if (prose.includes(normalize(phrase))) fail(`${where} contains clanker phrase: ${phrase}`);
  }

  if (!Array.isArray(record.sources) || !record.sources.length) {
    fail(`${where} needs at least one source`);
    continue;
  }

  const sourceKinds = new Set();
  for (const [sourceIndex, source] of record.sources.entries()) {
    const sourceWhere = `${where}.sources[${sourceIndex}]`;
    if (!source?.source) fail(`${sourceWhere} missing source`);
    if (!source?.title) fail(`${sourceWhere} missing title`);
    if (!validHttps(source?.url)) fail(`${sourceWhere} needs an https URL`);
    if (source?.source) sourceKinds.add(source.source);
  }

  if (
    sourceKinds.size === 1 &&
    sourceKinds.has("pvme") &&
    String(record.status).startsWith("verified")
  ) {
    fail(`${where} cannot mark a PvME-only discovery as verified`);
  }
}

if (errors.length) {
  console.error("REFERENCE HARVEST AUDIT FAILED");
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Reference harvest audit passed: ${records.length} unique research records.`);
}
