import { readFileSync } from "node:fs";
import { join } from "node:path";
import { wikiApi } from "./lib/runescape-wiki.mjs";

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

async function liveRareMaterialFamilies() {
  // The Materials page builds its Rare materials table via <dpl>, so the
  // families no longer appear as wikilinks in the page source; read the
  // underlying category instead.
  const result = new Set();
  let cmcontinue;
  do {
    const data = await wikiApi({
      action: "query",
      list: "categorymembers",
      cmtitle: "Category:Rare materials",
      cmlimit: 500,
      cmnamespace: 0,
      ...(cmcontinue ? { cmcontinue } : {}),
    });
    for (const member of data?.query?.categorymembers ?? []) {
      const title = String(member?.title ?? "");
      if (!/(?: components| parts)(?: \(blueprint\))?$/i.test(title)) continue;
      result.add(normalizeMaterial(title));
    }
    cmcontinue = data?.continue?.cmcontinue;
  } while (cmcontinue);
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

const liveRare = await liveRareMaterialFamilies();

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
  `Live RuneScape Wiki rare-material coverage: ${liveRare.size}/${liveRare.size} (Category:Rare materials)`,
);
