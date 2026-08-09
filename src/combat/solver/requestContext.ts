/**
 * Request preparation for solveFromRequest: deny lists, pools, seeds, horizons.
 * - no scoring or budget changes.
 */
import { allEngineSpecs, entryByEngineId, engineSpecs } from "../abilities/registry";
import { isObtainableInRegions } from "../data/availability";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { combatRevolutionBars } from "../data";
import { revoManagedSlots } from "../data/specs";
import { weaponConfigurationFromBarSetup } from "../styles/melee/abilities";
import { isSharedConstitutionAbilityId } from "../styles/shared/constitutionAbilities";
import { buildCandidatePool } from "./candidatePool";
import type { PoolAbility } from "./contracts";
import { secondsToTicks } from "../core/ticks";
import { mediumHorizonTicks } from "./fidelity";
import { MIN_RANKABLE_HORIZON_TICKS } from "./objective";
import { TIER_BUDGETS, TIER_HORIZON_SECONDS } from "./solve";
import { MIN_SOLVER_BAR_SIZE } from "./solutionStore";
import { remainingCandidates } from "./eligibility";
import { resolveAbilityCastAvailability, resolveEquippedAbilityId } from "../shared/requirements";
import type { ItemPassiveId } from "../data/records";
import type {
  SerializableRevolutionSimBase,
  SerializableSolverRequest,
} from "./worker/serializable";
import { reviveLeague } from "../model/simulationInput";
import {
  dualVersionDenyIds,
  ensureRequiredAbilityIds,
  styleRequiredAbilityIds,
} from "./stylePolicy";

export function resolveSpecs(ids: readonly string[]): AbilitySpec[] {
  const out: AbilitySpec[] = [];
  for (const id of ids) {
    const spec = engineSpecs.get(id);
    if (spec) out.push(spec);
  }
  return out;
}

export function regionDenyList(
  style: AbilitySpec["style"],
  unlockedRegions: readonly string[],
  includeUnknown: boolean,
  disabled: ReadonlySet<string>,
): string[] {
  const deny: string[] = [...disabled];
  for (const spec of allEngineSpecs()) {
    if (spec.style !== style && !isSharedConstitutionAbilityId(spec.id)) continue;
    if (disabled.has(spec.id)) continue;
    const entry = entryByEngineId(spec.id);
    const unlock = entry?.unlock;
    const check = isObtainableInRegions(unlock, unlockedRegions, {
      includeUnknown,
    });
    if (!check.obtainable) deny.push(spec.id);
  }
  return deny;
}

export function authoredSeedsFromCatalogue(
  style: AbilitySpec["style"],
  deny: ReadonlySet<string>,
  weaponConfiguration?: SerializableRevolutionSimBase["weaponConfiguration"],
): string[][] {
  const seeds: string[][] = [];
  for (const bar of combatRevolutionBars.records) {
    if (bar.style !== style) continue;
    if (!bar.supported) continue;
    if (bar.target != null && bar.target !== "single") continue;
    const shape = weaponConfiguration ?? weaponConfigurationFromBarSetup(bar.setup);
    const slots = revoManagedSlots(bar, engineSpecs, shape);
    const ids = slots
      .filter((s) => s.modelledBy === "engine" && s.spec)
      .map((s) => s.spec!.id)
      .filter((id) => !deny.has(id));
    // Drop replacement conflicts: keep first occurrence.
    const seenGroups = new Set<string>();
    const cleaned: string[] = [];
    for (const id of ids) {
      const group = engineSpecs.get(id)?.replacementGroup;
      if (group) {
        if (seenGroups.has(group)) continue;
        seenGroups.add(group);
      }
      cleaned.push(id);
    }
    if (cleaned.length >= 2) seeds.push(cleaned);
  }
  return seeds;
}

export function poolAsSpecs(
  poolIds: readonly string[],
  byId: ReadonlyMap<string, PoolAbility>,
): AbilitySpec[] {
  const out: AbilitySpec[] = [];
  for (const id of poolIds) {
    const entry = byId.get(id);
    // Candidate pool stores AbilitySpec instances when built from catalogue.
    if (entry && "hits" in entry) out.push(entry as AbilitySpec);
    else {
      const spec = engineSpecs.get(id);
      if (spec) out.push(spec);
    }
  }
  return out;
}

