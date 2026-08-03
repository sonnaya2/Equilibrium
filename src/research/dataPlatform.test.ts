import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { REGION_IDS } from "@/league";
import { researchRowMatchesRegion } from "@/components/ResearchSection";
import { getResearchCatalog } from "./catalog";
import { UNLOCK_SECTIONS, getRegionalPanel, getUnlockPanel } from "./panels";

const root = process.cwd();
const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(root, path), "utf8")) as T;

// Every document named by a `#shard/…` import, plus the two loaded by path
// rather than through the alias. The export ships exactly this set.
function shardImportedDocuments(): string[] {
  const walk = (directory: string, out: string[] = []): string[] => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) walk(path, out);
      else if (/\.tsx?$/.test(entry.name)) out.push(path);
    }
    return out;
  };
  const found = new Set(["data/map/region-seeds.json", "data/map/wiki-league-regions.json"]);
  for (const file of [...walk(join(root, "app")), ...walk(join(root, "src"))]) {
    for (const match of readFileSync(file, "utf8").matchAll(/#shard\/([a-zA-Z0-9/_.-]+\.json)/g)) {
      found.add(`data/${match[1]}`);
    }
  }
  return [...found];
}
const digest = (path: string) =>
  createHash("sha256")
    .update(readFileSync(join(root, path)))
    .digest("hex");

// Documents nothing imports are not exported, so the arrays behind them are
// read back out of the database in their original order.
function sourceArrays<T>(file: string): Record<string, T[]> {
  const database = new DatabaseSync(join(root, ".cache/equilibrium.sqlite"), { readOnly: true });
  try {
    const sections: Record<string, T[]> = {};
    for (const { record_path, raw_json } of database
      .prepare(
        "SELECT record_path, raw_json FROM source_records WHERE source_file = ? ORDER BY record_path",
      )
      .all(file) as unknown as Array<{ record_path: string; raw_json: string }>) {
      const match = record_path.match(/^\$\.([^.[\]]+)\[(\d+)\]$/);
      if (!match) continue;
      (sections[match[1]] ??= [])[Number(match[2])] = JSON.parse(raw_json) as T;
    }
    return sections;
  } finally {
    database.close();
  }
}

// A source row whose entity was retired as a duplicate is the record the
// survivor already shows, so the panels drop it. The expectation has to drop it
// too, or this test would be asserting the duplicate back into the export.
function retiredEntityIds(): Set<string> {
  const database = new DatabaseSync(join(root, ".cache/equilibrium.sqlite"), { readOnly: true });
  try {
    return new Set(
      (
        database
          .prepare("SELECT id FROM entities WHERE status = 'removed'")
          .all() as unknown as Array<{ id: string }>
      ).map(({ id }) => id),
    );
  } finally {
    database.close();
  }
}
const RETIRED = retiredEntityIds();
const live = <T extends Record<string, unknown>>(rows: T[]): T[] =>
  rows.filter((row) => !(typeof row.id === "string" && RETIRED.has(row.id)));

interface Artifact {
  href: string;
  sha256: string;
  bytes: number;
}

interface Manifest {
  schemaVersion: number;
  exportVersion: number;
  recordCount: number;
  documents: Record<string, Artifact>;
  regions: Array<{ id: string; name: string; availability: string; training: number }>;
}

