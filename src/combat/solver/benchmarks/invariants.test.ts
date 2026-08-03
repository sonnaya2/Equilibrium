/**
 * Always-on solver production-parity invariants (tiny budgets, no SOLVER_BENCH gate).
 * Complements gated quick/full report suites.
 */
import { describe, expect, it } from "vitest";
import { allEngineSpecs, engineSpecs } from "../../abilities/registry";
import { isObtainableInRegions } from "../../data/availability";
import { entryByEngineId } from "../../abilities/registry";
import { buildCandidatePool } from "../candidatePool";
import { evaluateRevolutionBar } from "../evaluate";
import { remainingCandidates } from "../eligibility";
import { MIN_RANKABLE_HORIZON_TICKS } from "../objective";
import { configForTier, solveAsync } from "../solve";
import { fingerprintSolveContext } from "../solutionStore";
import { solveFromRequest } from "../solveFromRequest";
import { requireSimBase, reviveLeague, reviveModifiers } from "../worker/revive";
import type { SerializableSolverRequest } from "../worker/serializable";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { EvaluateFn, EvalMode, PoolAbility } from "../contracts";
import { caseById } from "./cases";
import { QUICK_SEARCH } from "./runBenchmark";

function regionDenyList(
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
    const check = isObtainableInRegions(unlock, unlockedRegions, { includeUnknown });
    if (!check.obtainable) deny.push(spec.id);
  }
  return deny;
}

function poolAsSpecs(
  poolIds: readonly string[],
  byId: ReadonlyMap<string, PoolAbility>,
): AbilitySpec[] {
  const out: AbilitySpec[] = [];
  for (const id of poolIds) {
    const entry = byId.get(id);
    if (entry && "hits" in entry) out.push(entry as AbilitySpec);
    else {
      const spec = engineSpecs.get(id);
      if (spec) out.push(spec);
    }
  }
  return out;
}

async function solveTiny(request: SerializableSolverRequest, budget = 20) {
  const simBase = requireSimBase(request.loadout);
  const disabled = new Set(request.disabledAbilityIds ?? []);
  const deny = regionDenyList(
    request.style,
    request.unlockedRegions,
    request.includeUnknownAvailability === true,
    disabled,
  );
  const denySet = new Set(deny);
  const catalogue = allEngineSpecs();
  const passiveIds = simBase.equipmentEffects?.passiveIds;

  const pool = buildCandidatePool(catalogue, request.style, {
    includePartial: request.includePartial === true,
    deny: [...denySet],
    weaponConfiguration: simBase.weaponConfiguration,
    equipmentIds: simBase.equipmentIds,
    passiveIds,
  });

  const poolSpecs = poolAsSpecs(pool.ids, pool.byId);
  const abilityMap = new Map(catalogue.map((a) => [a.id, a]));
  for (const a of poolSpecs) abilityMap.set(a.id, a);
  const abilities = [...abilityMap.values()];

  const exploreTicks = Math.max(10, request.exploreDurationTicks ?? 24);
  const fullTicks = Math.max(
    MIN_RANKABLE_HORIZON_TICKS,
    request.durationTicks > 0 ? request.durationTicks : MIN_RANKABLE_HORIZON_TICKS,
  );

  const league = reviveLeague(simBase.league);
  const modifiers = reviveModifiers(simBase.modifierSources, league);
  const simCommon = {
    base: simBase.base,
    level: simBase.level,
    accuracy: simBase.accuracy,
    crit: simBase.crit,
    abilities,
    equipmentIds: simBase.equipmentIds,
    weaponConfiguration: simBase.weaponConfiguration,
    startingAdrenaline: simBase.startingAdrenaline,
    adrenaline: simBase.adrenaline,
    procs: simBase.procs,
    plantedFeet: simBase.plantedFeet,
    strengthCape99: simBase.strengthCape99,
    preciseRank: simBase.preciseRank,
    conjureBasicDamageMult: simBase.conjureBasicDamageMult,
    conjureDurationMult: simBase.conjureDurationMult,
    tumekensPieces: simBase.tumekensPieces,
    tumekensCritEnabled: simBase.tumekensCritEnabled,
    equipmentEffects: simBase.equipmentEffects,
    league,
    context: simBase.context,
    targetHpPercent: simBase.targetHpPercent,
    cap: simBase.cap,
    modifiers,
  };

  const evaluate: EvaluateFn = ({ bar, mode }: { bar: readonly string[]; mode?: EvalMode }) => {
    const useFull = mode === "full" || mode === "finalize";
    const durationTicks = useFull ? fullTicks : exploreTicks;
    const evaluation = evaluateRevolutionBar({
      bar,
      style: request.style,
      durationTicks,
      pool,
      sim: simCommon,
      profileId: request.profileId,
      customWeights: request.customWeights,
      includePartial: request.includePartial,
      size: { min: request.minBarSize, max: request.maxBarSize },
    });
    if (!evaluation.ok) {
      return {
        score: Number.NEGATIVE_INFINITY,
        finite: false,
        mode: evaluation.mode,
        exploratory: evaluation.exploratory,
        validForFinalRanking: false,
        horizonTicks: evaluation.horizonTicks,
        failureReason: evaluation.failureReason ?? evaluation.reasons[0]?.message,
        objective: evaluation.objective,
      };
    }
    if (evaluation.exploratory || !evaluation.objective?.ok) {
      return {
        score: evaluation.score,
        finite: true,
        mode: evaluation.mode,
        exploratory: true,
        validForFinalRanking: false,
        horizonTicks: evaluation.horizonTicks,
      };
    }
    return {
      score: evaluation.score,
      finite: true,
      mode: "full" as const,
      exploratory: false,
      validForFinalRanking: true,
      horizonTicks: evaluation.horizonTicks,
      objective: evaluation.objective,
    };
  };

  const searchPool: PoolAbility[] = pool.ids.map((id) => pool.byId.get(id)!);
  const legalId = (id: string) => pool.byId.has(id) && !denySet.has(id);
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

  // Inject a deterministic legal seed from the pool so seed-vs-winner is meaningful.
  const seededFromPool: string[] = [];
  for (const id of pool.ids) {
    if (seededFromPool.length >= request.minBarSize) break;
    if (remainingCandidates(seededFromPool, [pool.byId.get(id)!], pool.byId).length) {
      seededFromPool.push(id);
    }
  }
  const authored = [
    ...(request.authoredSeedBars ?? []).map((s) => fitSeed(s.abilityIds)).filter(Boolean),
    seededFromPool.length >= request.minBarSize ? seededFromPool : null,
  ].filter((s): s is string[] => s != null);

  const baseCfg = configForTier(request.tier, request.seed);
  const result = await solveAsync({
    pool: searchPool,
    sizeBounds: { min: request.minBarSize, max: request.maxBarSize },
    evaluate,
    tier: request.tier,
    seed: request.seed,
    authoredSeeds: authored,
    config: {
      ...baseCfg,
      ...QUICK_SEARCH,
      evaluationBudget: Math.max(4, budget),
      profileId: request.profileId,
      seed: request.seed,
      searchHorizonTicks: exploreTicks,
      fullHorizonTicks: fullTicks,
    },
  });

  return { result, pool, evaluate, fullTicks, authored, request };
}

