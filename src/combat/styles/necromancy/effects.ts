import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { secondsToTicks } from "../../core/ticks";
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
  isNecromancyAbility,
  volleyOfSouls,
} from "./abilities";
import { FINGER_OF_DEATH_MAX_STACKS, NECROSIS_CAP, TOUCH_OF_DEATH_NECROSIS } from "./necrosis";
import { RESIDUAL_SOUL_CAP, SOULBOUND_LANTERN_BONUS_CAP } from "./souls";
import {
  applyConjureCast,
  COMMAND_REQUIRES_CONJURE,
  conjureCanCast,
  dismissConjure,
  newConjures,
  type ConjureState,
} from "./conjures";

/**
 * Necromancy state limits verified on 2026-07-26:
 *   residualSouls  0..3 (0..5 with soulbound lantern)
 *   necrosisStacks 0..12
 *   livingDeath    30s / 50 ticks from cast tick (active while tick < until)
 *
 * Living Death grants +2 Necrosis on basics, +6% adrenaline on Touch of Death,
 * 1.5× Finger of Death damage, and a 17-tick Death Skulls cooldown.
 * Spectral Scythe soul chance is excluded from the deterministic simulation.
 */

export interface NecroRotationState {
  residualSouls: number;
  necrosisStacks: number;
  /** Exclusive end tick; 0 = inactive. Active when tick < livingDeathUntilTick. */
  livingDeathUntilTick: number;
  /** Soulbound lantern: residual soul cap 3 → 5. */
  lantern: boolean;
  /** Exclusive stage windows for Spectral Scythe's second and third casts. */
  spectralScythe2UntilTick: number;
  spectralScythe3UntilTick: number;
}

/** Result of a necro cast's resource side-effects (merge into RotationState). */
export interface NecroOnCastPatch {
  necro: NecroRotationState;
  /** Extra adrenaline beyond the ability's listed gain (ToD under LD = +6). */
  adrenalineBonus: number;
  /** Cooldown ids to clear (Living Death resets Touch of Death + Death Skulls). */
  clearCooldownIds: readonly string[];
  /** Updated conjure set when this cast summons or dismisses spirits. */
  conjures?: ConjureState;
}

export function newNecroRotationState(opts: { lantern?: boolean } = {}): NecroRotationState {
  return {
    residualSouls: 0,
    necrosisStacks: 0,
    livingDeathUntilTick: 0,
    lantern: opts.lantern ?? false,
    spectralScythe2UntilTick: 0,
    spectralScythe3UntilTick: 0,
  };
}

/** Every mutable necromancy state the simulation carries between casts. */
export interface NecromancyRotationState {
  /** Residual souls, Necrosis stacks, Living Death window. */
  resources: NecroRotationState;
  /** Active conjured spirits and their schedulers. */
  conjures: ConjureState;
}

export const newNecromancyRotationState = (
  opts: { lantern?: boolean } = {},
): NecromancyRotationState => ({
  resources: newNecroRotationState(opts),
  conjures: newConjures(),
});

export function residualSoulCapFor(necro: NecroRotationState): number {
  return RESIDUAL_SOUL_CAP + (necro.lantern ? SOULBOUND_LANTERN_BONUS_CAP : 0);
}

export function livingDeathActive(necro: NecroRotationState, tick: number): boolean {
  return necro.livingDeathUntilTick > 0 && tick < necro.livingDeathUntilTick;
}

