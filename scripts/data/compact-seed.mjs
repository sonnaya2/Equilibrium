// Seed compaction: rewrite data/seed-v1.json.gz without the documents and
// record fields that nothing reads.
//
// This is the "separately verified compaction migration" AGENTS.md requires
// before the immutable seed may be replaced. Verification is the rebuild that
// follows it: entity counts, relations, research parity and every test have to
// come out unchanged, because everything removed here was already unreachable.
//
// Two things are removed:
//   1. Documents with no importer, no #shard import and no script reader.
//   2. Record keys that no line of src/, app/, scripts/ or e2e/ mentions and
//      that the normalizer never reads.
//
// Two things are deliberately kept:
//   - Provenance keys, read or not. AGENTS.md protects the attribution trail,
//     and an unread wiki revision id is still the evidence for a value.
//   - Every key the frontend touches, however obscure. `confidence` looks like
//     dead metadata and drives the /map confirmed/provisional badge.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { REPORTS, ROOT, SEED } from "./config.mjs";
import { CONSUMED_RECORD_KEYS } from "./canonical/schema.mjs";
import { atomicWrite, stableJson } from "./utilities.mjs";

// Proven unreachable by reports/research-orphans.json: no entity rows, no
// #shard import, no script reader.
export const ORPHANED_DOCUMENTS = [
  "data/combat/ability-audit-2026-07-24.json",
  "data/combat/ability-icons.json",
  "data/combat/equipment-icons.json",
  "data/league/equilibrium-auto-quests.json",
  "data/league/quest-region-review.json",
  "data/league/quest-region-rules.json",
  "data/research/equipment-region-index.json",
  // Imported only by ReferenceNotesResearch and RegionBoundariesResearch, two
  // panels no route ever rendered. Both produce no entity rows, so the seed is
  // their only home. reference-site-harvest.json was in the same position but
  // contributes 20 entities, so it stays in the seed and merely stops being
  // exported as a document.
  "data/reference/midgame-rebalance-2026-07-20.json",
  "data/league/region-dependencies.json",
];

// Kept whether or not anything reads them: this is the audit trail.
const PROVENANCE_KEY = /source|verified|retrieved|revision|provenance|citation|url|licen[cs]e|attribution|wiki/i;

const walk = (directory, out = []) => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(path)) out.push(path);
  }
  return out;
};

// One haystack of every line of product and tooling source. A key counts as
// live if it appears at all - as a property, a string literal or a bare word.
// Deliberately generous: a false "live" costs bytes, a false "dead" costs data.
function liveKeys() {
  const sources = ["src", "app", "scripts", "e2e"]
    .flatMap((directory) => walk(join(ROOT, directory)))
    // This module and the inventory name dead keys in order to report them.
    .filter((path) => !/compact-seed\.mjs|legacy-inventory\.mjs/.test(path));
  return sources.map((path) => readFileSync(path, "utf8")).join("\n");
}

// Only a record's own keys are schema; keys deeper than that can be data.
// `bonuses` is a record key, but its children are stat *names* - accuracy,
// armour, life_points - that become equipment_stats.stat values. Stripping by
// name at any depth would have deleted 1,042 equipment stats. So this mirrors
// ingest.mjs:collectArrayRecords exactly: an object inside an array is a
// record, and nothing else is.
const collectKeys = (value, out = new Map(), unsafe = new Set()) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        for (const [key, child] of Object.entries(item)) {
          out.set(key, (out.get(key) ?? 0) + 1);
          if (holdsRecords(child)) unsafe.add(key);
        }
        collectKeys(item, out, unsafe);
      }
    }
    return { out, unsafe };
  }
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) collectKeys(child, out, unsafe);
  }
  return { out, unsafe };
};

// A key nobody names can still *hold* records. `unlock_profiles` and
// `historical_removed_unlocks` are never mentioned in source, but the importer
// finds objects inside arrays at any depth, so those arrays are 19 entities.
// Dropping the key drops them. Only keys whose value is scalars all the way
// down may be removed.
const holdsRecords = (value) => {
  if (Array.isArray(value)) {
    return value.some((item) => (item && typeof item === "object") || holdsRecords(item));
  }
  if (value && typeof value === "object") return Object.values(value).some(holdsRecords);
  return false;
};

const strip = (value, dead, isRecord = false) => {
  if (Array.isArray(value)) return value.map((item) => strip(item, dead, true));
  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([key]) => !(isRecord && dead.has(key)));
    return Object.fromEntries(entries.map(([key, child]) => [key, strip(child, dead, false)]));
  }
  return value;
};

export function compactSeed({ dryRun = false } = {}) {
  const seed = JSON.parse(gunzipSync(readFileSync(SEED)));
  const before = { documents: seed.files.length, bytes: statSync(SEED).size };

  const missing = ORPHANED_DOCUMENTS.filter((path) => !seed.files.some((file) => file.path === path));
  const kept = seed.files.filter((file) => !ORPHANED_DOCUMENTS.includes(file.path));
  const removedDocuments = seed.files
    .filter((file) => ORPHANED_DOCUMENTS.includes(file.path))
    .map((file) => ({ path: file.path, bytes: Buffer.byteLength(stableJson(file.data)) }));

  const haystack = liveKeys();
  const { out: counts, unsafe } = collectKeys(kept.map((file) => file.data));
  const dead = new Map();
  for (const [key, occurrences] of counts) {
    if (CONSUMED_RECORD_KEYS.has(key)) continue;
    if (PROVENANCE_KEY.test(key)) continue;
    if (unsafe.has(key)) continue;
    const referenced =
      haystack.includes(`.${key}`) ||
      haystack.includes(`"${key}"`) ||
      haystack.includes(`'${key}'`) ||
      new RegExp(`\\b${key.replace(/[^\w]/g, "\\$&")}\\b`).test(haystack);
    if (!referenced) dead.set(key, occurrences);
  }

  const compacted = {
    ...seed,
    files: kept.map((file) => ({ ...file, data: strip(file.data, new Set(dead.keys())) })),
  };
  const body = gzipSync(Buffer.from(JSON.stringify(compacted)), { level: 9 });

  const report = {
    before,
    after: { documents: compacted.files.length, bytes: body.length },
    removedDocuments,
    removedDocumentBytes: removedDocuments.reduce((sum, entry) => sum + entry.bytes, 0),
    removedKeys: [...dead]
      .map(([key, occurrences]) => ({ key, occurrences }))
      .sort((a, b) => b.occurrences - a.occurrences || (a.key < b.key ? -1 : 1)),
    keptBecauseProvenance: [...counts.keys()].filter(
      (key) => PROVENANCE_KEY.test(key) && !CONSUMED_RECORD_KEYS.has(key),
    ).length,
    keptBecauseTheyHoldRecords: [...unsafe].sort(),
    missingOrphans: missing,
  };
  if (!dryRun) {
    writeFileSync(SEED, body);
    atomicWrite(join(REPORTS, "seed-compaction.json"), `${JSON.stringify(report, null, 2)}\n`);
  }
  return {
    documentsRemoved: removedDocuments.length,
    documentsRemaining: compacted.files.length,
    keysRemoved: dead.size,
    keyOccurrencesRemoved: [...dead.values()].reduce((sum, n) => sum + n, 0),
    seedBytesBefore: before.bytes,
    seedBytesAfter: body.length,
    keptBecauseProvenance: report.keptBecauseProvenance,
    keptBecauseTheyHoldRecords: report.keptBecauseTheyHoldRecords.length,
    missingOrphans: missing,
    dryRun,
  };
}
