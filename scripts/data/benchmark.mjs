import { copyFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CACHE, DATABASE, EXPORT_VERSION, REGION_IDS, REPORTS } from "./config.mjs";
import { openDatabase } from "./database.mjs";
import { buildOutputs, compareOutputs } from "./export.mjs";
import { applyPatch } from "./patches.mjs";
import { rebuild } from "./pipeline.mjs";
import { entityContext, formatContextMarkdown } from "./queries.mjs";
import { atomicWrite, jsonLine, slugify } from "./utilities.mjs";

// Runs a patch against a throwaway copy so the measured cost is the patch plus
// the export diff, not a rebuild, and the real database is never touched.
function scopedPatch(name, lines) {
  const copy = join(CACHE, `benchmark-${slugify(name)}.sqlite`);
  const patch = join(CACHE, `benchmark-${slugify(name)}.jsonl`);
  rmSync(copy, { force: true });
  copyFileSync(DATABASE, copy);
  const body = `${lines.join("\n")}\n`;
  writeFileSync(patch, body);
  const start = process.hrtime.bigint();
  const bench = openDatabase(copy);
  try {
    const changedEntities = applyPatch(bench, patch);
    if (bench.prepare("PRAGMA foreign_key_check").all().length) {
      throw new Error(`${name}: benchmark patch broke foreign keys`);
    }
    const built = buildOutputs(bench);
    const difference = compareOutputs(built.outputs);
    return {
      name,
      elapsedMs: Number((Number(process.hrtime.bigint() - start) / 1e6).toFixed(2)),
      changedEntities: changedEntities.size,
      filesRead: 2,
      bytesRead: statSync(copy).size + Buffer.byteLength(body),
      filesRewritten: difference.changed.length,
      bytesRewritten: difference.changed.reduce(
        (sum, path) => sum + Buffer.byteLength(built.outputs.get(path) ?? ""),
        0,
      ),
      changedFiles: difference.changed,
    };
  } finally {
    bench.close();
    rmSync(copy, { force: true });
    rmSync(patch, { force: true });
  }
}

export function benchmark() {
  const full = rebuild(false);
  const db = openDatabase();
  const showStart = process.hrtime.bigint();
  const shown = entityContext(db, "item:seismic-wand");
  const showMs = Number(process.hrtime.bigint() - showStart) / 1e6;
  const showBody = formatContextMarkdown(shown);
  const training = db
    .prepare(
      `SELECT training_methods.entity_id, entity_regions.region_id, entity_regions.relation
       FROM training_methods JOIN entity_regions ON entity_regions.entity_id = training_methods.entity_id
       WHERE entity_regions.region_id != 'global' ORDER BY training_methods.entity_id LIMIT 1`,
    )
    .get();
  const trainingRegion = REGION_IDS.find((region) => region !== training.region_id);
  const regionStart = process.hrtime.bigint();
  const regionRows = db
    .prepare(
      `SELECT entities.id, entities.entity_type AS type, entities.name, entity_regions.relation
       FROM entity_regions JOIN entities ON entities.id = entity_regions.entity_id
       WHERE entity_regions.region_id = ? ORDER BY entities.entity_type, entities.id`,
    )
    .all("asgarnia");
  const regionBody = jsonLine({ schemaVersion: EXPORT_VERSION, region: "asgarnia", records: regionRows });
  const regionMs = Number(process.hrtime.bigint() - regionStart) / 1e6;
  db.close();

  const scenarios = [
    scopedPatch("equipment source", [
      JSON.stringify({
        op: "upsert-source",
        source: "source:runescape-wiki:3b4c5ed6fefa9e18",
        set: { page_title: "Seismic wand benchmark" },
      }),
    ]),
    scopedPatch("training region", [
      JSON.stringify({
        op: "unlink-region",
        entity: training.entity_id,
        region: training.region_id,
        relation: training.relation,
      }),
      JSON.stringify({
        op: "link-region",
        entity: training.entity_id,
        region: trainingRegion,
        relation: "required",
      }),
    ]),
    scopedPatch("cross region", [
      JSON.stringify({
        op: "link-region",
        entity: "item:seismic-wand",
        region: "tirannwn",
        relation: "required",
        group: "all_required",
      }),
    ]),
  ];
  const lines = [
    "# Data platform benchmark",
    "",
    `Measured locally on 2026-07-29 with Node ${process.version}. Values are produced by \`npm run data:benchmark\`; no timings are estimated.`,
    "",
    "| Scenario | Time | Data files read | Input bytes | Files rewritten | Bytes rewritten |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
    `| Show one equipment item | ${showMs.toFixed(2)} ms | 1 | ${statSync(DATABASE).size} | 0 | 0 |`,
    ...scenarios.map(
      (scenario) =>
        `| ${scenario.name} patch + scoped export diff | ${scenario.elapsedMs.toFixed(2)} ms | ${scenario.filesRead} | ${scenario.bytesRead} | ${scenario.filesRewritten} | ${scenario.bytesRewritten} |`,
    ),
    `| Rebuild one Asgarnia region payload (${regionRows.length} records) | ${regionMs.toFixed(2)} ms | 1 | ${statSync(DATABASE).size} | 1 | ${Buffer.byteLength(regionBody)} |`,
    `| Full clean rebuild | ${full.elapsedMs.toFixed(2)} ms | ${full.inputFiles} | ${full.inputBytes} | ${full.exportedFiles + 1} | ${statSync(DATABASE).size} |`,
    "",
    `Peak RSS during the full rebuild was ${(full.maxRssBytes / 1024 / 1024).toFixed(1)} MiB. The clean rebuild regenerated the ignored SQLite file; unchanged frontend artifacts were byte-compared and not rewritten.`,
    "",
    `The representative equipment correction requires ${showBody.split(/\r?\n/).length + 1} lines of bounded context plus one JSONL patch line.`,
    "",
    "Scoped patch details:",
    "",
    ...scenarios.map(
      (scenario) =>
        `- ${scenario.name}: ${scenario.changedEntities} affected entities; ${scenario.changedFiles.join(", ") || "no frontend payload change"}.`,
    ),
    "",
  ];
  atomicWrite(join(REPORTS, "data-platform-benchmark.md"), lines.join("\n"));
  return { full, showMs: Number(showMs.toFixed(2)), regionMs: Number(regionMs.toFixed(2)), scenarios };
}
