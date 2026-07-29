import combatUnlocks from "../../data/research/regional-combat-unlocks.json";

interface CombatUnlockRegions {
  requiredRegions?: readonly string[];
  regionHints?: readonly string[];
}

export function combatUnlockRegions(record: CombatUnlockRegions): readonly string[] {
  return record.requiredRegions?.length ? record.requiredRegions : (record.regionHints ?? []);
}

export function combatUnlockCountForRegion(regionId: string): number {
  return combatUnlocks.records.filter((record) => combatUnlockRegions(record).includes(regionId))
    .length;
}
