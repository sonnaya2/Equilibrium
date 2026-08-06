import type { SourceReference } from "../types";
import type { BlessingChoice } from "../../league/blessings";
import { isNonNegativeFinite, isPositiveFinite } from "../shared/domainValidators";

/**
 * Barkscales: reduce incoming by 10% of armour value; after 5 reductions, Grasp of
 * Guthix deals 80-120% ability damage poison in 3x3.
 * https://runescape.wiki/w/Barkscales
 * Outgoing rotations have no attack timeline: needs a scenario (incoming-hit interval).
 * Without one, result is unavailable (not a calculated 0). Provisional: which hits
 * advance the counter, reset vs overflow, per-tile 3x3 hits.
 */
export const BARKSCALES_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Barkscales",
  title: "Barkscales",
  verifiedAt: "2026-08-02",
};

export interface BarkscalesScenario {
  /** Seconds between qualifying incoming hits. Absent/non-positive = no scenario. */
  incomingHitIntervalSeconds?: number;
  /** Tiles of the 3x3 that actually contain a target; 1 for a lone single-tile enemy. */
  targetsStruck?: number;
  /** Poison-immune targets take no Grasp damage. */
  poisonImmune?: boolean;
}

export type BarkscalesSupport = "scenario-dependent" | "modeled";

/** Why trigger/damage figures are withheld - never encode that as a calculated 0. */
export type BarkscalesUnavailability =
  "no-scenario" | "invalid-interval" | "invalid-duration" | "poison-immune" | "zero-targets";

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
  /** Grasp triggers over the window, or null when unavailable. */
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

/** User-facing Grasp / scenario note; gaps named, never encode unavailability as 0. */
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
 * Resolve Barkscales for one incoming scenario.
 * `armour` is total Armour stat (card: "10% of your armour value"), not block rating.
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
    targetsStruck = Math.min(
      rule?.barkscales?.graspAreaTiles ?? Math.floor(rawTargets),
      Math.floor(rawTargets),
    );
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
    // Provisional: counter resets to 0; remainder is banked since last trigger, not overflow.
    counterRemainder: qualifyingHits % hitsPerTrigger,
    secondsPerTrigger: interval * hitsPerTrigger,
    targetsStruck,
    mitigatedDamage: perHit * qualifyingHits,
  };
}
