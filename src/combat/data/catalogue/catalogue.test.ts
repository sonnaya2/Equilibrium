import { describe, expect, it } from "vitest";
import {
  abilityById,
  combatAbilities,
  combatDataCatalogue,
  combatEffects,
  combatEquipment,
  combatPerks,
  combatPrayers,
  combatRevolutionBars,
  combatTargetPresets,
  effectById,
  equipmentById,
  perkById,
  prayerById,
  revolutionBarById,
  targetPresetById,
} from "../index";
import { compileCombatDataCatalogue, indexRecordsById } from "./compile";
import type { CombatDataSources } from "./contracts";
import type { TargetPresetRecord } from "../records";
import {
  assertCatalogueIntegrity,
  assertTargetPresetRecords,
  findDuplicateIds,
} from "./validate";

const datasets = [
  ["abilities", combatAbilities, combatDataCatalogue.abilitiesById],
  ["equipment", combatEquipment, combatDataCatalogue.equipmentById],
  ["effects", combatEffects, combatDataCatalogue.effectsById],
  ["perks", combatPerks, combatDataCatalogue.perksById],
  ["prayers", combatPrayers, combatDataCatalogue.prayersById],
  ["revolution-bars", combatRevolutionBars, combatDataCatalogue.revolutionBarsById],
  ["target-presets", combatTargetPresets, combatDataCatalogue.targetPresetsById],
] as const;

function sourcesFromLive(): CombatDataSources {
  return {
    abilities: combatAbilities,
    equipment: combatEquipment,
    effects: combatEffects,
    perks: combatPerks,
    prayers: combatPrayers,
    revolutionBars: combatRevolutionBars,
    targetPresets: combatTargetPresets,
  };
}