export function activateLivingDeath(
  necro: NecroRotationState,
  castTick: number,
): NecroRotationState {
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
export function necroAdrenalineCost(
  ability: AbilitySpec,
  necro: NecroRotationState,
  tick: number,
): number {
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

export function necroCanCast(
  ability: AbilitySpec,
  necro: NecroRotationState,
  conjures?: ConjureState,
  tick = 0,
): boolean {
  if (!isNecromancyAbility(ability)) return true;
  if (ability.id === "spectral_scythe_2" && tick >= necro.spectralScythe2UntilTick) return false;
  if (ability.id === "spectral_scythe_3" && tick >= necro.spectralScythe3UntilTick) return false;
  if (ability.id === "volley_of_souls") {
    if (necro.residualSouls < VOLLEY_MIN_SOULS) return false;
  } else {
    const cost = ability.soulCost ?? 0;
    if (cost > 0 && necro.residualSouls < cost) return false;
  }
  if (conjures !== undefined) {
    if (!conjureCanCast(ability.id, conjures, tick)) return false;
  } else if (COMMAND_REQUIRES_CONJURE[ability.id]) {
    return false;
  }
  return true;
}

export function applyNecroOnCast(
  necroIn: NecroRotationState,
  ability: AbilitySpec,
  castTick: number,
  conjuresIn?: ConjureState,
  conjureDurationMult = 1,
): NecroOnCastPatch {
  if (!isNecromancyAbility(ability)) {
    return { necro: necroIn, adrenalineBonus: 0, clearCooldownIds: [] };
  }

  let necro = { ...necroIn };
  let adrenalineBonus = 0;
  let clearCooldownIds: string[] = [];
  let conjures = conjuresIn;
  const underLd = livingDeathActive(necro, castTick);

  let necrosisGain = ability.necrosisGain ?? 0;
  if (underLd && (ability.autoAttack || ability.id === "necromancy_basic")) {
    necrosisGain += LIVING_DEATH_BASIC_NECROSIS;
  }
  if (necrosisGain > 0) {
    necro = {
      ...necro,
      necrosisStacks: Math.min(NECROSIS_CAP, necro.necrosisStacks + necrosisGain),
    };
  }
  if (ability.soulGain) {
    necro = {
      ...necro,
      residualSouls: Math.min(residualSoulCapFor(necro), necro.residualSouls + ability.soulGain),
    };
  }

  if (ability.id === "finger_of_death") {
    necro = {
      ...necro,
      necrosisStacks: Math.max(0, necro.necrosisStacks - FINGER_OF_DEATH_MAX_STACKS),
    };
  } else if (ability.id === "death_grasp") {
    necro = { ...necro, necrosisStacks: 0 };
  } else if (ability.id === "volley_of_souls") {
    necro = { ...necro, residualSouls: 0 };
  } else if (ability.soulCost && ability.soulCost > 0) {
    necro = {
      ...necro,
      residualSouls: Math.max(0, necro.residualSouls - ability.soulCost),
    };
  }

  if (ability.stateEffect === "living_death") {
    necro = activateLivingDeath(necro, castTick);
    clearCooldownIds = ["touch_of_death", "death_skulls"];
  }

  const scytheWindow = 25;
  if (ability.id === "spectral_scythe") {
    necro = {
      ...necro,
      spectralScythe2UntilTick: castTick + scytheWindow,
      spectralScythe3UntilTick: 0,
    };
  } else if (ability.id === "spectral_scythe_2") {
    necro = {
      ...necro,
      spectralScythe2UntilTick: 0,
      spectralScythe3UntilTick: castTick + scytheWindow,
    };
  } else if (ability.id === "spectral_scythe_3") {
    necro = { ...necro, spectralScythe2UntilTick: 0, spectralScythe3UntilTick: 0 };
  }

  if (conjures !== undefined) {
    const afterSummon = applyConjureCast(conjures, ability.id, castTick, conjureDurationMult);
    if (afterSummon !== conjures) conjures = afterSummon;
    if (ability.id === "command_putrid_zombie") {
      conjures = dismissConjure(conjures, "putrid_zombie");
    }
  }

  if (underLd && ability.id === "touch_of_death") {
    adrenalineBonus = TOUCH_OF_DEATH_LIVING_DEATH_ADRENALINE_BONUS;
  }

  return {
    necro,
    adrenalineBonus,
    clearCooldownIds,
    ...(conjures !== undefined ? { conjures } : {}),
  };
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
