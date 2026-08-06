import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { resolveRewardIcon, presentContentRewards } from "./dataContentPresentation";
import { dataEntityIconPath } from "./gameArt";
import { resolveRewardIconLabel } from "./rewardIconAliases";
import { contentRewardsFull } from "./researchRewards";
import { readFileSync } from "node:fs";

const PUBLIC = join(process.cwd(), "public");
const CATALOG_FILE = "data/research/catalog.json";
type JsonRecord = Record<string, unknown>;
const canonical = (name: string): JsonRecord[] =>
  readFileSync(join(process.cwd(), "data/canonical/provenance", name), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonRecord);

function reconstructCatalog(): JsonRecord {
  const document = canonical("source-documents.jsonl").find((row) => row.path === CATALOG_FILE) as
    { skeleton: JsonRecord } | undefined;
  if (!document) throw new Error(`missing catalog skeleton for ${CATALOG_FILE}`);
  const catalog = structuredClone(document.skeleton) as JsonRecord;
  const records = canonical("source-records.jsonl")
    .filter((row) => row.sourceFile === CATALOG_FILE)
    .sort((a, b) => String(a.recordPath).localeCompare(String(b.recordPath), "en"));
  for (const row of records) {
    const recordPath = String(row.recordPath);
    const record = row.record;
    const tokens = [...recordPath.matchAll(/\.([^.[\]]+)|\[(\d+)\]/g)].map((match) =>
      match[1] === undefined ? Number(match[2]) : match[1],
    );
    let target: unknown = catalog;
    for (const token of tokens.slice(0, -1)) {
      target = (target as Record<string | number, unknown>)[token as string | number];
    }
    (target as Record<string | number, unknown>)[tokens.at(-1)! as string | number] = record;
  }
  return catalog;
}

describe("salve amulet icons", () => {
  it("reward + entity resolve to salve amulet inventory, never elder-overload-salve", () => {
    const equip = "/game/combat/equipment/salve-amulet-e.webp";
    expect(resolveRewardIconLabel("Salve amulet (e)")).toBe(equip);
    expect(resolveRewardIcon("Salve amulet (e)")).toBe(equip);
    expect(resolveRewardIcon("Salve amulet")).toBe(equip);
    expect(resolveRewardIcon("Salve amulet (e)")).not.toMatch(/elder-overload/);
    expect(dataEntityIconPath({ name: "Abandoned Mine salve shard mining" })).toBe(equip);
    expect(dataEntityIconPath({ name: "Salve amulet (e)" })).toBe(equip);
    expect(dataEntityIconPath({ name: "Salve amulet (base)" })).toMatch(/salve-amulet\.webp$/);
    expect(existsSync(join(PUBLIC, equip.replace(/^\//, "")))).toBe(true);
  });

  it("morytania Abandoned Mine reward chip is salve amulet (e) equip art", () => {
    const cat = reconstructCatalog();
    const regions = cat.regions as Array<{
      id: string;
      content: Array<{ name: string }>;
      upgrades: Array<{ name: string }>;
    }>;
    const mory = regions.find((r) => r.id === "morytania");
    expect(mory).toBeTruthy();
    const row = [...mory!.content, ...mory!.upgrades].find(
      (r) => r.name === "Abandoned Mine salve shard mining",
    );
    expect(row).toBeDefined();
    if (!row) throw new Error("missing Abandoned Mine salve shard mining row");
    const full = contentRewardsFull(row, mory!.upgrades);
    const presented = presentContentRewards(full, 8);
    expect(full).toBe("Salve amulet (e)");
    expect(presented.icons[0]?.src).toBe("/game/combat/equipment/salve-amulet-e.webp");
    expect(presented.icons[0]?.src).not.toMatch(/elder-overload/);
  });
});