describe("combat data catalogue", () => {
  it("every dataset has unique record ids", () => {
    for (const [kind, dataset] of datasets) {
      expect(findDuplicateIds(dataset.records), kind).toEqual([]);
    }
  });

  it("index size equals record array size for every dataset", () => {
    for (const [kind, dataset, byId] of datasets) {
      expect(byId.size, kind).toBe(dataset.records.length);
    }
  });

  it("indexed object is the same reference as the generated record", () => {
    for (const [kind, dataset, byId] of datasets) {
      for (const record of dataset.records) {
        expect(byId.get(record.id), `${kind}/${record.id}`).toBe(record);
      }
    }
  });

  it("helpers match linear scan of the source arrays", () => {
    for (const record of combatAbilities.records) {
      expect(abilityById(record.id)).toBe(record);
      expect(combatAbilities.records.find((r) => r.id === record.id)).toBe(abilityById(record.id));
    }
    for (const record of combatEquipment.records) {
      expect(equipmentById(record.id)).toBe(record);
    }
    for (const record of combatEffects.records) {
      expect(effectById(record.id)).toBe(record);
    }
    for (const record of combatPerks.records) {
      expect(perkById(record.id)).toBe(record);
    }
    for (const record of combatPrayers.records) {
      expect(prayerById(record.id)).toBe(record);
    }
    for (const record of combatRevolutionBars.records) {
      expect(revolutionBarById(record.id)).toBe(record);
    }
  });

  it("unknown ids return undefined", () => {
    expect(abilityById("nope:nothing")).toBeUndefined();
    expect(equipmentById("item:does-not-exist")).toBeUndefined();
    expect(effectById("effect:missing")).toBeUndefined();
    expect(perkById("perk:missing")).toBeUndefined();
    expect(prayerById("prayer:missing")).toBeUndefined();
    expect(revolutionBarById("bar-missing")).toBeUndefined();
    expect(targetPresetById("boss:missing")).toBeUndefined();
  });

  it("singleton is built once and exposes all dataset maps", () => {
    expect(combatDataCatalogue.abilitiesById).toBeInstanceOf(Map);
    expect(combatDataCatalogue.equipmentById).toBeInstanceOf(Map);
    expect(combatDataCatalogue.effectsById).toBeInstanceOf(Map);
    expect(combatDataCatalogue.perksById).toBeInstanceOf(Map);
    expect(combatDataCatalogue.prayersById).toBeInstanceOf(Map);
    expect(combatDataCatalogue.revolutionBarsById).toBeInstanceOf(Map);
    expect(combatDataCatalogue.targetPresetsById).toBeInstanceOf(Map);
    // Module init: re-import of the same binding stays referentially identical
    expect(combatDataCatalogue.abilities).toBe(combatAbilities);
    expect(combatDataCatalogue.equipment).toBe(combatEquipment);
    expect(combatDataCatalogue.targetPresets).toBe(combatTargetPresets);
  });

  it("compilation is deterministic: equal sizes/keys and same object refs", () => {
    const a = compileCombatDataCatalogue(sourcesFromLive());
    const b = compileCombatDataCatalogue(sourcesFromLive());

    expect(a.abilitiesById.size).toBe(b.abilitiesById.size);
    expect(a.equipmentById.size).toBe(b.equipmentById.size);
    expect(a.effectsById.size).toBe(b.effectsById.size);
    expect(a.perksById.size).toBe(b.perksById.size);
    expect(a.prayersById.size).toBe(b.prayersById.size);
    expect(a.revolutionBarsById.size).toBe(b.revolutionBarsById.size);

    expect([...a.abilitiesById.keys()].sort()).toEqual([...b.abilitiesById.keys()].sort());
    expect([...a.equipmentById.keys()].sort()).toEqual([...b.equipmentById.keys()].sort());

    for (const [id, record] of a.abilitiesById) {
      expect(b.abilitiesById.get(id)).toBe(record);
    }
    for (const [id, record] of a.equipmentById) {
      expect(b.equipmentById.get(id)).toBe(record);
    }
    // Same source arrays on both compiles
    expect(a.abilities.records).toBe(b.abilities.records);
    expect(a.equipment.records).toBe(b.equipment.records);
  });

  it("does not mutate source records during compile", () => {
    const abilities = combatAbilities.records.map((r) => ({ ...r, id: r.id }));
    const first = abilities[0]!;
    const snapshot = JSON.stringify(first);
    const idBefore = first.id;

    const byId = indexRecordsById(abilities, "ability");
    expect(byId.get(idBefore)).toBe(first);
    expect(JSON.stringify(first)).toBe(snapshot);
    expect(first.id).toBe(idBefore);

    // Live catalogue: re-compile does not rewrite record fields
    const sample = combatEquipment.records[0]!;
    const before = { ...sample, bonuses: { ...sample.bonuses } };
    compileCombatDataCatalogue(sourcesFromLive());
    expect(sample.id).toBe(before.id);
    expect(sample.name).toBe(before.name);
    expect(sample.bonuses).toEqual(before.bonuses);
  });

  it("throws on duplicate ids at compile", () => {
    const dupId = combatAbilities.records[0]!.id;
    const sources = sourcesFromLive();
    const poisoned: CombatDataSources = {
      ...sources,
      abilities: {
        ...sources.abilities,
        records: [...sources.abilities.records, { ...sources.abilities.records[0]!, id: dupId }],
      },
    };
    expect(() => compileCombatDataCatalogue(poisoned, { assert: false })).toThrow(
      /Duplicate ability id/,
    );
  });

  it("assertCatalogueIntegrity passes on the live singleton", () => {
    expect(() => assertCatalogueIntegrity(combatDataCatalogue)).not.toThrow();
  });

  it("preserves dataset verification metadata", () => {
    expect(combatAbilities.trackedSince).toBe("2024-03-04");
    expect(combatEquipment.trackedSince).toBe("2024-03-04");
    expect(combatTargetPresets.trackedSince).toBe("2024-03-04");
    expect(combatDataCatalogue.abilities.lastSynced).toBe(combatAbilities.lastSynced);
    expect(combatDataCatalogue.abilities.records).toBe(combatAbilities.records);
  });

  it("rejects target presets with out-of-range affinity", () => {
    const bad: TargetPresetRecord = {
      id: "boss:test",
      name: "Test",
      encounter: "Test",
      category: "boss",
      wiki: { pageName: "Test" },
      support: "supported",
      sources: [
        {
          source: "runescape-wiki",
          url: "https://runescape.wiki/w/Test",
          verifiedAt: "2026-08-09",
        },
      ],
      stats: {
        defenceLevel: 1,
        armour: 0,
        affinities: { melee: 55, ranged: 200, magic: 50 },
        size: 1,
      },
    };
    expect(() => assertTargetPresetRecords([bad])).toThrow(/affinity 200 out of range/);
  });

  it("accepts a supported target preset with exact affinity 55", () => {
    const good: TargetPresetRecord = {
      id: "boss:test-55",
      name: "Test 55",
      encounter: "Test",
      category: "boss",
      wiki: { pageName: "Test_55" },
      support: "supported",
      sources: [
        {
          source: "runescape-wiki",
          url: "https://runescape.wiki/w/Test_55",
          verifiedAt: "2026-08-09",
        },
      ],
      stats: {
        defenceLevel: 90,
        armour: 100,
        affinities: { melee: 55, ranged: 55, magic: 55, weakness: 55 },
        size: 3,
        poisonImmune: true,
      },
    };
    expect(() => assertTargetPresetRecords([good])).not.toThrow();
    const compiled = compileCombatDataCatalogue({
      ...sourcesFromLive(),
      targetPresets: {
        lastSynced: "2026-08-09",
        trackedSince: "2024-03-04",
        records: [good],
      },
    });
    expect(compiled.targetPresetsById.get("boss:test-55")).toBe(good);
  });
});
