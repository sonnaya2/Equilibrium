/**
 * Ensure every multi-region museum collection has comboLabel set.
 * Pattern: "Region combo (all required): a + b"
 *
 * Updates in place:
 *   data/research/planner-expansions-archaeology-museum-collections-matrix.json
 *   scraped-data/planner-expansions-archaeology-museum-collections-matrix.json
 *   scraped-data/museum-collections-region-combo-table-2026-07-26.json
 *
 * Or re-run: node scripts/merge-museum-collection-matrix.mjs
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const RESEARCH = "data/research/planner-expansions-archaeology-museum-collections-matrix.json";
const SCRAPED = "scraped-data/planner-expansions-archaeology-museum-collections-matrix.json";
const TABLE = "scraped-data/museum-collections-region-combo-table-2026-07-26.json";

const read = (rel) => JSON.parse(readFileSync(join(ROOT, rel), "utf8"));
const write = (rel, value) =>
  writeFileSync(join(ROOT, rel), `${JSON.stringify(value, null, 2)}\n`, "utf8");

function comboLabelFor(required) {
  const r = [...new Set((required || []).filter(Boolean))];
  if (r.length <= 1) return "";
  return `Region combo (all required): ${r.join(" + ")}`;
}

function fixRows(rows, pathLabel) {
  let fixed = 0;
  for (const row of rows) {
    const rr = row.required_regions || [];
    if (rr.length <= 1) continue;
    const expected = comboLabelFor(rr);
    if (!row.comboLabel || String(row.comboLabel).trim() === "") {
      row.comboLabel = expected;
      fixed++;
      console.log(`  [fix] ${pathLabel}: ${row.name || row.id} -> ${expected}`);
    }
  }
  return fixed;
}

function fixMatrix(rel) {
  if (!existsSync(join(ROOT, rel))) {
    console.log(`[--] skip missing ${rel}`);
    return 0;
  }
  const doc = read(rel);
  let fixed = 0;
  if (Array.isArray(doc.collections)) {
    fixed += fixRows(doc.collections, rel + "#collections");
  }
  if (Array.isArray(doc.multi_region_list)) {
    fixed += fixRows(doc.multi_region_list, rel + "#multi_region_list");
  }
  if (fixed > 0) write(rel, doc);
  console.log(`[OK] ${rel}: fixed ${fixed}`);
  return fixed;
}

function fixTable(rel) {
  if (!existsSync(join(ROOT, rel))) {
    console.log(`[--] skip missing ${rel}`);
    return 0;
  }
  const doc = read(rel);
  let fixed = 0;
  if (Array.isArray(doc.rows)) {
    fixed += fixRows(doc.rows, rel + "#rows");
  }
  if (fixed > 0) write(rel, doc);
  console.log(`[OK] ${rel}: fixed ${fixed}`);
  return fixed;
}

let total = 0;
total += fixMatrix(RESEARCH);
total += fixMatrix(SCRAPED);
total += fixTable(TABLE);

// Verify invariant on research copy
const research = read(RESEARCH);
const multi = (research.collections || []).filter((r) => (r.required_regions || []).length > 1);
const stillEmpty = multi.filter((r) => !r.comboLabel || String(r.comboLabel).trim() === "");
console.log("");
console.log("MUSEUM COMBO LABEL FIX");
console.log(`  multi-region rows: ${multi.length}`);
console.log(`  still empty:       ${stillEmpty.length}`);
console.log(`  total fixed:       ${total}`);
if (stillEmpty.length) {
  console.error("FAIL: multi-region rows still missing comboLabel:");
  for (const r of stillEmpty) console.error(` - ${r.name || r.id}`);
  process.exit(1);
}
process.exit(0);
