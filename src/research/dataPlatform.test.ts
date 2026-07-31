import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { REGION_IDS } from "@/league";
import { researchRowMatchesRegion } from "@/components/ResearchSection";
import { getResearchCatalog } from "./catalog";

const root = process.cwd();
const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(root, path), "utf8")) as T;
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

interface Artifact {
  href: string;
  sha256: string;
  bytes: number;
}

interface Shard extends Artifact {
  records: number;
}

interface RegionArtifacts extends Artifact {
  indexHref: string;
  indexSha256: string;
  indexBytes: number;
  panels: {
    regional: Shard;
    unlocks: Record<string, Shard>;
  };
}

interface Manifest {
  schemaVersion: number;
  exportVersion: number;
  recordCount: number;
  documents: Record<string, Artifact>;
  domains: Record<string, { records: number; shards: Shard[] }>;
  regions: Record<string, RegionArtifacts>;
  idIndexes: Array<Shard & { firstId: string; lastId: string }>;
}

describe("generated data platform", () => {
  const manifest = readJson<Manifest>("public/data/v2/manifest.json");

  it("keeps every frontend artifact bounded and content-addressed", () => {
    expect(manifest.schemaVersion).toBe(4);
    expect(manifest.exportVersion).toBe(2);
    const regionArtifacts: Artifact[] = Object.values(manifest.regions).flatMap((region) => [
      region,
      { href: region.indexHref, sha256: region.indexSha256, bytes: region.indexBytes },
      region.panels.regional,
      ...Object.values(region.panels.unlocks),
    ]);
    const artifacts: Artifact[] = [
      ...Object.values(manifest.domains).flatMap((domain) => domain.shards),
      ...manifest.idIndexes,
      ...regionArtifacts,
    ];
    for (const artifact of artifacts) {
      const path = artifact.href.replace(/^\//, "");
      expect(existsSync(join(root, "public", path.replace(/^data\//, "data/"))), path).toBe(true);
      const repoPath = `public/${path}`;
      expect(statSync(join(root, repoPath)).size, repoPath).toBe(artifact.bytes);
      expect(digest(repoPath), repoPath).toBe(artifact.sha256);
      expect(artifact.bytes, repoPath).toBeLessThan(500 * 1024);
    }
  });

  it("indexes every exported stable ID exactly once", () => {
    const ids = new Map<string, string>();
    for (const shard of manifest.idIndexes) {
      const index = readJson<{ ids: Record<string, string> }>(`public${shard.href}`);
      for (const [id, href] of Object.entries(index.ids)) {
        expect(ids.has(id), `duplicate exported ID ${id}`).toBe(false);
        ids.set(id, href);
      }
    }
    expect(ids.size).toBe(manifest.recordCount);
    for (const id of [
      "item:seismic-wand",
      "magic:sonic-wave",
      "prayer:clarity-of-thought",
      "perk:biting",
      "wiki:462",
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
  });

  // Documents are build inputs for `#shard/*`, not browser payloads, so they
  // are content-addressed but exempt from the shard size budget.
  it("content-addresses every exported source document", () => {
    const entries = Object.entries(manifest.documents);
    expect(entries.length).toBeGreaterThan(50);
    for (const [source, artifact] of entries) {
      expect(source.startsWith("data/"), source).toBe(true);
      const repoPath = `public${artifact.href}`;
      expect(existsSync(join(root, repoPath)), repoPath).toBe(true);
      expect(statSync(join(root, repoPath)).size, repoPath).toBe(artifact.bytes);
      expect(digest(repoPath), repoPath).toBe(artifact.sha256);
    }
  });

  it("exports source documents without a legacy compatibility tree", () => {
    expect(existsSync(join(root, ".cache/data"))).toBe(false);
    expect(manifest.documents["data/research/catalog.json"]).toBeUndefined();
    expect(existsSync(join(root, "public/data/v2/documents/research/catalog.json"))).toBe(false);
    const database = new DatabaseSync(join(root, ".cache/equilibrium.sqlite"), { readOnly: true });
    try {
      const stored = database
        .prepare(
          "SELECT raw_json FROM source_records WHERE source_file = 'data/combat/equipment.json' AND entity_id = 'item:seismic-wand'",
        )
        .get() as { raw_json: string };
      const cache = readJson<{ records: Array<{ id: string }> }>(
        "public/data/v2/documents/combat/equipment.json",
      );
      expect(cache.records.find(({ id }) => id === "item:seismic-wand")).toEqual(
        JSON.parse(stored.raw_json),
      );
    } finally {
      database.close();
    }
  });

  it("keeps regional and unlock panel exports equal to their normalized records", () => {
    type Row = Record<string, unknown>;
    const skilling = sourceArrays<Row>("data/research/regional-skilling-unlocks.json").records;
    const combat = readJson<{ records: Row[] }>(
      "public/data/v2/documents/research/regional-combat-unlocks.json",
    ).records;
    const progression = sourceArrays<Row>("data/reference/progression-unlocks.json");
    const supplements = [
      sourceArrays<Row>("data/reference/progression-support-items-2026-07-25.json"),
      sourceArrays<Row>("data/reference/progression-container-bags-2026-07-25.json"),
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
      const exported = readJson<{
        panelHrefs: { regional: string; unlocks: Record<string, string> };
      }>(`public/data/v2/research/regions/${region.id}.json`);
      const regional = readJson<Record<string, unknown>>(`public${exported.panelHrefs.regional}`);
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

      for (const [section, href] of Object.entries(exported.panelHrefs.unlocks)) {
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
        expect(readJson<{ records: Row[] }>(`public${href}`).records).toEqual(
          [...rows.values()].filter((row) => researchRowMatchesRegion(row, region)),
        );
      }
    }
  });

  it("preserves every seeded research region exactly", () => {
    const parity = readJson<{
      exactRegionParity: boolean;
      researchRegions: Array<{ region: string; equal: boolean }>;
      quarantinedRecords: number;
    }>("reports/data-migration-parity.json");
    expect(parity.exactRegionParity).toBe(true);
    expect(parity.researchRegions).toHaveLength(REGION_IDS.length);
    expect(parity.researchRegions.every((region) => region.equal)).toBe(true);
    expect(new Set(parity.researchRegions.map((region) => region.region))).toEqual(
      new Set(REGION_IDS),
    );
    const index = readJson<{ regions: Array<{ id: string }> }>(
      "public/data/v2/research/index.json",
    );
    expect(index.regions.map(({ id }) => id)).toEqual(REGION_IDS);
    const quarantine = readJson<unknown[]>("reports/data-quarantine.json");
    expect(quarantine).toHaveLength(parity.quarantinedRecords);
  });
});
