import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wikiArchaeologyCollection } from "./lib/archaeology-collection.mjs";

const ROOT = process.cwd();
const data = JSON.parse(
  readFileSync(join(ROOT, "scraped-data/planner-expansions-archaeology-production.json"), "utf8"),
);

function normalize(value) {
  return String(value ?? "").replace(/[_\s]+/g, " ").trim().toLowerCase();
}

function assertContains(haystack, needle, context) {
  if (!normalize(haystack).includes(normalize(needle))) {
    throw new Error(`${context} no longer contains expected text: ${needle}`);
  }
}

const expectations = [
  { title: "Blingy Fings", level: 69, reward: "20 robust glass" },
  { title: "Smoky Fings", level: 81, reward: "40 robust glass", first: "Oo'glog Wellspring" },
  { title: "Hitty Fings", level: 89, reward: "40 robust glass" },
  { title: "Showy Fings", level: 92, reward: "40 robust glass" },
];

for (const expectation of expectations) {
  const wiki = await wikiArchaeologyCollection(expectation.title);
  if (wiki.archlevel !== expectation.level) {
    throw new Error(`${expectation.title} level drift: expected ${expectation.level}, Wiki has ${wiki.archlevel}`);
  }
  assertContains(wiki.collector, "Chief Tess", `${expectation.title}:collector`);
  assertContains(wiki.reward, expectation.reward, `${expectation.title}:reward`);
  if (expectation.first) assertContains(wiki.first, expectation.first, `${expectation.title}:first`);

  const row = data.production_collection_routes.find((entry) => entry.collection === expectation.title);
  if (!row) throw new Error(`Missing serialized production collection: ${expectation.title}`);
  if (row.archaeology_level !== expectation.level) {
    throw new Error(`${expectation.title} serialized level drift`);
  }
  assertContains(row.repeat_reward, expectation.reward, `${expectation.title}:serialized reward`);
  if (row.planner_classification !== "optional_archaeology_production_loop") {
    throw new Error(`${expectation.title} must remain an optional Archaeology production loop`);
  }
}

if (!data.alternate_supply_guard?.rule?.toLowerCase().includes("do not infer a hard region requirement")) {
  throw new Error("Robust-glass alternate-supply hard-gate guard is missing");
}

console.log(`Archaeology production audit passed: ${expectations.length} Chief Tess robust-glass collections`);
