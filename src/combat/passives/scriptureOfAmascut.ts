import type { CombatModifier, SourceReference } from "../types";

export const SCRIPTURE_OF_AMASCUT_PASSIVE_ID = "scripture-of-amascut" as const;
export const DEVOURERS_CONTAGION_EFFECT_ID = "devourers_contagion";
export const SCRIPTURE_OF_AMASCUT_PROC_CHANCE = 0.066;
export const SCRIPTURE_OF_AMASCUT_DAMAGE_MULTIPLIER = 1.1;
export const SCRIPTURE_OF_AMASCUT_DAMAGE_DURATION_TICKS = 17;
export const SCRIPTURE_OF_AMASCUT_COOLDOWN_TICKS = 25;
export const DEVOURERS_CONTAGION_FIRST_HIT_OFFSET_TICKS = 4;
export const DEVOURERS_CONTAGION_HIT_INTERVAL_TICKS = 2;
export const DEVOURERS_CONTAGION_HIT_COUNT = 9;
export const DEVOURERS_CONTAGION_DAMAGE_BAND = { minPct: 24, maxPct: 40 } as const;

export const SCRIPTURE_OF_AMASCUT_SOURCE: SourceReference = {
  source: "runescape-wiki",
  title: "Scripture of Amascut",
  url: "https://runescape.wiki/w/Scripture_of_Amascut",
  verifiedAt: "2026-09-03",
};

export interface ScriptureOfAmascutState {
  damageUntilTick: number;
  readyTick: number;
  triggeringCast: number;
}

export function newScriptureOfAmascutState(): ScriptureOfAmascutState {
  return {
    damageUntilTick: 0,
    readyTick: 0,
    triggeringCast: -1,
  };
}

export function scriptureOfAmascutDamageActive(
  state: ScriptureOfAmascutState,
  tick: number,
): boolean {
  return state.damageUntilTick > tick;
}

export function activateScriptureOfAmascut(
  tick: number,
  triggeringCast: number,
): ScriptureOfAmascutState {
  return {
    damageUntilTick: tick + SCRIPTURE_OF_AMASCUT_DAMAGE_DURATION_TICKS,
    readyTick: tick + SCRIPTURE_OF_AMASCUT_COOLDOWN_TICKS,
    triggeringCast,
  };
}

export function normalizeScriptureOfAmascutState(
  state: ScriptureOfAmascutState,
  tick: number,
): ScriptureOfAmascutState {
  const damageExpired = state.damageUntilTick > 0 && state.damageUntilTick <= tick;
  const cooldownExpired = state.readyTick > 0 && state.readyTick <= tick;
  if (!damageExpired && !cooldownExpired) return state;
  return {
    damageUntilTick: damageExpired ? 0 : state.damageUntilTick,
    readyTick: cooldownExpired ? 0 : state.readyTick,
    triggeringCast: damageExpired ? -1 : state.triggeringCast,
  };
}

export function scriptureOfAmascutDamageModifier(): CombatModifier {
  return {
    id: "equipment:scripture-of-amascut",
    stage: "base",
    priority: 100,
    abilityBaseMultiplier: SCRIPTURE_OF_AMASCUT_DAMAGE_MULTIPLIER,
    applies: () => true,
    apply: (state) => state,
    source: SCRIPTURE_OF_AMASCUT_SOURCE,
  };
}

export function isDevourersContagion(provenance: { kind: string; detail?: string }): boolean {
  return (
    provenance.kind === "equipment_proc" && provenance.detail === DEVOURERS_CONTAGION_EFFECT_ID
  );
}