describe("solver benchmark invariants (always-on)", () => {
  it("respects requested bar-size bounds and legal abilities", async () => {
    const def = caseById("four-slot-fixed");
    const request = def.build();
    expect(request.minBarSize).toBe(4);
    expect(request.maxBarSize).toBe(4);

    const { result, pool } = await solveTiny(request, 16);
    const winner = result.best;
    expect(winner).toBeTruthy();
    if (!winner) return;

    expect(winner.bar.length).toBeGreaterThanOrEqual(request.minBarSize);
    expect(winner.bar.length).toBeLessThanOrEqual(request.maxBarSize);
    for (const id of winner.bar) {
      expect(pool.byId.has(id)).toBe(true);
    }
  }, 30_000);

  it("is deterministic for the same request and seed", async () => {
    const def = caseById("melee-2h-4slot");
    const request = def.build();
    const a = await solveTiny(request, 16);
    const b = await solveTiny(request, 16);
    expect(a.result.best?.bar).toEqual(b.result.best?.bar);
    expect(a.result.best?.robustScore).toBe(b.result.best?.robustScore);
    const fa = await fingerprintSolveContext(request);
    const fb = await fingerprintSolveContext(request);
    expect(fa).toBe(fb);
    expect(fa).toMatch(/^[a-f0-9]{64}$/);
  }, 45_000);

  it("changes fingerprint when equipment context changes", async () => {
    const base = caseById("melee-2h-4slot").build();
    const leng = caseById("leng-icy-context").build();
    const fa = await fingerprintSolveContext(base);
    const fb = await fingerprintSolveContext(leng);
    expect(fa).not.toBe(fb);
  });

  it("winner is not worse than best legal authored seed under same objective/horizon", async () => {
    const request = caseById("four-slot-fixed").build();
    const { result, evaluate, authored } = await solveTiny(request, 24);
    const winner = result.best;
    expect(winner).toBeTruthy();
    if (!winner || !authored.length) return;

    let bestSeedScore = Number.NEGATIVE_INFINITY;
    for (const seed of authored) {
      const ev = evaluate({ bar: seed, mode: "full" });
      if (ev.validForFinalRanking && Number.isFinite(ev.score)) {
        bestSeedScore = Math.max(bestSeedScore, ev.score);
      }
    }
    if (!Number.isFinite(bestSeedScore)) return;
    expect(winner.robustScore + 1e-9).toBeGreaterThanOrEqual(bestSeedScore);
  }, 45_000);

  it("rankable full-horizon winners report valid ranking when status ok", async () => {
    const request = caseById("four-slot-fixed").build();
    const { result, fullTicks } = await solveTiny(request, 20);
    if (result.status !== "ok" || !result.best) return;
    expect(fullTicks).toBeGreaterThanOrEqual(MIN_RANKABLE_HORIZON_TICKS);
    if (result.best.validForFinalRanking) {
      expect(result.best.mode).toBe("full");
      expect(Number.isFinite(result.best.robustScore)).toBe(true);
    }
  }, 30_000);

  it("cancellation produces no final verified solve result", async () => {
    const request = caseById("four-slot-fixed").build();
    let cancelled = false;
    const promise = solveFromRequest(request, {
      isCancelled: () => cancelled,
    });
    cancelled = true;
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
  }, 15_000);
});
