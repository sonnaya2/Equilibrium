/**
 * Tracked-entity sync for the canonical combat store.
 *
 * The record datasets (data/combat/{abilities,equipment,prayers,perks,effects}.json) are
 * built by scripts/sync-combat-records.mjs from the curated corpus. This script maintains
 * the tracked-entity ledger (data/combat/update-index.json) and checks every entity's
 * RuneScape Wiki page for revisions newer than the record's verifiedAt — surfacing drift
 * loudly instead of serving stale numbers silently. It never scrapes values into records:
 * tooltip text is not a formula, and re-verification is a deliberate act.
 *
 * Report format:
 *   COMBAT SYNC
 *   Abilities checked: N   Items checked: N   Changed since dataset: N   New entities: N   Warnings: N
 *
 * Exit 1 when any tracked entity's Wiki page was revised after its record was verified.
 * Run: npm run sync:combat
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { wikiApi } from "./lib/runescape-wiki.mjs";

const ROOT = process.cwd();
const TODAY = new Date().toISOString().slice(0, 10);
const TRACKED_SINCE = "2024-03-04";
const KIND_BY_DATASET = {
  abilities: "ability",
  equipment: "equipment",
  prayers: "prayer",
  perks: "perk",
  effects: "effect",
} as const;

type TrackedKind = (typeof KIND_BY_DATASET)[keyof typeof KIND_BY_DATASET];

interface LedgerEntry {
  entityId: string;
  kind: TrackedKind | "backlog";
  wikiPage?: string;
  lastRevid: number | null;
  lastVerifiedAt: string | null;
}

interface TrackedEntity extends LedgerEntry {
  recordVerifiedAt: string;
}

const readJson = async (path: string) => JSON.parse(await readFile(join(ROOT, path), "utf8"));

function wikiPageOf(url: string): string | undefined {
  const match = /^https:\/\/runescape\.wiki\/w\/([^#?]+)/.exec(url);
  return match ? decodeURIComponent(match[1]).replaceAll("_", " ") : undefined;
}

/** Poll current revid + timestamp for a batch of page titles (no content fetched). */
async function pollRevisions(titles: string[]): Promise<Map<string, { revid: number; timestamp: string }>> {
  const result = new Map<string, { revid: number; timestamp: string }>();
  for (let offset = 0; offset < titles.length; offset += 40) {
    const batch = titles.slice(offset, offset + 40);
    const data = await wikiApi({
      action: "query",
      prop: "revisions",
      rvprop: "ids|timestamp",
      titles: batch.join("|"),
    });
    for (const page of data?.query?.pages ?? []) {
      const revision = page.revisions?.[0];
      if (!page.title || page.missing || !revision) continue;
      result.set(page.title, { revid: revision.revid, timestamp: revision.timestamp });
    }
  }
  return result;
}

const entities: TrackedEntity[] = [];
const warnings: string[] = [];
for (const [datasetName, kind] of Object.entries(KIND_BY_DATASET)) {
  const dataset = await readJson(`data/combat/${datasetName}.json`);
  for (const record of dataset.records) {
    const wikiSource = record.sources.find((s: { source: string }) => s.source === "runescape-wiki");
    const page = wikiSource ? wikiPageOf(wikiSource.url) : undefined;
    const recordVerifiedAt = record.sources.reduce(
      (latest: string, s: { verifiedAt?: string }) => (s.verifiedAt && s.verifiedAt > latest ? s.verifiedAt : latest),
      "",
    );
    if (!page) {
      warnings.push(`${record.id}: no RuneScape Wiki source — outside revision tracking`);
      continue;
    }
    entities.push({ entityId: record.id, kind, wikiPage: page, lastRevid: null, lastVerifiedAt: null, recordVerifiedAt });
  }
}

const previous = await readJson("data/combat/update-index.json");
const previousById = new Map<string, LedgerEntry>(
  (previous.records ?? []).map((entry: LedgerEntry) => [entry.entityId, entry]),
);
const newEntities = entities.filter((entity) => !previousById.has(entity.entityId)).length;

const titles = [...new Set(entities.map((entity) => entity.wikiPage!))].sort();
const current = await pollRevisions(titles);

const stale: string[] = [];
const ledger: LedgerEntry[] = entities.map((entity) => {
  const seen = current.get(entity.wikiPage!);
  if (!seen) {
    warnings.push(`${entity.entityId}: Wiki page missing — ${entity.wikiPage}`);
    return { entityId: entity.entityId, kind: entity.kind, wikiPage: entity.wikiPage, lastRevid: null, lastVerifiedAt: entity.recordVerifiedAt || null };
  }
  if (seen.timestamp.slice(0, 10) > entity.recordVerifiedAt) {
    stale.push(`${entity.entityId}: ${entity.wikiPage} revised ${seen.timestamp.slice(0, 10)}, record verified ${entity.recordVerifiedAt}`);
  }
  return {
    entityId: entity.entityId,
    kind: entity.kind,
    wikiPage: entity.wikiPage,
    lastRevid: seen.revid,
    lastVerifiedAt: entity.recordVerifiedAt || null,
  };
});
ledger.sort((a, b) => a.entityId.localeCompare(b.entityId));

const checked = (kind: TrackedKind) => entities.filter((entity) => entity.kind === kind).length;
await writeFile(
  join(ROOT, "data/combat/update-index.json"),
  `${JSON.stringify({ lastSynced: TODAY, trackedSince: TRACKED_SINCE, records: ledger }, null, 2)}\n`,
);

console.log("COMBAT SYNC");
console.log(
  `Abilities checked: ${checked("ability")}   Items checked: ${checked("equipment")}   ` +
    `Changed since dataset: ${stale.length}   New entities: ${newEntities}   Warnings: ${warnings.length}`,
);
console.log(
  `also tracked: prayers ${checked("prayer")}, perks ${checked("perk")}, effects ${checked("effect")} — ledger ${ledger.length} entities, ${titles.length} pages polled`,
);
for (const line of stale) console.log(`  STALE: ${line}`);
for (const line of warnings) console.log(`  warning: ${line}`);
if (stale.length) {
  console.error("sync-combat-data: stale entities found — re-verify the records above and bump verifiedAt");
  process.exitCode = 1;
}
