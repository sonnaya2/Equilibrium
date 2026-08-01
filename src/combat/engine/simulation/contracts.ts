import type { CritLayers } from "../../core/critical";
import type { HitCapRule } from "../../core/hitCaps";
import type { AbilityResult, AbilitySpec } from "../../pipeline/calculateAbility";
import type { CombatContext, CombatModifier } from "../../types";
import type { ResolvedEvent } from "../runtime/events";
import type { RotationState } from "../runtime/state";

/** One queued cast; the simulator advances to its first legal tick. */
export interface RotationAction {
  abilityId: string;
}

export function rotationOf(...abilityIds: string[]): RotationAction[] {
  return abilityIds.map((abilityId) => ({ abilityId }));
}

export interface AdrenalineRules {
  basicGainMultiplier?: number;
  /** Impatient perk rank (1-4) — state-changing RNG, branched by the drivers. */
  impatientRank?: number;
  impatientLevel20?: boolean;
  /** Relentless perk rank (1-5) — state-changing RNG, branched by the drivers. */
  relentlessRank?: number;
  relentlessLevel20?: boolean;
}

/**
 * Explicit outcomes for a cast's state-changing RNG points. The drivers
 * enumerate these to build probability-weighted branches; a missing flag means
 * "does not proc" (deterministic single-branch runs never proc).
 */
export interface CastRng {
  impatientProc?: boolean;
  relentlessProc?: boolean;
}

export interface ProcRules {
  cracklingRank?: number;
  aftershockRank?: number;
}

export interface SimulateInput {
  base: number;
  level: number;
  accuracy: number;
  crit: Omit<CritLayers, "eligible">;
  abilities: readonly AbilitySpec[];
  rotation: readonly RotationAction[];
  modifiers?: CombatModifier[] | ((ability: AbilitySpec) => CombatModifier[]);
  context?: CombatContext;
  cap?: HitCapRule;
  /** Adrenaline available before the first cast. */
  startingAdrenaline?: number;
  /** Equipped catalogue ids used by mechanics with verified item requirements. */
  equipmentIds?: readonly string[];
  weaponConfiguration?: "twohand" | "dualwield" | "mainhand" | "necromancy";
  /** Puncture damage is outside the current model. */
  ammo?: "deathspore" | "splintering";
  /** Weave the style auto-attack through idle GCDs and adrenaline shortfalls. */
  autoWeave?: boolean;
  adrenaline?: AdrenalineRules;
  /**
   * Planted Feet: base Sunshine / Death's Swiftness duration ×1.25 (→ 63 ticks).
   * Does not apply to greater variants.
   */
  plantedFeet?: boolean;
  procs?: ProcRules;
  /**
   * Mult on conjure spirit *basic autos* only (not putrid poison, not commands).
   * First Necromancer set: firstNecromancerConjureDamageMult(pieces). Default 1.
   */
  conjureBasicDamageMult?: number;
  /**
   * Target life-points percentage (0-100) for target-HP-dependent mechanics
   * (Bloodlust-empowered Flurry, Punish, Spectral Scythe). When absent those
   * mechanics apply no HP-scaled bonus and stay partially modeled — no default
   * is invented.
   */
  targetHpPercent?: number;
}

export interface SimulateOptions {
  /**
   * Also compute `totalExpectedIncludingTails`: in-horizon damage plus the
   * still-scheduled (unlanded) tails of casts begun inside the horizon.
   */
  includeTails?: boolean;
}

/** createCastContext input: rotation/autoWeave belong to the manual driver only. */
export type CastContextInput = Omit<SimulateInput, "rotation" | "autoWeave"> & {
  horizonTicks?: number;
};

export interface CastRecord {
  tick: number;
  abilityId: string;
  result: AbilityResult;
  adrenalineAfter: number;
  adrenalineBefore: number;
  listedCost: number;
  effectiveCost: number;
  actualSpend: number;
  refund: number;
  adrenalineGained: number;
  /** Woven basic-attack cast, not part of the queued rotation. */
  auto?: boolean;
}

export interface RotationSummary {
  ok: boolean;
  error?: string;
  casts: CastRecord[];
  /** Elapsed ticks: last cast's occupancy end, or the damage tail if it outlasts it. */
  ticks: number;
  /**
   * Horizon the run was asked to fill (revolution duration). When set, totals
   * count only events landing before it (half-open [0, horizonTicks)) and
   * `dps` is totalExpected / (horizonTicks * tickSeconds).
   */
  horizonTicks?: number;
  totalMin: number;
  totalMax: number;
  totalExpected: number;
  dps: number;
  metric: {
    type: "fixed-window" | "natural-completion";
    denominatorTicks: number;
    damageCounted: number;
    tails: "excluded" | "included-separately" | "included-in-natural-completion";
  };
  perAbility: Record<string, number>;
  /** Expected damage landing on each tick — DoT tails land on their sourced ticks. */
  damageByTick: Record<number, number>;
  /** Every landed event in (tick, seq) order, with provenance and land-time damage. */
  events: ResolvedEvent[];
  /**
   * Opt-in second metric (SimulateOptions.includeTails): in-horizon damage plus
   * the unlanded scheduled tails of casts begun inside the horizon.
   * Never presented as fixed-window DPS.
   */
  totalExpectedIncludingTails?: number;
  postWindowTailDamage?: number;
  /**
   * Present only when state-changing RNG perks (Impatient / Relentless) forced
   * probability-weighted branching: totals are branch-weighted means, while
   * `casts` and `events` show the modal (highest-weight) branch's trajectory.
   */
  rng?: {
    method: "probability-weighted branching";
    branches: number;
    /** Combined weight of branches that ended in a cast error (ok is then false). */
    failedWeight?: number;
  };
}

export type CastAttempt = { ok: true } | { ok: false; error: string };

export interface CastContext {
  getState(): RotationState;
  costOf(ability: AbilitySpec): number;
  firstLegalTick(abilityId: string): number;
  /**
   * The one canonical time path: lands every queued event due by targetTick in
   * (tick, seq) order (damage resolved against state at each land tick), applies
   * passive generation over the crossed interval, expires crossed clocks, and
   * stops with state representing exactly targetTick.
   */
  advanceTo(targetTick: number): void;
  /**
   * One atomic cast transition: advance to the candidate tick, re-check
   * requirements/affordability against the advanced state (rejection leaves the
   * state otherwise untouched), resolve the empowered variant, start the
   * cooldown and occupancy, schedule hit events with provenance, then apply
   * immediate on-cast grants/windows.
   */
  performCast(ability: AbilitySpec, readyTick: number, auto: boolean, rng?: CastRng): CastAttempt;
  /** Off-GCD utility casts (Runic Charge): state-machine update and a cast record
   *  without consuming or advancing the global cooldown. */
  performOffGcdCast(ability: AbilitySpec): void;
  /** Remove a cast's pending events (channel cancellation); returns the count. */
  cancelCastEvents(castSeq: number): number;
  finish(error?: string, horizonTicks?: number, options?: SimulateOptions): RotationSummary;
  byId: Map<string, AbilitySpec>;
  basicByStyle: Map<AbilitySpec["style"], AbilitySpec>;
}
