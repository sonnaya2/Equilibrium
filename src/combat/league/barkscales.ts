import type { SourceReference } from "../types";
import type { BlessingChoice } from "../../league/blessings";
import {
  isNonNegativeFinite,
  isPositiveFinite,
} from "../shared/domainValidators";

/**
 * Barkscales is the one revealed blessing whose damage is driven by incoming
 * combat: "Incoming damage is reduced by 10% of your armour value. After
 * Barkscales reduces damage 5 times, unleash a Grasp of Guthix at your
 * attacker's location, which deals poison damage equal to 80-120% of your
 * ability damage in a 3x3 area."
 *
 * An outgoing rotation has no enemy attack timeline, so the trigger rate is not
 * derivable from anything the calculator already knows. Rather than a boss
 * simulator, the model takes one bounded scenario — how often a qualifying
 * incoming hit lands — and reports the counter arithmetic that follows from it.
 * With no scenario the result is explicitly unavailable and names the inputs it
 * is missing; it is never a calculated zero.
 *
 * Provisional until incoming combat can be tested: which incoming events
 * advance the counter (a hit fully absorbed by the reduction, a blocked hit, or
 * several hits landing on one tick), whether the counter resets to zero or
 * carries overflow, and whether every tile of the 3x3 takes a separate hit.
 * The model exposes the counter so those questions stay visible rather than
 * being buried in an averaged damage figure.
 */
export const BARKSCALES_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Barkscales",
  title: "Barkscales",
  verifiedAt: "2026-08-02",
};

export interface BarkscalesScenario {
  /**
   * Seconds between incoming hits that are big enough for the reduction to
   * apply. Absent or non-positive means no scenario has been stated.
   */
  incomingHitIntervalSeconds?: number;
  /** Tiles of the 3x3 that actually contain a target; 1 for a lone single-tile enemy. */
  targetsStruck?: number;
  /** Poison-immune targets take no Grasp damage. */
  poisonImmune?: boolean;
}

export type BarkscalesSupport = "scenario-dependent" | "modeled";

/** Why trigger/damage figures are withheld — never encode that as a calculated 0. */
export type BarkscalesUnavailability =
  | "no-scenario"
  | "invalid-interval"
  | "invalid-duration"
  | "poison-immune"
  | "zero-targets";

export interface BarkscalesReduction {
  /** Damage removed from each qualifying incoming hit: 10% of the armour value. */
  perHit: number;
  /** Reductions needed for one Grasp of Guthix. */
  hitsPerTrigger: number;
}

export interface BarkscalesOutcome extends BarkscalesReduction {
  support: BarkscalesSupport;
  /** Null when the outcome is fully modeled; otherwise the closed reason set. */
  unavailability: BarkscalesUnavailability | null;
  /** Inputs the outgoing rotation cannot supply; empty once a scenario is stated. */
  missingInputs: readonly string[];
  /** Qualifying incoming hits over the window, or null when unavailable. */
  qualifyingHits: number | null;
  /** Grasp triggers over the window, or null when unavailable — never a fake zero. */
  triggers: number | null;
  /** Reductions banked toward the next trigger at the end of the window. */
  counterRemainder: number | null;
  /** Seconds between triggers, or null when unavailable. */
  secondsPerTrigger: number | null;
  /** Targets each Grasp damages; 0 when poison-immune or zero-targets. */
  targetsStruck: number;
  /** Total mitigated damage over the window, or null when unavailable. */
  mitigatedDamage: number | null;
}

export const BARKSCALES_HITS_PER_TRIGGER = 5;

/**
 * User-facing Grasp / scenario note. Never presents unavailable damage as a
 * calculated zero: missing inputs and poison/zero-target states name the gap.
 */
