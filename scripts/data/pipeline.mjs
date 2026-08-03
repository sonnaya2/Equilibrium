import { existsSync, rmSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { DATABASE, PATCHES, ROOT } from "./config.mjs";
import { cleanDatabase, migrate, openDatabase } from "./database.mjs";
import { exportData } from "./export.mjs";
import { importCanonical, rebuildSearch } from "./ingest.mjs";
import { applyAllPatches, applyPatch, writeChanged } from "./patching/apply.mjs";
import { validate } from "./validate.mjs";
import { slash } from "./utilities.mjs";

// Drop any leftover force-static region bodies under .next (pre-force-dynamic).
function clearStaleNextDataRoutes(log) {
  const targets = [
    join(ROOT, ".next/server/app/data"),
    join(ROOT, ".next/dev/server/app/data"),
  ];
  let cleared = 0;
  for (const dir of targets) {
    if (!existsSync(dir)) continue;
    rmSync(dir, { recursive: true, force: true });
    cleared += 1;
  }
  if (cleared && log) {
    console.warn("[data] cleared stale .next data route cache after rebuild");
  }
}

export function rebuild(log = true) {
  const start = process.hrtime.bigint();
  const before = process.resourceUsage();
  cleanDatabase();
  const db = openDatabase(DATABASE, false);
  try {
    const migrations = migrate(db);
    const ingest = importCanonical(db);
    const changed = applyAllPatches(db);
    rebuildSearch(db);
    const validation = validate(db);
    const exported = exportData(db);
    writeChanged(db, changed);
    clearStaleNextDataRoutes(log);
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
