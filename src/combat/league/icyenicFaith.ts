import type { SourceReference } from "../types";

/**
 * Icyenic Faith (Equilibrium T7 relic) + Tome of the Icyene.
 * https://runescape.wiki/w/Icyenic_Faith
 *
 * Product interpretation:
 *   totalPrayerBonus = equipment prayer (includes tome face +50 when worn)
 *   critChanceBonus = totalPrayer * 0.002
 *   baseAbilityDamageMultiplier = 1 + totalPrayer * 0.002
 * Scaling requires the relic active and the Tome worn. Protect / Soul Split
 * side-effects use scenario helpers (Barkscales lane), not a full tank sim.
 */

export const ICYENIC_FAITH_RELIC = "Icyenic Faith";
export const TOME_OF_THE_ICYENE_ID = "item:tome-of-the-icyene";
/** Face Prayer bonus on the Tome while worn (wiki). */
export const TOME_OF_THE_ICYENE_PRAYER = 50;
/** 0.2 percentage points crit / 0.2% base AD per Prayer point. */
export const ICYENIC_PER_PRAYER = 0.002;
/** Soul Split baseline heal fraction of damage dealt (wiki); provisional under protect. */
export const SOUL_SPLIT_HEAL_FRACTION = 0.1;

export const ICYENIC_FAITH_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Icyenic_Faith",
  title: "Icyenic Faith",
  verifiedAt: "2026-08-02",
};

export interface IcyenicFaithBonuses {
  totalPrayerBonus: number;
  critChanceBonus: number;
  baseAbilityDamageBonus: number;
  baseAbilityDamageMultiplier: number;
}

export function icyenicFaithActive(
  relics: readonly string[] | ReadonlySet<string> | undefined,
): boolean {
  if (!relics) return false;
  for (const name of relics) {
    if (name === ICYENIC_FAITH_RELIC) return true;
  }
  return false;
}

export function isTomeOfTheIcyeneWorn(equipmentIds: readonly string[] | undefined): boolean {
  return equipmentIds?.includes(TOME_OF_THE_ICYENE_ID) === true;
}

/**
 * Prayer used for Icyenic scaling. equipmentPrayer is the aggregate from equipped
 * gear (Tome face prayer is already inside that sum when worn). Zero when the
 * relic is off or the Tome is not worn.
 */
export function icyenicScalingPrayer(
  equipmentPrayer: number,
  opts: { relicActive: boolean; tomeWorn: boolean },
): number {
  if (!opts.relicActive || !opts.tomeWorn) return 0;
  return Math.max(0, equipmentPrayer);
}

export function icyenicFaithBonuses(totalPrayerBonus: number): IcyenicFaithBonuses {
  const p = Math.max(0, totalPrayerBonus);
  const bonus = p * ICYENIC_PER_PRAYER;
  return {
    totalPrayerBonus: p,
    critChanceBonus: bonus,
    baseAbilityDamageBonus: bonus,
    baseAbilityDamageMultiplier: 1 + bonus,
  };
}

export function resolveIcyenicFaithBonuses(
  equipmentPrayer: number,
  opts: { relicActive: boolean; tomeWorn: boolean },
): IcyenicFaithBonuses {
  return icyenicFaithBonuses(icyenicScalingPrayer(equipmentPrayer, opts));
}

/** Protect / deflect style coverage for scenario notes (not a full protect model). */
export type ProtectionPrayerStyle =
  | "none"
  | "melee"
  | "ranged"
  | "magic"
  | "necromancy"
  | "summoning";

export interface IcyenicProtectionScenario {
  /** Player has a protect prayer or deflection curse active. */
  protectionActive?: boolean;
  /** Optional style the protect covers; unused for 100% block magnitude. */
  protectionStyle?: ProtectionPrayerStyle;
  incomingHitIntervalSeconds?: number;
  /** Assumed hit size for mitigated-total estimates; absent => counts only. */
  incomingHitDamage?: number;
}

export type IcyenicProtectionSupport = "inactive" | "scenario-dependent" | "modeled";

export type IcyenicProtectionUnavailability =
  | "relic-inactive"
  | "protection-off"
  | "no-scenario"
  | "invalid-interval"
  | "invalid-duration";

export interface IcyenicProtectionOutcome {
  support: IcyenicProtectionSupport;
  unavailability: IcyenicProtectionUnavailability | null;
  missingInputs: readonly string[];
  /** Fraction of incoming damage blocked while protect is up (1.0 with Icyenic). */
  blockFraction: number;
  qualifyingHits: number | null;
  mitigatedDamage: number | null;
}