export function buildCandidatePoolForRequest(
  request: SerializableSolverRequest,
  simBase: SerializableRevolutionSimBase,
  denySet: Set<string>,
) {
  const catalogue = allEngineSpecs();
  const passiveIds = simBase.equipmentEffects?.passiveIds;
  const league = reviveLeague(simBase.league);
  const poolOpts = {
    includePartial: request.includePartial === true,
    weaponConfiguration: simBase.weaponConfiguration,
    equipmentIds: simBase.equipmentIds,
    activeWeapon: simBase.equipmentEffects?.activeWeapon,
    eofStoredSpecialId: simBase.eofStoredSpecialId,
    passiveIds,
    league,
  } as const;

  let pool = buildCandidatePool(catalogue, request.style, {
    ...poolOpts,
    deny: [...denySet],
  });

  // One twin per exclusive ult pair (Sunshine/DS by codex pool presence; igneous by cape).
  const twinDeny = dualVersionDenyIds({
    style: request.style,
    passiveIds,
    availableIds: pool.ids,
  });
  if (twinDeny.length > 0) {
    for (const id of twinDeny) denySet.add(id);
    pool = buildCandidatePool(catalogue, request.style, {
      ...poolOpts,
      deny: [...denySet],
    });
  }

  // Category filter (optional) - rebuild pool rather than mutate.
  if (request.permittedCategories?.length) {
    const allowCat = new Set(request.permittedCategories);
    const catDeny = pool.ids.filter((id) => {
      const a = pool.byId.get(id);
      return a?.category == null || !allowCat.has(a.category);
    });
    pool = buildCandidatePool(catalogue, request.style, {
      ...poolOpts,
      deny: [...denySet, ...catDeny],
    });
  }
  return { catalogue, pool };
}

/** Style-required abilities present in the pool (empty rows skipped). */
export function requiredAbilitiesForRequest(
  request: SerializableSolverRequest,
  pool: ReturnType<typeof buildCandidatePool>,
): string[] {
  return styleRequiredAbilityIds(request.style, pool.ids);
}

export function computeHorizonsAndBudget(request: SerializableSolverRequest) {
  // Explore short; finalize uses tier full horizon (thorough ≈ 30s, not 300s).
  const tierHorizons = TIER_HORIZON_SECONDS[request.tier] ?? TIER_HORIZON_SECONDS.thorough;
  const exploreTicks = Math.max(
    10,
    request.exploreDurationTicks ??
      Math.min(request.durationTicks, secondsToTicks(tierHorizons.exploreSeconds)),
  );
  const fullTicks = Math.max(
    MIN_RANKABLE_HORIZON_TICKS,
    request.durationTicks > 0 ? request.durationTicks : secondsToTicks(tierHorizons.fullSeconds),
  );
  const baseBudget = TIER_BUDGETS[request.tier] ?? TIER_BUDGETS.thorough;
  // lenScale = (maxBarSize / MIN_SOLVER_BAR_SIZE) ** 1.2; floor 1.0 so length-5 keeps base budget.
  const lenScale = Math.max(1, (request.maxBarSize / MIN_SOLVER_BAR_SIZE) ** 1.2);
  const evaluationBudget = Math.round(baseBudget * lenScale);
  const mediumTicks = mediumHorizonTicks(exploreTicks, fullTicks);
  return { exploreTicks, mediumTicks, fullTicks, evaluationBudget };
}

