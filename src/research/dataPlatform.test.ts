import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { REGION_IDS } from "@/league";

const root = process.cwd();
const readJson = <T>(path: string): T => JSON.parse(readFileSync(join(root, path), "utf8")) as T;
const digest = (path: string) =>
  createHash("sha256")
    .update(readFileSync(join(root, path)))
    .digest("hex");

interface Shard {
  href: string;
  sha256: string;
  bytes: number;
  records: number;
}

interface Manifest {
  schemaVersion: number;
  exportVersion: number;
  recordCount: number;
  domains: Record<string, { records: number; shards: Shard[] }>;
  regions: Record<string, { sha256: string }>;
  idIndexes: Array<Shard & { firstId: string; lastId: string }>;
}

describe("generated data platform", () => {
  const manifest = readJson<Manifest>("public/data/v2/manifest.json");

  it("keeps every frontend artifact bounded and content-addressed", () => {
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.exportVersion).toBe(2);
    const shards = [
      ...Object.values(manifest.domains).flatMap((domain) => domain.shards),
      ...manifest.idIndexes,
    ];
    for (const shard of shards) {
      const path = shard.href.replace(/^\//, "");
      expect(existsSync(join(root, "public", path.replace(/^data\//, "data/"))), path).toBe(true);
      const repoPath = `public/${path}`;
      expect(statSync(join(root, repoPath)).size, repoPath).toBe(shard.bytes);
      expect(digest(repoPath), repoPath).toBe(shard.sha256);
      expect(shard.bytes, repoPath).toBeLessThan(500 * 1024);
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

  it("preserves every legacy research region exactly", () => {
    const parity = readJson<{
      exactRegionParity: boolean;
      legacyResearchRegions: Array<{ region: string; equal: boolean }>;
      quarantinedRecords: number;
    }>("reports/data-migration-parity.json");
    expect(parity.exactRegionParity).toBe(true);
    expect(parity.legacyResearchRegions).toHaveLength(REGION_IDS.length);
    expect(parity.legacyResearchRegions.every((region) => region.equal)).toBe(true);
    expect(new Set(parity.legacyResearchRegions.map((region) => region.region))).toEqual(
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