describe("generated data platform", () => {
  // Build bookkeeping, not a payload. It lives under reports/ because nothing in
  // the browser ever asked for it.
  const manifest = readJson<Manifest>("reports/data-export-manifest.json");

  it("summarises every region without addressing a file", () => {
    expect(manifest.schemaVersion).toBe(5);
    expect(manifest.exportVersion).toBe(2);
    expect(Object.keys(manifest.regions)).toHaveLength(REGION_IDS.length);
  });

  // Research payloads are not under public/data - route handlers read SQLite.
  it("publishes no generated data at all", () => {
    expect(existsSync(join(root, "public/data"))).toBe(false);
  });

  // Documents are build inputs for `#shard/*`, not browser payloads: content-
  // addressed under .generated/, never served from public/.
  it("content-addresses every source document, outside public/", () => {
    const entries = Object.entries(manifest.documents);
    // Exactly the documents something still imports - not a magic floor, which
    // would turn every retired document into a red suite.
    expect(new Set(entries.map(([source]) => source))).toEqual(new Set(shardImportedDocuments()));
    for (const [source, artifact] of entries) {
      expect(source.startsWith("data/"), source).toBe(true);
      const repoPath = `.generated/documents/${source.slice("data/".length)}`;
      expect(existsSync(join(root, repoPath)), repoPath).toBe(true);
      expect(statSync(join(root, repoPath)).size, repoPath).toBe(artifact.bytes);
      expect(digest(repoPath), repoPath).toBe(artifact.sha256);
    }
    expect(existsSync(join(root, "public/data/v2/documents"))).toBe(false);
  });

  it("exports source documents without a materialized compatibility tree", () => {
    expect(existsSync(join(root, ".cache/data"))).toBe(false);
    expect(manifest.documents["data/research/catalog.json"]).toBeUndefined();
    expect(existsSync(join(root, ".generated/documents/research/catalog.json"))).toBe(false);
    const database = new DatabaseSync(join(root, ".cache/equilibrium.sqlite"), { readOnly: true });
    try {
      const stored = database
        .prepare(
          "SELECT raw_json FROM source_records WHERE source_file = 'data/combat/equipment.json' AND entity_id = 'item:seismic-wand'",
        )
        .get() as { raw_json: string };
      const cache = readJson<{ records: Array<{ id: string }> }>(
        ".generated/documents/combat/equipment.json",
      );
      expect(cache.records.find(({ id }) => id === "item:seismic-wand")).toEqual(
        JSON.parse(stored.raw_json),
      );
    } finally {
      database.close();
    }
  });

  it("builds every panel from SQLite, matching the normalized records", () => {
    type Row = Record<string, unknown>;
    const skilling = live(
      sourceArrays<Row>("data/research/regional-skilling-unlocks.json").records,
    );
    const combat = live(
      readJson<{ records: Row[] }>(".generated/documents/research/regional-combat-unlocks.json")
        .records,
    );
    const sections = (file: string) =>
      Object.fromEntries(
        Object.entries(sourceArrays<Row>(file)).map(([section, rows]) => [section, live(rows)]),
      );
    const progression = sections("data/reference/progression-unlocks.json");
    const supplements = [
      sections("data/reference/progression-support-items-2026-07-25.json"),
      sections("data/reference/progression-container-bags-2026-07-25.json"),
    ];
    const key = (row: Row, index: number, prefix: string) =>
      row.id != null && row.id !== ""
        ? String(row.id)
        : typeof row.name === "string" && row.name
          ? `${prefix}:${row.name}`
          : typeof row.quest === "string" && row.quest
            ? `${prefix}:${row.quest}`
            : `${prefix}:${index}`;

    for (const region of getResearchCatalog().regions) {
      const regional = getRegionalPanel(region) as unknown as Record<string, unknown>;
      expect(regional.skillingActivities).toEqual(
        skilling.filter(
          (row) => row.recordType === "activity" && researchRowMatchesRegion(row, region),
        ),
      );
      expect(regional.skillingEquipment).toEqual(
        skilling.filter(
          (row) => row.recordType === "equipment" && researchRowMatchesRegion(row, region),
        ),
      );
      expect(regional.combatAccounts).toEqual(
        combat.filter(
          (row) => row.recordType === "account" && researchRowMatchesRegion(row, region),
        ),
      );
      expect(regional.combatActivities).toEqual(
        combat.filter(
          (row) => row.recordType === "activity" && researchRowMatchesRegion(row, region),
        ),
      );
      expect(regional.combatEquipment).toEqual(
        combat.filter(
          (row) => row.recordType === "equipment" && researchRowMatchesRegion(row, region),
        ),
      );

      for (const section of UNLOCK_SECTIONS) {
        const rows = new Map<string, Row>();
        (progression[section] ?? []).forEach((row, index) =>
          rows.set(key(row, index, "base"), row),
        );
        if (section === "equipment_models") {
          supplements.forEach((document) =>
            (document[section] ?? []).forEach((row, index) =>
              rows.set(key(row, index, "supplement"), row),
            ),
          );
        }
        expect(getUnlockPanel(region, section), section).toEqual(
          [...rows.values()].filter((row) => researchRowMatchesRegion(row, region)),
        );
      }
    }
  });

  // The catalog reconstruction is gated by data:canonical:validate, which
  // digests readResearchCatalog against the canonical files. What is left to
  // check here is that every region survives into what the site serves.
  // Catalog row order is taxonomy ordinal; REGION_IDS is UI display order.
  it("serves every research region", () => {
    const parity = readJson<{ quarantinedRecords: number }>("reports/data-migration-parity.json");
    const regions = getResearchCatalog().regions;
    expect(regions.map(({ id }) => id).sort()).toEqual([...REGION_IDS].sort());
    for (const region of regions) {
      expect(region.name, region.id).toBeTruthy();
      expect(Array.isArray(region.training), region.id).toBe(true);
    }
    const quarantine = readJson<unknown[]>("reports/data-quarantine.json");
    expect(quarantine).toHaveLength(parity.quarantinedRecords);
  });
});
