import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("scraped-data/masterwork-staff-chain.json", "utf8"));
const errors = [];

function fail(message) {
  errors.push(message);
}

function pressure(component) {
  const row = data.region_pressure?.find((entry) => entry.component === component);
  if (!row) fail(`missing region-pressure row: ${component}`);
  return row;
}

function collectUrls(value, path = "root", out = []) {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectUrls(entry, `${path}[${index}]`, out));
    return out;
  }
  if (!value || typeof value !== "object") return out;
  for (const [key, entry] of Object.entries(value)) {
    if ((key.endsWith("_url") || key.endsWith("_urls")) && entry) {
      const values = Array.isArray(entry) ? entry : [entry];
      for (const url of values) out.push({ path: `${path}.${key}`, url });
    } else {
      collectUrls(entry, `${path}.${key}`, out);
    }
  }
  return out;
}

if (data.id !== "masterwork-staff") fail("id must remain masterwork-staff");
if (data.tier !== 100) fail("Masterwork staff must remain tier 100");
if (data.crafting_requirement !== "110 Runecrafting") fail("crafting requirement drifted from 110 Runecrafting");

for (const component of ["Binding essence", "Melodic essence", "Crystalline essence"]) {
  const row = pressure(component);
  if (row?.quantity !== 4) fail(`${component} set quantity must remain 4`);
  if (row?.yield_each !== 2) fail(`${component} weapon breakdown yield must remain 2`);
}

const logs = pressure("Eternal magic logs");
if (logs?.quantity !== 40) fail("self-made two-grip path must use 40 eternal magic logs");
if (logs?.hard_region_requirement !== false) fail("eternal magic logs must not become a hard region lock");
const logHints = new Set((logs?.source_routes || []).map((route) => route.region_hint));
for (const region of ["kandarin", "havenhythe"]) {
  if (!logHints.has(region)) fail(`eternal magic logs are missing ${region} source-route context`);
}

const bricks = pressure("Volatile runic bricks");
if (bricks?.quantity !== 3) fail("current full-chain cross-check expects three volatile runic bricks");
if (bricks?.hard_region_requirement !== false) fail("volatile bricks must not become a hard Anachronia/altar lock");
if (!String(bricks?.confidence || "").includes("cross_check")) {
  fail("three-brick total must retain its weaker cross-check confidence label");
}
if (bricks?.per_brick_inputs?.pure_essence_fragments !== 1000) fail("each volatile brick needs 1000 pure essence fragments");
if (bricks?.per_brick_inputs?.runes_each !== 1000) fail("each volatile brick needs 1000 of each listed rune");
const expectedRunes = ["Air", "Mind", "Water", "Earth", "Fire", "Body", "Cosmic", "Chaos", "Astral", "Nature", "Law", "Death", "Blood", "Soul", "Time"];
const actualRunes = bricks?.per_brick_inputs?.runes || [];
if (actualRunes.length !== expectedRunes.length || expectedRunes.some((rune) => !actualRunes.includes(rune))) {
  fail("volatile brick rune list drifted from the 15-rune recipe");
}

const synapse = pressure("Abyssal runic synapse");
const synapseNote = String(synapse?.current_acquisition_note || "").toLowerCase();
if (!synapseNote.includes("10,000")) fail("synapse current-acquisition note must retain the 10,000 essence threshold");
if (!synapseNote.includes("supersedes")) fail("synapse note must state that the fixed threshold supersedes the earlier RNG model");
if (synapse?.hard_region_requirement !== true || synapse?.working_region !== "forinthry") {
  fail("Abyss self-source route must remain a Forinthry working gate");
}

const hardRegions = new Set(
  (data.region_pressure || [])
    .filter((row) => row.hard_region_requirement === true)
    .map((row) => row.working_region),
);
for (const region of ["kandarin", "havenhythe", "anachronia"]) {
  if (hardRegions.has(region)) fail(`${region} must remain conditional pressure, not a hard staff lock`);
}

for (const { path, url } of collectUrls(data)) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") fail(`${path} must use https: ${url}`);
  } catch {
    fail(`${path} has an invalid URL: ${url}`);
  }
}

if (errors.length) {
  console.error("MASTERWORK STAFF AUDIT FAILED");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Masterwork staff audit passed: ${data.region_pressure.length} pressure rows, ${hardRegions.size} working hard-region gates.`);
}
