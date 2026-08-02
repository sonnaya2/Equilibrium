/**
 * Request preparation for solveFromRequest: deny lists, pools, seeds, horizons.
 * Behavior-preserving extraction — no scoring or budget changes.
 */
import { allEngineSpecs, entryByEngineId, engineSpecs } from "../abilities/registry";
import { isObtainableInRegions } from "../data/availability";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { combatRevolutionBars } from "../data";
import { revoManagedSlots } from "../data/specs";
import { buildCandidatePool } from "./candidatePool";
import type { PoolAbility } from "./contracts";
import { secondsToTicks } from "../core/ticks";
import { MIN_RANKABLE_HORIZON_TICKS } from "./objective";
import { TIER_BUDGETS, TIER_HORIZON_SECONDS } from "./solve";
import { MIN_SOLVER_BAR_SIZE } from "./solutionStore";
import { remainingCandidates } from "./eligibility";
import type {
  SerializableRevolutionSimBase,
  SerializableSolverRequest,
} from "./worker/serializable";

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
    if (spec.style !== style) continue;
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
): string[][] {
  const seeds: string[][] = [];
  for (const bar of combatRevolutionBars.records) {
    if (bar.style !== style) continue;
    if (!bar.supported) continue;
    if (bar.target != null && bar.target !== "single") continue;
    const slots = revoManagedSlots(bar, engineSpecs);
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
  let pool = buildCandidatePool(catalogue, request.style, {
    includePartial: request.includePartial === true,
    deny: [...denySet],
    weaponConfiguration: simBase.weaponConfiguration,
    equipmentIds: simBase.equipmentIds,
    passiveIds,
  });

  // Category filter (optional) — rebuild pool rather than mutate.
  if (request.permittedCategories?.length) {
    const allowCat = new Set(request.permittedCategories);
    const catDeny = pool.ids.filter((id) => {
      const a = pool.byId.get(id);
      return a?.category == null || !allowCat.has(a.category);
    });
    pool = buildCandidatePool(catalogue, request.style, {
      includePartial: request.includePartial === true,
      deny: [...denySet, ...catDeny],
      weaponConfiguration: simBase.weaponConfiguration,
      equipmentIds: simBase.equipmentIds,
      passiveIds,
    });
  }
  return { catalogue, pool };
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
  return { exploreTicks, fullTicks, evaluationBudget };
}

export function fitAuthoredSeeds(
  request: SerializableSolverRequest,
  pool: ReturnType<typeof buildCandidatePool>,
  denySet: Set<string>,
): string[][] {
  const legalId = (id: string) => pool.byId.has(id) && !denySet.has(id);
  const searchPool: PoolAbility[] = pool.ids.map((id) => pool.byId.get(id)!);
  // Fit wiki/user seeds into the agent ladder band: truncate > max; pad < min.
  const fitSeed = (ids: readonly string[]): string[] | null => {
    const cleaned = ids.filter(legalId);
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
  };
  return [
    ...authoredSeedsFromCatalogue(request.style, denySet),
    ...request.authoredSeedBars.map((s) => s.abilityIds),
    ...(request.userBar ? [request.userBar] : []),
  ]
    .map(fitSeed)
    .filter((s): s is string[] => s != null && s.length >= 2);
}
