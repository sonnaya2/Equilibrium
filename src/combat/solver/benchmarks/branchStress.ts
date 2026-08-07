import { evaluateRevolutionBar } from "../evaluate";
import { buildCandidatePoolForRequest, poolAsSpecs, regionDenyList } from "../requestContext";
import { requireSimBase, reviveRevolutionBase } from "../worker/revive";
import { caseById, type BenchCaseId } from "./cases";
import {
  enableBranchProfiling,
  getBranchProfile,
  resetBranchProfile,
  type BranchProfile,
} from "../../engine/simulation/branch";
import {
  resetAllocationCounters,
  setAllocationProfiling,
  snapshotAllocationCounters,
  type AllocationCounters,
} from "../../profiling/allocation";
import {
  resetHitPipelineCounters,
  setHitPipelineProfiling,
  snapshotHitPipelineCounters,
  type HitPipelineCounters,
} from "../../profiling/hitPipeline";

export const BRANCH_STRESS_CASES = [
  "league-blessings",
  "league-blessings-control",
  "league-poison-melee",
  "league-poison-melee-control",
  "league-necro-conjures",
  "league-necro-conjures-control",
] as const satisfies readonly BenchCaseId[];

export interface BranchStressResult {
  id: (typeof BRANCH_STRESS_CASES)[number];
  durationMs: number;
  ok: boolean;
  totalExpected: number;
  probabilityMass: number;
  residualWeight: number;
  failedWeight: number;
  exactness: string;
  attempts: number;
  finalLiveCap: number;
  branchProfile: BranchProfile;
  allocation: AllocationCounters;
  hitPipeline: HitPipelineCounters;
}

export function branchStressRunnerId(): string {
  const nodeMajor = process.versions.node.split(".")[0];
  return `${process.platform}-${process.arch}-node${nodeMajor}`;
}

export async function runBranchStressCase(
  id: BranchStressResult["id"],
): Promise<BranchStressResult> {
  const request = caseById(id).build();
  const simBase = requireSimBase(request.loadout);
  const disabled = new Set(request.disabledAbilityIds ?? []);
  const denySet = new Set(
    regionDenyList(
      request.style,
      request.unlockedRegions,
      request.includeUnknownAvailability === true,
      disabled,
    ),
  );
  const { catalogue, pool } = buildCandidatePoolForRequest(request, simBase, denySet);
  const authored = request.authoredSeedBars[0]?.abilityIds ?? [];
  const bar = authored.filter((abilityId) => pool.byId.has(abilityId));
  if (bar.length !== authored.length || bar.length < request.minBarSize) {
    const missing = authored.filter((abilityId) => !pool.byId.has(abilityId));
    throw new Error(`${id} authored stress bar is not legal: ${missing.join(", ")}`);
  }
  const poolSpecs = poolAsSpecs(pool.ids, pool.byId);
  const abilityMap = new Map(catalogue.map((ability) => [ability.id, ability]));
  for (const ability of poolSpecs) abilityMap.set(ability.id, ability);

  setAllocationProfiling(true);
  setHitPipelineProfiling(true);
  enableBranchProfiling(true);
  resetAllocationCounters();
  resetHitPipelineCounters();
  resetBranchProfile();
  const started = performance.now();
  try {
    const durationTicks = Math.min(request.durationTicks, 30);
    const evaluation = evaluateRevolutionBar({
      bar,
      style: request.style,
      durationTicks,
      pool,
      sim: {
        ...reviveRevolutionBase(simBase),
        abilities: [...abilityMap.values()],
      },
      profileId: request.profileId,
      customWeights: request.customWeights,
      includePartial: request.includePartial,
      size: { min: request.minBarSize, max: request.maxBarSize },
      detailLevel: "score-only",
      branchFidelityMode: "full",
    });
    const summary = evaluation.summary;
    if (!summary) throw new Error(`${id} produced no simulation summary`);
    return {
      id,
      durationMs: performance.now() - started,
      ok: evaluation.ok && summary.ok,
      totalExpected: summary.totalExpected,
      probabilityMass: summary.rng?.probabilityMass ?? 1,
      residualWeight: summary.rng?.residualWeight ?? 0,
      failedWeight: summary.rng?.failedWeight ?? 0,
      exactness: String(summary.rng?.exactness ?? "exact"),
      attempts: evaluation.branchFidelity?.attempts ?? 1,
      finalLiveCap: evaluation.branchFidelity?.finalBudget.maxLiveBranches ?? 64,
      branchProfile: { ...getBranchProfile() },
      allocation: snapshotAllocationCounters(),
      hitPipeline: snapshotHitPipelineCounters(),
    };
  } finally {
    enableBranchProfiling(false);
    setAllocationProfiling(false);
    setHitPipelineProfiling(false);
  }
}

export async function runBranchStressSuite(
  caseIds: readonly BranchStressResult["id"][] = BRANCH_STRESS_CASES,
): Promise<BranchStressResult[]> {
  const results: BranchStressResult[] = [];
  for (const id of caseIds) results.push(await runBranchStressCase(id));
  return results;
}
