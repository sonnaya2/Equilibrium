import { engineSpecsForStyle } from "@/combat/abilities/registry";
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import { volleyOfSouls } from "@/combat/styles/necromancy/abilities";
import type { CombatStyle } from "@/combat/types";

export interface AnalysisAbilityEntry {
  readonly id: `${CombatStyle}:${string}`;
  readonly style: CombatStyle;
  readonly ability: AbilitySpec;
}

function analysisAbilityEntry(style: CombatStyle, ability: AbilitySpec): AnalysisAbilityEntry {
  return { id: `${style}:${ability.id}`, style, ability };
}

const damaging = (["melee", "ranged", "magic"] as const).flatMap((style) =>
  engineSpecsForStyle(style)
    .filter((ability) => ability.hits.length > 0)
    .map((ability) => analysisAbilityEntry(style, ability)),
);

const volley = volleyOfSouls(3);

export const ANALYSIS_ABILITY_ENTRIES: readonly AnalysisAbilityEntry[] = [
  ...damaging,
  analysisAbilityEntry("necromancy", volley),
];

export const ANALYSIS_ABILITY_ENTRY_BY_ID: ReadonlyMap<string, AnalysisAbilityEntry> = new Map(
  ANALYSIS_ABILITY_ENTRIES.map((entry) => [entry.id, entry]),
);
