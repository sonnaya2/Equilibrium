import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { secondsToTicks } from "../../rotation/timeline";
import { MODERNISATION_WIKI, NECROSIS_WIKI, RESIDUAL_SOUL_WIKI } from "../../data/sources";
import type { SourceReference } from "../../types";
import {
  DEATH_SKULLS_COOLDOWN_SECONDS,
  DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS,
  FINGER_OF_DEATH_LIVING_DEATH_MULT,
  LIVING_DEATH_BASIC_NECROSIS,
  LIVING_DEATH_DURATION_SECONDS,
  LIVING_DEATH_WIKI,
  MAX_SOULS,
  TOUCH_OF_DEATH_LIVING_DEATH_ADRENALINE_BONUS,
  VOLLEY_MIN_SOULS,
  deathGrasp,
  fingerOfDeath,
  volleyOfSouls,
  type NecromancyAbilitySpec,
} from "./abilities";
import {
  FINGER_OF_DEATH_MAX_STACKS,
  NECROSIS_CAP,
  TOUCH_OF_DEATH_NECROSIS,
} from "./necrosis";
import {
  RESIDUAL_SOUL_CAP,
  SOULBOUND_LANTERN_BONUS_CAP,
} from "./souls";

/**
 * Necromancy rotation resources + Living Death window.
 *
 * Caps (wiki Residual Soul / Necrosis, verified 2026-07-26):
 *   residualSouls  0..3 (0..5 with soulbound lantern)
 *   necrosisStacks 0..12
 *   livingDeath    30s / 50 ticks from cast tick (active while tick < until)
 *
 * On cast (applyNecroOnCast): soulGain / necrosisGain / soulCost, FoD spends up
 * to 6 Necrosis, Death Grasp spends all, Living Death activates and resets
 * Touch of Death + Death Skulls CDs. Under LD: basic +2 Necrosis, ToD +6% adren,
 * FoD 1.5× band, Death Skulls CD → 17 ticks.
 *
 * Call site (simulate performCast):
 *   1. resolveNecromancyAbility(ability, necro, tick) before damage
 *   2. necroCanCast / necroAdrenalineCost for gates
 *   3. applyNecroOnCast → patch necro + adren bonus + clear ToD/DS CDs
 *   4. deathSkullsCooldownTicks when starting Death Skulls CD
 *
 * Spectral Scythe soulChance is not rolled here (deterministic EV sim — no free
 * 0.25 soul injection without a documented EV policy).
 */

export interface NecroRotationState {
  residualSouls: number;
  necrosisStacks: number;
  /** Exclusive end tick; 0 = inactive. Active when tick < livingDeathUntilTick. */
  livingDeathUntilTick: number;
  /** Soulbound lantern: residual soul cap 3 → 5. */
  lantern: boolean;
}

/** Result of a necro cast's resource side-effects (merge into RotationState). */
export interface NecroOnCastPatch {
  necro: NecroRotationState;
  /** Extra adrenaline beyond the ability's listed gain (ToD under LD = +6). */
  adrenalineBonus: number;
  /** Cooldown ids to clear (Living Death resets Touch of Death + Death Skulls). */
  clearCooldownIds: readonly string[];
}

export function newNecroRotationState(opts: { lantern?: boolean } = {}): NecroRotationState {
  return {
    residualSouls: 0,
    necrosisStacks: 0,
    livingDeathUntilTick: 0,
    lantern: opts.lantern ?? false,
  };
}

export function residualSoulCapFor(necro: NecroRotationState): number {
  return RESIDUAL_SOUL_CAP + (necro.lantern ? SOULBOUND_LANTERN_BONUS_CAP : 0);
}

export function livingDeathActive(necro: NecroRotationState, tick: number): boolean {
  return necro.livingDeathUntilTick > 0 && tick < necro.livingDeathUntilTick;
}

export function activateLivingDeath(necro: NecroRotationState, castTick: number): NecroRotationState {
  return {
    ...necro,
    livingDeathUntilTick: castTick + secondsToTicks(LIVING_DEATH_DURATION_SECONDS),
  };
}

/** Death Skulls: 60s normally; 17 ticks under Living Death (2 Mar 2026). */
export function deathSkullsCooldownTicks(necro: NecroRotationState, tick: number): number {
  return livingDeathActive(necro, tick)
    ? DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS
    : secondsToTicks(DEATH_SKULLS_COOLDOWN_SECONDS);
}

/**
 * Rewrite FoD / Death Grasp / Volley from current necro resources before damage
 * and adrenaline cost are evaluated.
 */
export function resolveNecromancyAbility(
  ability: AbilitySpec,
  necro: NecroRotationState,
  tick: number,
): AbilitySpec {
  if (ability.style !== "necromancy") return ability;
  if (ability.id === "finger_of_death") {
    return fingerOfDeath({
      necrosisStacks: necro.necrosisStacks,
      livingDeath: livingDeathActive(necro, tick),
    });
  }
  if (ability.id === "death_grasp") {
    return deathGrasp({ necrosisStacks: necro.necrosisStacks });
  }
  if (ability.id === "volley_of_souls") {
    const n = Math.min(MAX_SOULS, Math.max(0, necro.residualSouls));
    if (n >= VOLLEY_MIN_SOULS) return volleyOfSouls(n);
  }
  return ability;
}

