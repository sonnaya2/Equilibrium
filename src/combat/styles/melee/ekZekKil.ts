import type { AbilityHit } from "../../pipeline/calculateAbility";
import type { CombatModifier, SourceReference } from "../../types";

export const IGNEOUS_SHOWDOWN_PRIMARY_BAND = { minPct: 260, maxPct: 300 } as const;
export const IGNEOUS_SHOWDOWN_REPEAT_BAND = { minPct: 245, maxPct: 265 } as const;
export const IGNEOUS_SHOWDOWN_ADRENALINE_COST = 50;
export const IGNEOUS_SHOWDOWN_COOLDOWN_SECONDS = 60;
export const IGNEOUS_SHOWDOWN_REPEAT_REFUND = 15;
export const ASHEN_VOW_DAMAGE_MULTIPLIER = 1.12;

const wiki = (
  title: string,
  path: string,
  revision: string,
  verifiedAt = "2026-08-08",
): SourceReference => ({
  source: "runescape-wiki",
  url: `https://runescape.wiki/w/${path}`,
  title,
  revision,
  verifiedAt,
});

export const IGNEOUS_SHOWDOWN_SOURCE = wiki("Igneous Showdown", "Igneous_Showdown", "37070935");
export const ASHEN_VOW_SOURCE = wiki("Ashen Vow", "Ashen_Vow", "36959494");
export const FLAMEBOUND_RIVAL_SOURCE = wiki("Flamebound Rival", "Flamebound_Rival", "36799364");

export const IGNEOUS_SHOWDOWN_PRIMARY_HIT: AbilityHit = {
  band: { ...IGNEOUS_SHOWDOWN_PRIMARY_BAND },
};

export const IGNEOUS_SHOWDOWN_REPEAT_HIT: AbilityHit = {
  band: { ...IGNEOUS_SHOWDOWN_REPEAT_BAND },
};

export function igneousShowdownHits(repeat: boolean): AbilityHit[] {
  return repeat
    ? [
        { ...IGNEOUS_SHOWDOWN_PRIMARY_HIT },
        { ...IGNEOUS_SHOWDOWN_REPEAT_HIT },
        { ...IGNEOUS_SHOWDOWN_REPEAT_HIT },
        { ...IGNEOUS_SHOWDOWN_REPEAT_HIT },
      ]
    : [{ ...IGNEOUS_SHOWDOWN_PRIMARY_HIT }];
}

export function ashenVowModifier(): CombatModifier {
  return {
    id: "passive:ashen-vow",
    stage: "ability",
    priority: 0,
    abilityBaseMultiplier: ASHEN_VOW_DAMAGE_MULTIPLIER,
    applies: () => true,
    apply: (state) => state,
    source: ASHEN_VOW_SOURCE,
  };
}
