import { extname, relative, resolve } from "node:path";
import { DATABASE, PATCHES, ROOT } from "./config.mjs";
import { cleanDatabase, migrate, openDatabase } from "./database.mjs";
import { exportData } from "./export.mjs";
import { importSeed, rebuildSearch } from "./ingest.mjs";
import { applyAllPatches, applyPatch, writeChanged } from "./patches.mjs";
import { validate } from "./validate.mjs";
import { slash } from "./utilities.mjs";

export function rebuild(log = true) {
  const start = process.hrtime.bigint();
  const before = process.resourceUsage();
  cleanDatabase();
  const db = openDatabase(DATABASE, false);
  try {
    const migrations = migrate(db);
    const ingest = importSeed(db);
    const changed = applyAllPatches(db);
    rebuildSearch(db);
    const validation = validate(db);
    const exported = exportData(db);
    writeChanged(db, changed);
    const usage = process.resourceUsage();
    const result = {
      migrations,
      inputFiles: ingest.files,
      inputBytes: ingest.bytes,
      entities: Object.values(validation.counts).reduce((sum, count) => sum + count, 0),
      changedPatchEntities: changed.size,
      exportedFiles: exported.written.length,
      elapsedMs: Number((Number(process.hrtime.bigint() - start) / 1e6).toFixed(1)),
      maxRssBytes: Math.max(before.maxRSS, usage.maxRSS) * 1024,
    };
    if (log) console.log(JSON.stringify(result, null, 2));
    return result;
  } finally {
    db.close();
  }
}

export function applyOne(pathArg) {
  const path = resolve(ROOT, pathArg);
  const patchRelative = relative(resolve(PATCHES), path);
  if (patchRelative.startsWith("..") || resolve(PATCHES, patchRelative) !== path || extname(path) !== ".jsonl") {
    throw new Error("Patch must be a .jsonl file inside data/patches/");
  }
  const db = openDatabase();
  try {
    const changed = applyPatch(db, path, false);
    rebuildSearch(db);
    writeChanged(db, changed);
    const validation = validate(db, true);
    const exported = exportData(db);
    return {
      patch: slash(relative(ROOT, path)),
      changed: [...changed].sort(),
      validation: validation.valid,
      written: exported.written,
    };
  } finally {
    db.close();
  }
}
