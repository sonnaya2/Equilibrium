import { describe, expect, it } from "vitest";
import { isRegionId } from "../../league";
import {
  abilitiesByRegion,
  abilitiesByStyle,
  abilityById,
  combatAbilities,
  combatEffects,
  combatEquipment,
  combatPerks,
  combatPrayers,
  combatSyncFacts,
  recordsByRegion,
} from "./index";
import type { CombatDataset } from "./records";

const datasets: Array<[string, CombatDataset<{ id: string; sources: { verifiedAt: string }[] }>]> = [
  ["abilities", combatAbilities],
  ["effects", combatEffects],
  ["equipment", combatEquipment],
  ["perks", combatPerks],
  ["prayers", combatPrayers],
];

describe("canonical combat datasets", () => {
  it.each(datasets)("%s: unique ids, provenance on every record", (_kind, dataset) => {
    const seen = new Set<string>();
    for (const record of dataset.records) {
      expect(seen.has(record.id), `duplicate id ${record.id}`).toBe(false);
      seen.add(record.id);
      expect(record.sources.length, `${record.id} has no SourceReference`).toBeGreaterThan(0);
      for (const source of record.sources) {
        expect(source.verifiedAt, `${record.id} source missing verifiedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
    expect(dataset.trackedSince).toBe("2024-03-04");
    expect(dataset.records.length).toBeGreaterThan(0);
  });

  it.each(datasets)("%s: unlock regions are valid League region ids", (_kind, dataset) => {
    for (const record of dataset.records) {
      for (const region of (record as { unlock?: { regions?: string[] } }).unlock?.regions ?? []) {
        expect(isRegionId(region), `${record.id} tags unknown region ${region}`).toBe(true);
      }
    }
  });

  it("ability effect references resolve to effect records", () => {
    const effectIds = new Set(combatEffects.records.map((record) => record.id));
    for (const record of combatAbilities.records) {
      for (const effectId of record.effects ?? []) {
        expect(effectIds.has(effectId), `${record.id} references missing effect ${effectId}`).toBe(true);
      }
    }
  });

  it("pins the documented adrenaline exceptions (§5.4 basics rule, §5.7, §4.4)", () => {
    // All basics generate 9% unless a source names a different value.
    expect(abilityById("melee:dismember")?.adrenaline).toEqual({ kind: "gain", percent: 0 });
    expect(abilityById("melee:adaptive-strike")?.adrenaline).toEqual({ kind: "gain", percent: 12 });
    expect(abilityById("melee:chaos-roar")?.adrenaline).toEqual({ kind: "gain", percent: 9 });
    expect(abilityById("melee:chaos-roar")?.category).toBe("basic");
    expect(abilityById("melee:punish")?.category).toBe("basic");
    expect(abilityById("ranged:ricochet")?.adrenaline).toEqual({ kind: "gain", percent: 9 });
    // Unsourced adrenaline stays absent rather than manufactured.
    expect(abilityById("magic:runic-charge")?.adrenaline).toBeUndefined();
  });
});

describe("combat data accessors", () => {
  it("finds records by id", () => {
    expect(abilityById("melee:rend")?.name).toBe("Rend");
    expect(abilityById("nope:nothing")).toBeUndefined();
  });

  it("filters abilities by style", () => {
    const ranged = abilitiesByStyle("ranged");
    expect(ranged.length).toBeGreaterThan(0);
    expect(ranged.every((record) => record.style === "ranged")).toBe(true);
  });

  it("filters by region: region-locked records plus base game by default", () => {
    const misthalin = abilitiesByRegion("misthalin");
    const locked = abilitiesByRegion("misthalin", { regionLockedOnly: true });
    expect(locked.some((record) => record.id === "magic:greater-sonic-wave")).toBe(true);
    expect(locked.every((record) => record.unlock?.regions.includes("misthalin"))).toBe(true);
    expect(misthalin.length).toBeGreaterThan(locked.length);
    // kandarin gets the quest-unlocked Death's Swiftness; anachronia does not.
    expect(
      recordsByRegion(combatAbilities.records, "kandarin", { regionLockedOnly: true }).map((r) => r.id),
    ).toContain("ranged:deaths-swiftness");
    expect(
      recordsByRegion(combatAbilities.records, "anachronia", { regionLockedOnly: true }).map((r) => r.id),
    ).not.toContain("ranged:deaths-swiftness");
  });

  it("reports sync facts per dataset", () => {
    const facts = combatSyncFacts();
    expect(facts).toHaveLength(5);
    expect(facts.every((fact) => fact.records > 0 && fact.lastSynced)).toBe(true);
  });
});
