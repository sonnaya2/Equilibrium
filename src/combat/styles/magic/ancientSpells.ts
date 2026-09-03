import type { DamageBand } from "../../core/abilityDamage";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { CombatModifier, SourceReference } from "../../types";
import { mulFloor } from "../../core/rounding";

export type MagicCombatSpell = "none" | "exsanguinate" | "incite-fear";

export interface TimedSpellStacks {
  stacks: number;
  expiresAtTick: number;
}

export const ANCIENT_SPELL_STACK_DURATION_TICKS = 34;
export const BLOOD_TITHE_MAX_STACKS = 12;
export const BLOOD_TITHE_DAMAGE_PER_STACK = 0.01;
export const GLACIAL_EMBRACE_MAX_STACKS = 5;
export const GLACIAL_EMBRACE_TSUNAMI_REDUCTION_PER_STACK = 12;
export const FROST_SURGE_COOLDOWN_TICKS = 20;
export const FROST_SURGE_BAND: DamageBand = { minPct: 10, maxPct: 50 };

export const EXSANGUINATE_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Exsanguinate",
  title: "Exsanguinate",
  verifiedAt: "2026-09-03",
};

export const INCITE_FEAR_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Incite_Fear",
  title: "Incite Fear",
  verifiedAt: "2026-09-03",
};

export const FROST_SURGE_ABILITY: AbilitySpec = {
  id: "frost_surge",
  name: "Frost Surge",
  style: "magic",
  category: "enhanced",
  hits: [{ band: FROST_SURGE_BAND, critEligible: false }],
};

export const MAGIC_COMBAT_SPELLS: ReadonlyArray<{
  id: MagicCombatSpell;
  name: string;
  tier: number | null;
  icon: string | null;
  summary: string;
}> = [
  {
    id: "none",
    name: "No special spell",
    tier: null,
    icon: null,
    summary: "Uses the manual spell tier without a Senntisten spell effect.",
  },
  {
    id: "exsanguinate",
    name: "Exsanguinate",
    tier: 100,
    icon: "/game/combat/spells/magic/exsanguinate.webp",
    summary: "Blood Tithe: +1% Magic basic base damage per cast, up to 12 stacks.",
  },
  {
    id: "incite-fear",
    name: "Incite Fear",
    tier: 100,
    icon: "/game/combat/spells/magic/incite-fear.webp",
    summary: "Glacial Embrace reduces Tsunami cost and triggers Frost Surge at 5 stacks.",
  },
];

export function normalizeMagicCombatSpell(value: unknown): MagicCombatSpell {
  return value === "exsanguinate" || value === "incite-fear" ? value : "none";
}

export function effectiveMagicSpellTier(spell: MagicCombatSpell, manualTier: number): number {
  return spell === "none" ? manualTier : 100;
}

export function inactiveSpellStacks(): TimedSpellStacks {
  return { stacks: 0, expiresAtTick: 0 };
}

export function activeSpellStacks(state: TimedSpellStacks, tick: number): number {
  return state.expiresAtTick > tick ? state.stacks : 0;
}

export function gainSpellStack(
  state: TimedSpellStacks,
  tick: number,
  maximum: number,
): TimedSpellStacks {
  return {
    stacks: Math.min(maximum, activeSpellStacks(state, tick) + 1),
    expiresAtTick: tick + ANCIENT_SPELL_STACK_DURATION_TICKS,
  };
}

export function normalizeSpellStacks(state: TimedSpellStacks, tick: number): TimedSpellStacks {
  if (activeSpellStacks(state, tick) > 0) return state;
  return state.stacks === 0 && state.expiresAtTick === 0 ? state : inactiveSpellStacks();
}

export function bloodTitheDamageModifier(stacks: number): CombatModifier | null {
  if (stacks <= 0) return null;
  return {
    id: "spell:blood-tithe",
    stage: "onCast",
    priority: 0,
    applies: () => true,
    apply: (state) => ({
      ...state,
      damage: mulFloor(state.damage, 1 + stacks * BLOOD_TITHE_DAMAGE_PER_STACK),
    }),
    source: EXSANGUINATE_SOURCE,
  };
}

export function glacialTsunamiReduction(stacks: number): number {
  return (
    Math.max(0, Math.min(GLACIAL_EMBRACE_MAX_STACKS, stacks)) *
    GLACIAL_EMBRACE_TSUNAMI_REDUCTION_PER_STACK
  );
}
