import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wikiSource } from "./lib/runescape-wiki.mjs";

const ROOT = process.cwd();
const read = (path) => JSON.parse(readFileSync(join(ROOT, path), "utf8"));

function normalizeMaterial(value) {
  return String(value ?? "")
    .replace(/\s*\(blueprint\)\s*$/i, "")
    .replace(/\s+(?:components?|parts?)\s*$/i, "")
    .replace(/\s+warpriest farm\s*$/i, "")
    .trim()
    .toLowerCase();
}

function addComponentField(set, value) {
  for (const part of String(value ?? "").split(/\s*\/\s*/)) {
    const normalized = normalizeMaterial(part);
    if (normalized) set.add(normalized);
  }
}

function extractSection(wikitext, heading) {
  const lines = wikitext.split(/\r?\n/);
  const wanted = heading.trim().toLowerCase();
  let start = -1;
  let level = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (!match) continue;
    if (match[2].trim().toLowerCase() !== wanted) continue;
    start = index + 1;
    level = match[1].length;
    break;
  }

  if (start < 0) throw new Error(`Could not locate Wiki section: ${heading}`);

  const section = [];
  for (let index = start; index < lines.length; index += 1) {
    const match = lines[index].match(/^(={2,6})\s*(.*?)\s*\1\s*$/);
    if (match && match[1].length <= level) break;
    section.push(lines[index]);
  }
  return section.join("\n");
}

function extractRareMaterialLinks(wikitext) {
  const section = extractSection(wikitext, "Rare materials");
  const result = new Set();
  const linkPattern = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g;

  for (const match of section.matchAll(linkPattern)) {
    const title = match[1].trim();
    if (!/(?: components| parts)(?: \(blueprint\))?$/i.test(title)) continue;
    result.add(normalizeMaterial(title));
  }
  return result;
}

const slayer = read("scraped-data/planner-expansions-slayer.json");
const archaeology = read("scraped-data/planner-expansions-invention-archaeology.json");
const invention2026 = read("scraped-data/planner-expansions-invention-2026.json");
const perks = read("scraped-data/planner-expansions-invention-perks.json");
const coverage = read("scraped-data/planner-expansions-invention-component-coverage.json");

const mapped = new Set();
for (const row of slayer.invention_component_chains) addComponentField(mapped, row.component);
for (const row of archaeology.rare_component_routes) addComponentField(mapped, row.component);
for (const row of invention2026.new_2026_component_routes) addComponentField(mapped, row.component);
for (const row of invention2026.account_component_routes) addComponentField(mapped, row.component);
for (const row of perks.component_supply_routes) addComponentField(mapped, row.component);
for (const row of perks.global_or_account_component_routes) addComponentField(mapped, row.component);
for (const row of coverage.remaining_component_routes) addComponentField(mapped, row.component);

const materialsPage = await wikiSource("Materials");
const liveRare = extractRareMaterialLinks(materialsPage.content);

if (liveRare.size < 25) {
  throw new Error(
    `RuneScape Wiki rare-material parse returned only ${liveRare.size} families; refusing to trust a likely broken parser`,
  );
}

const missing = [...liveRare].filter((name) => !mapped.has(name)).sort();
if (missing.length > 0) {
  throw new Error(`RuneScape Wiki has unmapped rare Invention materials: ${missing.join(", ")}`);
}

if (coverage.current_rare_component_family_count !== liveRare.size) {
  throw new Error(
    `Rare-material taxonomy drift: Wiki has ${liveRare.size}, coverage manifest says ${coverage.current_rare_component_family_count}`,
  );
}

if (coverage.coverage_after_this_file !== liveRare.size) {
  throw new Error(
    `Rare-material coverage count drift: Wiki has ${liveRare.size}, manifest claims ${coverage.coverage_after_this_file}`,
  );
}

console.log(
  `Live RuneScape Wiki rare-material coverage: ${liveRare.size}/${liveRare.size} (Materials revision ${materialsPage.revid}, ${materialsPage.timestamp})`,
);
