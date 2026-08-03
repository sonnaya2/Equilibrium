/**
 * Canonical normalized solve / evaluation identity.
 *
 * One normalized representation of a SerializableSolverRequest; purpose-specific
 * fingerprints (solve job vs evaluation memo) are derived from slices of it.
 * Do not hand-pick ad-hoc field lists at call sites — extend this module.
 */

import type { HitCapRule } from "../core/hitCaps";
import type { ActiveEquipmentEffects } from "../shared/equipment";
import type { CombatContext } from "../types";
import {
  OBJECTIVE_VERSION,
  SOLVER_SCHEMA_VERSION,
  type ProofLabel,
} from "./contracts";
import {
  isSerializableSimBase,
  type SerializableModifierSources,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
  type SolverResultDTO,
} from "./worker/serializable";

/**
 * Bumped when search policy / agent recipes / budget semantics change so that
 * solve-job cache keys cannot reuse bars found under a different search regime.
 * Evaluation identity deliberately omits this.
 */
export const SEARCH_POLICY_VERSION = 1 as const;

/** Proof labels that may enter the verified solve cache. */
export const VERIFIED_CACHEABLE_PROOFS: ReadonlySet<ProofLabel> = new Set([
  "full-objective-global-optimum",
  "full-shortlist-best",
  "heuristic-best-found",
]);

/** Proof labels that must never be treated as a verified final ranking. */
export const NON_CACHEABLE_PROOFS: ReadonlySet<ProofLabel> = new Set([
  "degraded-exploratory-fallback",
  "failed",
  "stopped-early",
  "budget-not-exhausted",
  "search-objective-exhaustive",
  "heuristic-complete",
]);

export function roundN(n: number, places: number): number {
  const p = 10 ** places;
  return Math.round(n * p) / p;
}

function sortedStrings(ids: readonly string[] | undefined | null): string[] {
  return [...(ids ?? [])].map(String).sort((a, b) => a.localeCompare(b));
}