/** Adrenaline cost with FoD Necrosis discount (and LD-resolved FoD). */
export function necroAdrenalineCost(ability: AbilitySpec, necro: NecroRotationState, tick: number): number {
  if (ability.style !== "necromancy") return ability.adrenaline?.cost ?? 0;
  if (ability.id === "finger_of_death") {
    return (
      fingerOfDeath({
        necrosisStacks: necro.necrosisStacks,
        livingDeath: livingDeathActive(necro, tick),
      }).adrenaline?.cost ?? 0
    );
  }
  return ability.adrenaline?.cost ?? 0;
}

/** Soul Strike / Volley soul gate. Non-necro and non-soul spends always pass. */
export function necroCanCast(ability: AbilitySpec, necro: NecroRotationState): boolean {
  if (ability.style !== "necromancy") return true;
  const n = ability as NecromancyAbilitySpec;
  if (n.id === "volley_of_souls") return necro.residualSouls >= VOLLEY_MIN_SOULS;
  const cost = n.soulCost ?? 0;
  return cost <= 0 || necro.residualSouls >= cost;
}

/**
 * Resource + Living Death transitions for one successful necromancy cast.
 *
 * Order: gains → spends → Living Death activate + ToD/DS CD clear list → ToD LD adren bonus.
 * Ability adrenaline gain/cost stays in simulate; only the +6% ToD Living Death
 * bonus is returned here as adrenalineBonus.
 *
 * Wire from createCastContext.performCast after adren accounting:
 *   const patch = applyNecroOnCast(state.necro, ability, readyTick);
 *   state = { ...state, necro: patch.necro, adrenaline: gain(adren, patch.adrenalineBonus), ...clear CDs };
 */
export function applyNecroOnCast(
  necroIn: NecroRotationState,
  ability: AbilitySpec,
  castTick: number,
): NecroOnCastPatch {
  if (ability.style !== "necromancy") {
    return { necro: necroIn, adrenalineBonus: 0, clearCooldownIds: [] };
  }

  const spec = ability as NecromancyAbilitySpec;
  let necro = { ...necroIn };
  let adrenalineBonus = 0;
  let clearCooldownIds: string[] = [];
  const underLd = livingDeathActive(necro, castTick);

  // --- gains ---
  let necrosisGain = spec.necrosisGain ?? 0;
  if (underLd && (spec.autoAttack || spec.id === "necromancy_basic")) {
    necrosisGain += LIVING_DEATH_BASIC_NECROSIS;
  }
  if (necrosisGain > 0) {
    necro = {
      ...necro,
      necrosisStacks: Math.min(NECROSIS_CAP, necro.necrosisStacks + necrosisGain),
    };
  }
  if (spec.soulGain) {
    necro = {
      ...necro,
      residualSouls: Math.min(residualSoulCapFor(necro), necro.residualSouls + spec.soulGain),
    };
  }

  // --- spends ---
  if (spec.id === "finger_of_death") {
    necro = {
      ...necro,
      necrosisStacks: Math.max(0, necro.necrosisStacks - FINGER_OF_DEATH_MAX_STACKS),
    };
  } else if (spec.id === "death_grasp") {
    necro = { ...necro, necrosisStacks: 0 };
  } else if (spec.id === "volley_of_souls") {
    necro = { ...necro, residualSouls: 0 };
  } else if (spec.soulCost && spec.soulCost > 0) {
    necro = {
      ...necro,
      residualSouls: Math.max(0, necro.residualSouls - spec.soulCost),
    };
  }

  // --- Living Death cast ---
  if (spec.buff === "living_death") {
    necro = activateLivingDeath(necro, castTick);
    clearCooldownIds = ["touch_of_death", "death_skulls"];
  }

  // ToD under LD: +6% adrenaline (wiki).
  if (underLd && spec.id === "touch_of_death") {
    adrenalineBonus = TOUCH_OF_DEATH_LIVING_DEATH_ADRENALINE_BONUS;
  }

  return { necro, adrenalineBonus, clearCooldownIds };
}

export const LIVING_DEATH_SOURCE: SourceReference = LIVING_DEATH_WIKI;
export const NECRO_RESOURCE_SOURCES = {
  residualSouls: RESIDUAL_SOUL_WIKI,
  necrosis: NECROSIS_WIKI,
  livingDeath: LIVING_DEATH_WIKI,
  modernisation: MODERNISATION_WIKI,
} as const;

export {
  FINGER_OF_DEATH_LIVING_DEATH_MULT,
  LIVING_DEATH_BASIC_NECROSIS,
  LIVING_DEATH_DURATION_SECONDS,
  TOUCH_OF_DEATH_LIVING_DEATH_ADRENALINE_BONUS,
  TOUCH_OF_DEATH_NECROSIS,
  DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS,
};