/** Legalize a bar into the request size band: legal ids, truncate max, pad min. */
function fitBarIds(
  ids: readonly string[],
  request: SerializableSolverRequest,
  pool: ReturnType<typeof buildCandidatePool>,
  denySet: Set<string>,
  catalogueById?: ReadonlyMap<string, AbilitySpec>,
): string[] | null {
  const legalId = (id: string) => pool.byId.has(id) && !denySet.has(id);
  const searchPool: PoolAbility[] = pool.ids.map((id) => pool.byId.get(id)!);
  const loadout = request.loadout as SerializableRevolutionSimBase;
  const passiveIds = loadout.equipmentEffects?.passiveIds as readonly ItemPassiveId[] | undefined;
  // overpower + Kal-Ket -> overpower_igneous so wiki seeds stay legal under cape.
  const upgraded =
    catalogueById != null
      ? ids.map((id) =>
          resolveEquippedAbilityId(id, catalogueById, {
            passiveIds,
            equipmentIds: loadout.equipmentIds,
          }),
        )
      : ids;
  const required = styleRequiredAbilityIds(request.style, pool.ids);
  // Prepend style-required abilities so every legal seed carries them.
  const withRequired = ensureRequiredAbilityIds(upgraded.filter(legalId), required).filter(legalId);
  // Drop exclusive-group conflicts after required inject (keep first occurrence).
  const cleaned: string[] = [];
  const seenGroups = new Set<string>();
  for (const id of withRequired) {
    if (!legalId(id)) continue;
    const group = pool.byId.get(id)?.exclusiveGroup ?? pool.byId.get(id)?.replacementGroup;
    if (group) {
      if (seenGroups.has(group)) continue;
      seenGroups.add(group);
    }
    if (cleaned.includes(id)) continue;
    cleaned.push(id);
  }
  if (cleaned.length < 2) return null;
  const built =
    cleaned.length > request.maxBarSize ? cleaned.slice(0, request.maxBarSize) : [...cleaned];
  if (built.length < request.minBarSize) {
    const remain = remainingCandidates(built, searchPool, pool.byId);
    for (const a of remain) {
      if (built.length >= request.minBarSize) break;
      if (remainingCandidates(built, [a], pool.byId).length) built.push(a.id);
    }
  }
  return built.length >= 2 ? built : null;
}

/**
 * First-class user bar: preserve order and composition.
 * Resolve equipped variants; drop only denied / unknown / impossible under loadout.
 * Generation-pool exclusion (forceSolver:false) does NOT drop a user slot.
 * Never inject style-required abilities, pad, truncate, or rewrite exclusives.
 * Null when absent or no remaining simulable ids.
 */
export function fitIncumbentBar(
  request: SerializableSolverRequest,
  pool: ReturnType<typeof buildCandidatePool>,
  denySet: Set<string>,
  catalogueById?: ReadonlyMap<string, AbilitySpec>,
): string[] | null {
  if (!request.userBar?.length) return null;
  const loadout = request.loadout as SerializableRevolutionSimBase;
  const passiveIds = loadout.equipmentEffects?.passiveIds as readonly ItemPassiveId[] | undefined;
  const league = reviveLeague(loadout.league);
  const lookup = catalogueById ?? engineSpecs;
  const upgraded = request.userBar.map((id) =>
    resolveEquippedAbilityId(id, lookup, {
      passiveIds,
      equipmentIds: loadout.equipmentIds,
    }),
  );
  const cleaned: string[] = [];
  for (const id of upgraded) {
    if (denySet.has(id)) continue;
    const spec = lookup.get(id) ?? pool.byId.get(id);
    if (!spec || !("hits" in spec)) continue;
    if ((spec as AbilitySpec).offGcd) continue;
    const availability = resolveAbilityCastAvailability(spec as AbilitySpec, {
      weaponConfiguration: loadout.weaponConfiguration,
      equipmentIds: loadout.equipmentIds,
      activeWeapon: loadout.equipmentEffects?.activeWeapon,
      eofStoredSpecialId: loadout.eofStoredSpecialId,
      passiveIds,
      league,
    });
    if (!availability.available) continue;
    cleaned.push(id);
  }
  return cleaned.length > 0 ? cleaned : null;
}

export function fitAuthoredSeeds(
  request: SerializableSolverRequest,
  pool: ReturnType<typeof buildCandidatePool>,
  denySet: Set<string>,
  catalogueById?: ReadonlyMap<string, AbilitySpec>,
): string[][] {
  // Catalogue + authoredSeedBars only. userBar is first-class via fitIncumbentBar.
  return [
    ...authoredSeedsFromCatalogue(
      request.style,
      denySet,
      "weaponConfiguration" in request.loadout ? request.loadout.weaponConfiguration : undefined,
    ),
    ...request.authoredSeedBars.map((s) => s.abilityIds),
  ]
    .map((ids) => fitBarIds(ids, request, pool, denySet, catalogueById))
    .filter((s): s is string[] => s != null && s.length >= 2);
}