export function normalizeModifierSources(sources: SerializableModifierSources): unknown {
  const setCounts = [...sources.setCounts]
    .map(([id, n]) => [id, n] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  return {
    vulnerability: sources.vulnerability === true,
    styleCurseId: sources.styleCurseId ?? "none",
    amZiFlatDamage: roundN(sources.amZiFlatDamage ?? 0, 4),
    amHejDamageBonus: roundN(sources.amHejDamageBonus ?? 0, 6),
    setCounts,
    slayer: {
      demon: sources.slayer?.demon ?? 0,
      dragon: sources.slayer?.dragon ?? 0,
      undead: sources.slayer?.undead ?? 0,
    },
    target: {
      demon: sources.target?.demon === true,
      dragon: sources.target?.dragon === true,
      undead: sources.target?.undead === true,
    },
    ultimatums: sources.ultimatums ?? 0,
    lunging: sources.lunging ?? 0,
  };
}

export function normalizeEquipmentEffects(effects: ActiveEquipmentEffects): unknown {
  return {
    activation: effects.activation,
    passiveIds: sortedStrings(effects.passiveIds as readonly string[]),
    enchantments: sortedStrings(effects.enchantments as readonly string[]),
    weaponClass: effects.weaponClass ?? null,
    defenderEquipped: effects.defenderEquipped === true,
    passage: {
      active: effects.passage?.active === true,
      agonyActive: effects.passage?.agonyActive === true,
    },
    amZiFlatDamage: roundN(effects.amZiFlatDamage ?? 0, 4),
    amHejDamageBonus: roundN(effects.amHejDamageBonus ?? 0, 6),
    vestments: {
      pieces: effects.vestments?.pieces ?? 0,
      heraldOfChaos: effects.vestments?.heraldOfChaos === true,
      berserkExtension: effects.vestments?.berserkExtension === true,
      increasedAdrenalineCap: effects.vestments?.increasedAdrenalineCap === true,
    },
  };
}

export function normalizeHitCap(cap: HitCapRule | null | undefined): unknown {
  if (!cap) return null;
  return {
    cap: cap.cap,
    bypass: cap.bypass === true,
  };
}

export function normalizeCombatContext(ctx: CombatContext | undefined): unknown {
  if (!ctx) return null;
  return {
    style: ctx.style,
    ruleset: ctx.ruleset ?? null,
    dotKind: ctx.dotKind ?? null,
    abilityCategory: ctx.abilityCategory ?? null,
    autoAttack: ctx.autoAttack === true,
    area: ctx.area ?? null,
    targetTiles: ctx.targetTiles ?? null,
    blessingGenerated: ctx.blessingGenerated === true,
  };
}

/**
 * Exact frozen Powerburst remaining ticks at request freeze.
 * `powerburstUntilTick` on the wire is already sim-relative remaining (0 = off).
 */
export function powerburstRemainingTicksFromRequest(
  loadout: SerializableRevolutionSimBase,
): number {
  return Math.max(0, Math.floor(loadout.league.powerburstUntilTick ?? 0));
}

/** Everything that can change a bar's simulated score under a fixed objective. */
export function canonicalSimulationIdentity(loadout: SerializableRevolutionSimBase): unknown {
  return {
    base: roundN(loadout.base, 3),
    level: loadout.level,
    accuracy: roundN(loadout.accuracy, 6),
    crit: {
      chance: roundN(loadout.crit?.chance ?? 0, 6),
      disabled: loadout.crit?.disabled === true,
      damageBonus: roundN(loadout.crit?.damageBonus ?? 0, 6),
      guaranteed: loadout.crit?.guaranteed === true,
    },
    equipmentIds: sortedStrings(loadout.equipmentIds),
    weaponConfiguration: loadout.weaponConfiguration,
    startingAdrenaline: loadout.startingAdrenaline ?? 0,
    plantedFeet: loadout.plantedFeet === true,
    strengthCape99: loadout.strengthCape99 === true,
    preciseRank: loadout.preciseRank ?? 0,
    conjureBasicDamageMult: roundN(loadout.conjureBasicDamageMult ?? 1, 6),
    conjureDurationMult: roundN(loadout.conjureDurationMult ?? 1, 6),
    tumekensPieces: loadout.tumekensPieces ?? 0,
    tumekensCritEnabled: loadout.tumekensCritEnabled === true,
    targetHpPercent: loadout.targetHpPercent ?? 100,
    cap: normalizeHitCap(loadout.cap),
    adrenaline: loadout.adrenaline
      ? {
          abilityGainMultiplier: roundN(loadout.adrenaline.abilityGainMultiplier ?? 1, 6),
          basicGainMultiplier: roundN(loadout.adrenaline.basicGainMultiplier ?? 1, 6),
          impatientRank: loadout.adrenaline.impatientRank ?? 0,
          impatientLevel20: loadout.adrenaline.impatientLevel20 === true,
          relentlessRank: loadout.adrenaline.relentlessRank ?? 0,
          relentlessLevel20: loadout.adrenaline.relentlessLevel20 === true,
        }
      : null,
    procs: loadout.procs
      ? {
          cracklingRank: loadout.procs.cracklingRank ?? 0,
          aftershockRank: loadout.procs.aftershockRank ?? 0,
        }
      : null,
    league: {
      ruleset: loadout.league.ruleset,
      // Full blessing id set (order-independent).
      blessingIds: sortedStrings(loadout.league.blessingIds as readonly string[]),
      totalArmour: loadout.league.totalArmour,
      maximumLife: loadout.league.maximumLife,
      // Exact remaining ticks — different durations change damage; never collapse to boolean.
      powerburstUntilTick: powerburstRemainingTicksFromRequest(loadout),
      targetTiles: loadout.league.targetTiles,
    },
    modifierSources: normalizeModifierSources(loadout.modifierSources),
    equipmentEffects: normalizeEquipmentEffects(loadout.equipmentEffects),
    context: normalizeCombatContext(loadout.context),
    abilityIds: loadout.abilityIds ? sortedStrings(loadout.abilityIds) : null,
  };
}

/** Objective profile, weights, horizons, size bounds — shared by solve + eval. */
export function canonicalObjectiveIdentity(request: SerializableSolverRequest): unknown {
  return {
    schema: request.schemaVersion ?? SOLVER_SCHEMA_VERSION,
    objectiveVersion: OBJECTIVE_VERSION,
    style: request.style,
    profileId: request.profileId,
    customWeights: request.customWeights ?? null,
    durationTicks: request.durationTicks,
    exploreDurationTicks: request.exploreDurationTicks ?? null,
    includePartial: request.includePartial === true,
    minBarSize: request.minBarSize,
    maxBarSize: request.maxBarSize,
    ruleset: request.ruleset,
    // Path pick sequence (order-sensitive) — full set, not a collapsed god tier.
    blessingPicks: [...(request.blessingPicks ?? [])],
  };
}

/** Pool filters that change which bars are legal / which abilities appear. */
export function canonicalPoolFilterIdentity(request: SerializableSolverRequest): unknown {
  return {
    regions: sortedStrings(request.unlockedRegions as readonly string[]),
    disabled: sortedStrings(request.disabledAbilityIds),
    permittedCategories: request.permittedCategories
      ? sortedStrings(request.permittedCategories as readonly string[])
      : null,
    includeUnknownAvailability: request.includeUnknownAvailability === true,
  };
}

/** Solve-job-only fields: search policy, seed, tier. */
export function canonicalSolveJobExtras(request: SerializableSolverRequest): unknown {
  return {
    tier: request.tier,
    seed: request.seed,
    searchPolicyVersion: SEARCH_POLICY_VERSION,
    pool: canonicalPoolFilterIdentity(request),
  };
}

export interface CanonicalNormalizedIdentity {
  objective: unknown;
  simulation: unknown;
  solveJob: unknown;
  /** Evaluation slice = objective + simulation + pool (no seed / tier / policy). */
  evaluation: unknown;
}

/**
 * Single canonical normalized request representation.
 * Purpose-specific fingerprints pick slices — do not fork field lists elsewhere.
 */
export function canonicalNormalizedIdentity(
  request: SerializableSolverRequest,
): CanonicalNormalizedIdentity {
  const loadout = request.loadout;
  const simulation = isSerializableSimBase(loadout)
    ? canonicalSimulationIdentity(loadout)
    : { kind: "plain", loadout };
  const objective = canonicalObjectiveIdentity(request);
  const solveJob = canonicalSolveJobExtras(request);
  const evaluation = {
    objective,
    simulation,
    pool: canonicalPoolFilterIdentity(request),
  };
  return { objective, simulation, solveJob, evaluation };
}

/**
 * Solve-job identity for persistent solved-bar cache keys.
 * Includes simulation, objective, and search/pool/seed policy.
 */
export function canonicalSolveContext(request: SerializableSolverRequest): unknown {
  const id = canonicalNormalizedIdentity(request);
  return {
    objective: id.objective,
    simulation: id.simulation,
    solveJob: id.solveJob,
  };
}

/**
 * Evaluation identity for process-local eval memo context.
 * Omits seed / tier / search-policy (same loadout re-Optimize must hit).
 */
export function canonicalEvaluationContext(request: SerializableSolverRequest): unknown {
  return canonicalNormalizedIdentity(request).evaluation;
}

/**
 * Whether a solver DTO is safe to enter the verified solve cache.
 * Cancelled / stopped / exploratory-only / non-finite / out-of-bounds must not.
 */
export function isVerifiedCacheableResult(
  request: SerializableSolverRequest,
  result: SolverResultDTO,
): boolean {
  const proof = result.proofLabel ?? result.proof?.label;
  if (!proof || NON_CACHEABLE_PROOFS.has(proof)) return false;
  if (!VERIFIED_CACHEABLE_PROOFS.has(proof)) return false;

  const schema = request.schemaVersion ?? SOLVER_SCHEMA_VERSION;
  if (schema !== SOLVER_SCHEMA_VERSION) return false;

  if (!Number.isFinite(result.score)) return false;

  // Rankable: full-horizon score present when the DTO carries one.
  if (result.bestFullScore !== undefined && !Number.isFinite(result.bestFullScore)) return false;

  const bar = result.bar?.filter((id) => typeof id === "string" && id.length > 0) ?? [];
  if (bar.length === 0) return false;
  if (bar.length < request.minBarSize || bar.length > request.maxBarSize) return false;

  // Identity match is enforced by hashing the same request at store time; caller
  // must pass the request that produced this result.
  return true;
}