export function icyenicProtectionOutcome(
  opts: {
    relicActive: boolean;
    windowSeconds: number;
    scenario?: IcyenicProtectionScenario;
  },
): IcyenicProtectionOutcome {
  if (!opts.relicActive) {
    return {
      support: "inactive",
      unavailability: "relic-inactive",
      missingInputs: [],
      blockFraction: 0,
      qualifyingHits: null,
      mitigatedDamage: null,
    };
  }
  const scenario = opts.scenario ?? {};
  if (scenario.protectionActive !== true) {
    return {
      support: "scenario-dependent",
      unavailability: "protection-off",
      missingInputs: ["protection prayer or deflection curse"],
      blockFraction: 1,
      qualifyingHits: null,
      mitigatedDamage: null,
    };
  }
  const interval = scenario.incomingHitIntervalSeconds;
  if (interval == null || !Number.isFinite(interval) || interval <= 0) {
    return {
      support: "scenario-dependent",
      unavailability: "no-scenario",
      missingInputs: ["incoming hit interval"],
      blockFraction: 1,
      qualifyingHits: null,
      mitigatedDamage: null,
    };
  }
  if (!Number.isFinite(opts.windowSeconds) || opts.windowSeconds <= 0) {
    return {
      support: "scenario-dependent",
      unavailability: "invalid-duration",
      missingInputs: [],
      blockFraction: 1,
      qualifyingHits: null,
      mitigatedDamage: null,
    };
  }
  if (interval > 3600) {
    return {
      support: "scenario-dependent",
      unavailability: "invalid-interval",
      missingInputs: [],
      blockFraction: 1,
      qualifyingHits: null,
      mitigatedDamage: null,
    };
  }
  const qualifyingHits = Math.floor(opts.windowSeconds / interval);
  const hitDamage = scenario.incomingHitDamage;
  const mitigatedDamage =
    hitDamage != null && Number.isFinite(hitDamage) && hitDamage >= 0
      ? Math.floor(qualifyingHits * hitDamage * 1)
      : null;
  return {
    support: "modeled",
    unavailability: null,
    missingInputs: mitigatedDamage == null ? ["incoming hit damage"] : [],
    blockFraction: 1,
    qualifyingHits,
    mitigatedDamage,
  };
}

export function icyenicProtectionNote(outcome: IcyenicProtectionOutcome): string {
  if (outcome.unavailability === "relic-inactive") {
    return "Icyenic Faith not selected";
  }
  if (outcome.unavailability === "protection-off") {
    return "Protect / deflect off - enable a protection prayer for 100% block";
  }
  if (outcome.unavailability === "no-scenario") {
    return "100% protect block active - set incoming hit interval to quantify mitigation";
  }
  if (outcome.unavailability === "invalid-interval") {
    return "Invalid incoming-hit interval for Icyenic protection scenario";
  }
  if (outcome.unavailability === "invalid-duration") {
    return "Invalid scenario duration for Icyenic protection";
  }
  if (outcome.mitigatedDamage != null) {
    return `100% protect block · ${outcome.qualifyingHits} hits · ${outcome.mitigatedDamage} mitigated (scenario)`;
  }
  return `100% protect block · ${outcome.qualifyingHits} hits over window (hit size unset)`;
}

/**
 * Protect/deflect act as Soul Split while Icyenic Faith is active.
 * Heal estimate from expected damage dealt (outgoing), not a sim heal event.
 */
export function icyenicSoulSplitHeal(
  expectedDamageDealt: number,
  opts: { relicActive: boolean; protectionActive: boolean },
): number | null {
  if (!opts.relicActive || !opts.protectionActive) return null;
  if (!Number.isFinite(expectedDamageDealt) || expectedDamageDealt < 0) return null;
  return Math.floor(expectedDamageDealt * SOUL_SPLIT_HEAL_FRACTION);
}

export function icyenicSoulSplitNote(
  heal: number | null,
  opts: { relicActive: boolean; protectionActive: boolean },
): string {
  if (!opts.relicActive) return "Icyenic Faith not selected";
  if (!opts.protectionActive) {
    return "Protect / deflect off - no Soul Split-on-protect heal";
  }
  if (heal == null) return "Soul Split-on-protect ready - needs expected damage dealt";
  return `Soul Split-on-protect · ~${heal} heal from damage dealt (10%, provisional)`;
}
