import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const cataloguePatchPath = join(
  process.cwd(),
  "data/patches/2026-08-08-ranged-ammunition-catalogue.jsonl",
);
const statsPatchPath = join(
  process.cwd(),
  "data/patches/2026-08-09-ammunition-wiki-stats.jsonl",
);
const runtimeSupportPatchPath = join(
  process.cwd(),
  "data/patches/2026-08-09-enchanted-bolt-runtime-support.jsonl",
);

function equipmentRecords(patchPath = cataloguePatchPath) {
  return readFileSync(patchPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter((operation) => {
      if (operation.op !== "set-record") return false;
      if (operation.file !== "data/combat/equipment.json") return false;
      return true;
    });
}

function finalEquipmentRecords() {
  const latest = new Map<string, ReturnType<typeof equipmentRecords>[number]>();
  for (const operation of [
    ...equipmentRecords(cataloguePatchPath),
    ...equipmentRecords(statsPatchPath),
    ...equipmentRecords(runtimeSupportPatchPath),
  ]) {
    latest.set((operation.body as { id: string }).id, operation);
  }
  return [...latest.values()];
}

function appendedEquipmentRecords() {
  return equipmentRecords().filter(
    (operation) => Number(String(operation.path).match(/\d+/)?.[0]) >= 593,
  );
}

describe("ranged ammunition catalogue patch", () => {
  it("has unique ids and contiguous appended equipment indices", () => {
    const records = appendedEquipmentRecords();
    const ids = records.map((operation) => (operation.body as { id: string }).id);
    const indices = records.map((operation) => Number(String(operation.path).match(/\d+/)?.[0]));

    expect(new Set(ids).size).toBe(ids.length);
    expect(indices).toEqual(
      Array.from({ length: indices.length }, (_, offset) => 593 + offset),
    );
  });

  it("labels only fully integrated ammunition mechanics modeled", () => {
    const modeledMechanics = new Set([
      "ordinary",
      "dragonbane",
      "deathspore",
      "splintering",
      "bik",
      "black-stone",
      "wen",
      "ful",
      "jas-dragonbane",
      "jas-demonbane",
      "opal",
      "pearl",
      "emerald",
      "ruby",
      "dragonstone",
      "onyx",
      "hydrix",
      "ascendri",
    ]);
    for (const operation of finalEquipmentRecords()) {
      const ammunition = (operation.body as { ammunition?: { mechanicId: string; support: { status: string } } })
        .ammunition;
      if (ammunition == null) continue;
      if (modeledMechanics.has(ammunition.mechanicId)) {
        expect(ammunition.support.status).toBe("modeled");
      } else {
        expect(ammunition?.support.status).not.toBe("modeled");
      }
    }

    const emeraldBakriminel = finalEquipmentRecords().find(
      (operation) => (operation.body as { id?: string }).id === "item:emerald-bakriminel-bolts-e",
    );
    expect(emeraldBakriminel?.body).toMatchObject({
      ammunition: {
        mechanicId: "emerald",
        support: { status: "modeled" },
      },
    });

    const quivers = finalEquipmentRecords()
      .map((operation) => operation.body as { id: string; quiver?: { support: { status: string } } })
      .filter((record) => record.quiver != null);
    for (const record of quivers) {
      if (record.id === "item:pernix-quiver") {
        expect(record.quiver?.support.status).toBe("modeled");
      } else {
        expect(record.quiver?.support.status).not.toBe("modeled");
      }
    }
  });

  it("uses the global availability fact for globally obtainable ammunition", () => {
    const globalRecords = equipmentRecords().filter((operation) => {
      const unlock = (operation.body as { unlock?: { regions?: string[] } }).unlock;
      return unlock?.regions?.includes("global") === true;
    });
    expect(globalRecords).toHaveLength(0);

    const bronze = equipmentRecords().find(
      (operation) => (operation.body as { id?: string }).id === "item:bronze-arrows",
    );
    expect(bronze?.body).toMatchObject({
      unlock: { availability: "global", regions: [] },
    });
  });
});