export function barkscalesGraspNote(outcome: BarkscalesOutcome): string {
  if (outcome.support === "scenario-dependent" || outcome.unavailability === "no-scenario") {
    const need =
      outcome.missingInputs.length > 0
        ? outcome.missingInputs.join(", ").toLowerCase()
        : "incoming scenario inputs";
    return `No outgoing damage calculated — needs ${need}`;
  }
  if (outcome.unavailability === "invalid-interval") {
    return "No outgoing damage calculated — invalid incoming-hit interval";
  }
  if (outcome.unavailability === "invalid-duration") {
    return "No outgoing damage calculated — invalid scenario duration";
  }
  if (outcome.unavailability === "poison-immune") {
    return "Grasp of Guthix unavailable — target is poison-immune (mitigation counter still advances)";
  }
  if (outcome.unavailability === "zero-targets") {
    return "Grasp of Guthix unavailable — no valid targets in the 3×3";
  }
  // Fully modeled: triggers is a real count, but still scenario-only (not rotation DPM).
  return `${outcome.triggers} Grasp triggers · one per ${outcome.secondsPerTrigger}s (scenario only — not in rotation damage)`;
}

function unavailable(
  base: BarkscalesReduction,
  reason: BarkscalesUnavailability,
  targetsStruck: number,
  missingInputs: readonly string[] = [],
): BarkscalesOutcome {
  return {
    support: "scenario-dependent",
    unavailability: reason,
    missingInputs,
    ...base,
    qualifyingHits: null,
    triggers: null,
    counterRemainder: null,
    secondsPerTrigger: null,
    targetsStruck,
    mitigatedDamage: null,
  };
}

/**
 * Resolve Barkscales for one bounded incoming scenario. `armour` is the
 * player's total Armour stat, never the block armour rating: the card says
 * "10% of your armour value".
 */
export function barkscalesOutcome(
  rule: BlessingChoice["combat"] | undefined,
  armour: number,
  windowSeconds: number,
  scenario: BarkscalesScenario = {},
): BarkscalesOutcome {
  const hitsPerTrigger = rule?.barkscales?.reductionsPerTrigger ?? BARKSCALES_HITS_PER_TRIGGER;
  const perHit = Math.floor(Math.max(0, armour) * (rule?.barkscales?.armourReductionPercent ?? 0));
  const base: BarkscalesReduction = { perHit, hitsPerTrigger };

  const interval = scenario.incomingHitIntervalSeconds;
  if (interval === undefined) {
    return unavailable(base, "no-scenario", 0, ["Incoming qualifying-hit interval"]);
  }
  if (!isPositiveFinite(interval)) {
    return unavailable(base, "invalid-interval", 0, ["Incoming qualifying-hit interval"]);
  }
  if (!isNonNegativeFinite(windowSeconds)) {
    return unavailable(base, "invalid-duration", 0, ["Scenario window duration"]);
  }

  const poisonImmune = scenario.poisonImmune === true;

  const rawTargets = scenario.targetsStruck;
  let targetsStruck: number;
  if (poisonImmune) {
    targetsStruck = 0;
  } else if (rawTargets === undefined) {
    targetsStruck = 1;
  } else if (!isNonNegativeFinite(rawTargets)) {
    return unavailable(base, "zero-targets", 0);
  } else {
    targetsStruck = Math.floor(rawTargets);
  }
  if (!poisonImmune && targetsStruck <= 0) {
    return unavailable(base, "zero-targets", 0);
  }

  const qualifyingHits = Math.floor(windowSeconds / interval);
  return {
    support: "modeled",
    unavailability: poisonImmune ? "poison-immune" : targetsStruck === 0 ? "zero-targets" : null,
    missingInputs: [],
    ...base,
    qualifyingHits,
    triggers: Math.floor(qualifyingHits / hitsPerTrigger),
    // The counter is provisionally read as resetting to zero, so the remainder
    // is what has been banked since the last trigger rather than an overflow.
    counterRemainder: qualifyingHits % hitsPerTrigger,
    secondsPerTrigger: interval * hitsPerTrigger,
    targetsStruck,
    mitigatedDamage: perHit * qualifyingHits,
  };
}
