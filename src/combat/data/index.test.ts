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
  combatRevolutionBars,
  combatSyncFacts,
  recordsByRegion,
} from "./index";
import type { CombatDataset, RevolutionBarRecord } from "./records";
import { resolveBar } from "./specs";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { NECROMANCY_ABILITIES, volleyOfSouls } from "../styles/necromancy/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";

const datasets: Array<[string, CombatDataset<{ id: string; sources: { verifiedAt: string }[] }>]> = [
  ["abilities", combatAbilities],
  ["effects", combatEffects],
  ["equipment", combatEquipment],
  ["perks", combatPerks],
  ["prayers", combatPrayers],
];

/** Optional multi/hybrid fields may land on bars before the type is updated. */
type BarExtras = {
  target?: "single" | "multi";
  mode?: "revo++" | "hybrid";
};
type RevolutionBarWithMeta = RevolutionBarRecord & BarExtras;

const CORE_BAR_IDS = [
  "melee-dual-wield",
  "melee-two-handed",
  "ranged",
  "magic",
  "necromancy",
] as const;

const ENGINE_SPECS: ReadonlyMap<string, AbilitySpec> = new Map(
  [
    ...MELEE_ABILITIES,
    ...RANGED_ABILITIES,
    ...MAGIC_ABILITIES,
    ...NECROMANCY_ABILITIES,
    volleyOfSouls(3),
  ].map((spec) => [spec.id, spec]),
);

function bars(): RevolutionBarWithMeta[] {
  return combatRevolutionBars.records as RevolutionBarWithMeta[];
}

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
    expect(facts).toHaveLength(6);
    expect(facts.every((fact) => fact.records > 0 && fact.lastSynced)).toBe(true);
  });

  it("revolution bars resolve slots to records or engine ids, never invented ids", () => {
    const ENGINE_IDS = new Set(["attack", "ranged_attack", "magic_attack", "necromancy_basic", "volley_of_souls"]);
    const recordIds = new Set(combatAbilities.records.map((record) => record.id));
    for (const bar of combatRevolutionBars.records) {
      expect(bar.revolutionSize).toBeGreaterThanOrEqual(1);
      for (const slot of bar.slots) {
        if (slot.abilityId === null) continue;
        expect(recordIds.has(slot.abilityId) || ENGINE_IDS.has(slot.abilityId)).toBe(true);
      }
    }
    // Conjures stay null (honest unmodelled); damage/buff slots map to records/engine.
    expect(combatRevolutionBars.records.find((bar) => bar.id === "necromancy")?.supported).toBe(true);
  });

  it("prayer catalogue covers all three books with the codex overlay merged", () => {
    const books = new Set(combatPrayers.records.map((record) => record.book));
    expect(books).toEqual(new Set(["standard", "ancient", "seren"]));
    const ruination = combatPrayers.records.find((record) => record.id === "curse:ruination");
    expect(ruination?.level).toBe(99);
    expect(ruination?.unlock?.type).toBe("drop");
    // Overlay merged into the catalogue row, not duplicated.
    expect(combatPrayers.records.filter((record) => record.name === "Ruination")).toHaveLength(1);
  });
});

describe("revolution bars multi / hybrid structural contract", () => {
  it("keeps the core single-target Revo++ bar ids", () => {
    const ids = new Set(bars().map((bar) => bar.id));
    for (const id of CORE_BAR_IDS) {
      expect(ids.has(id), `missing core bar ${id}`).toBe(true);
    }
  });

  it("every abilityId is null or a combat ability / engine id (no invented refs)", () => {
    const ENGINE_IDS = new Set(["attack", "ranged_attack", "magic_attack", "necromancy_basic", "volley_of_souls"]);
    const recordIds = new Set(combatAbilities.records.map((record) => record.id));
    for (const bar of bars()) {
      for (const slot of bar.slots) {
        if (slot.abilityId === null) continue;
        expect(
          recordIds.has(slot.abilityId) || ENGINE_IDS.has(slot.abilityId),
          `${bar.id} slot ${slot.name} -> ${slot.abilityId}`,
        ).toBe(true);
      }
    }
  });

  it("when target is present on any bar, every bar's target is single|multi", () => {
    const withTarget = bars().filter((bar) => bar.target != null);
    if (withTarget.length === 0) return; // field not landed yet
    for (const bar of bars()) {
      expect(["single", "multi"], `${bar.id} target`).toContain(bar.target);
    }
  });

  it("when mode is present on any bar, every bar's mode is revo++|hybrid|basics", () => {
    const withMode = bars().filter((bar) => bar.mode != null);
    if (withMode.length === 0) return; // field not landed yet
    for (const bar of bars()) {
      expect(["revo++", "hybrid", "basics"], `${bar.id} mode`).toContain(bar.mode);
    }
  });

  it("revo++ and basics bars have slots.length >= revolutionSize", () => {
    for (const bar of bars()) {
      if (bar.mode === "hybrid") continue;
      expect(
        bar.slots.length,
        `${bar.id}: slots ${bar.slots.length} < revolutionSize ${bar.revolutionSize}`,
      ).toBeGreaterThanOrEqual(bar.revolutionSize);
    }
  });

  it("catalogue is single-target only", () => {
    for (const bar of bars()) {
      expect(bar.target, bar.id).toBe("single");
    }
  });

  it("hybrid bars have slots.length > revolutionSize", () => {
    const hybrids = bars().filter((bar) => bar.mode === "hybrid");
    if (hybrids.length === 0) return;
    for (const bar of hybrids) {
      expect(
        bar.slots.length,
        `${bar.id}: hybrid must expose manual tail beyond revo window`,
      ).toBeGreaterThan(bar.revolutionSize);
    }
  });

  it("when multi-target bars exist, at least one is present and well-formed", () => {
    const multi = bars().filter((bar) => bar.target === "multi");
    if (multi.length === 0) return;
    expect(multi.length).toBeGreaterThanOrEqual(1);
    for (const bar of multi) {
      expect(bar.revolutionSize).toBeGreaterThanOrEqual(1);
      expect(bar.slots.length).toBeGreaterThan(0);
      expect(bar.style).toBeTruthy();
    }
  });

  it("hybrid revo window is resolveBar(...).slice(0, revolutionSize)", () => {
    const hybrids = bars().filter((bar) => bar.mode === "hybrid");
    if (hybrids.length === 0) return;
    for (const bar of hybrids) {
      const resolved = resolveBar(bar, ENGINE_SPECS);
      expect(resolved).toHaveLength(bar.slots.length);
      const revoWindow = resolved.slice(0, bar.revolutionSize);
      expect(revoWindow).toHaveLength(bar.revolutionSize);
      // Manual tail is the remainder — structural only, no damage pins.
      expect(resolved.slice(bar.revolutionSize).length).toBe(bar.slots.length - bar.revolutionSize);
      expect(revoWindow.every((slot, i) => slot.name === bar.slots[i].name)).toBe(true);
    }
  });
});
