/**
 * Host-side incumbent baseline: one full-horizon score under the original request
 * (not worker length pins). Pool merge recomputes isUpgrade against this stamp.
 */
import { evaluateRevolutionBar } from "./evaluate";
import {
  barsEqual,
  candidateBeatsIncumbent,
  finiteFullScore,
  scoreImprovementAbsolute,
  scoreImprovementPercent,
} from "./incumbentCompare";
import {
  buildCandidatePoolForRequest,
  computeHorizonsAndBudget,
  fitIncumbentBar,
  poolAsSpecs,
  regionDenyList,
} from "./requestContext";
import { buildSolverResultHonesty } from "./solverDtoHonesty";
import { CURRENT_BAR_REMAINS_BEST_NOTE, type SolverResultDTO } from "./worker/serializable";
import type { SerializableSolverRequest } from "./worker/serializable";
import { isSerializableSimBase } from "./worker/serializable";
import { reviveLeague, reviveModifiers } from "./worker/revive";

export type HostIncumbentBaseline = {
  /** Normalized user bar (order preserved; only illegal ids dropped). */
  bar: readonly string[];
  /** Full-horizon rankable score, or -Infinity when unrankable. */
  score: number;
};

/** Sync host baseline. Null when the request has no user bar or cannot score. */
export function evaluateHostIncumbentBaseline(
  request: SerializableSolverRequest,
): HostIncumbentBaseline | null {
  if (!request.userBar?.length) return null;
  if (!isSerializableSimBase(request.loadout)) return null;

  const simBase = request.loadout;
  const disabled = new Set(request.disabledAbilityIds ?? []);
  const deny = regionDenyList(
    request.style,
    request.unlockedRegions,
    request.includeUnknownAvailability === true,
    disabled,
  );
  const denySet = new Set(deny);
  const { catalogue, pool } = buildCandidatePoolForRequest(request, simBase, denySet);
  const catalogueById = new Map(catalogue.map((a) => [a.id, a] as const));
  const bar = fitIncumbentBar(request, pool, denySet, catalogueById);
  if (!bar?.length) return null;

  const poolSpecs = poolAsSpecs(pool.ids, pool.byId);
  const abilityMap = new Map(catalogue.map((a) => [a.id, a]));
  for (const a of poolSpecs) abilityMap.set(a.id, a);
  for (const id of bar) {
    const s = catalogueById.get(id);
    if (s) abilityMap.set(id, s);
  }
  const abilities = [...abilityMap.values()];

  const { fullTicks } = computeHorizonsAndBudget(request);
  const league = reviveLeague(simBase.league);
  const modifiers = reviveModifiers(simBase.modifierSources, league);

  const sim = {
    base: simBase.base,
    level: simBase.level,
    ...(simBase.overrideBase != null ? { overrideBase: simBase.overrideBase } : {}),
    ...(simBase.overrideLevel != null ? { overrideLevel: simBase.overrideLevel } : {}),
    ...(simBase.activateNaragiAtStart === true ? { activateNaragiAtStart: true } : {}),
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
    ammo: simBase.ammo,
    caromingRank: simBase.caromingRank ?? simBase.modifierSources?.caroming ?? 0,
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

  const evaluation = evaluateRevolutionBar({
    bar,
    style: request.style,
    durationTicks: fullTicks,
    pool,
    sim,
    profileId: request.profileId,
    customWeights: request.customWeights,
    includePartial: true,
    size: { min: bar.length, max: bar.length },
    incumbentBaseline: true,
    detailLevel: "score-only",
    branchFidelityMode: "full",
  });

  const score =
    evaluation.ok && evaluation.validForFinalRanking === true
      ? finiteFullScore(evaluation.score)
      : Number.NEGATIVE_INFINITY;

  return { bar: [...bar], score };
}

/**
 * Recompute upgrade / Apply / baseline fields against the host incumbent stamp.
 * Used after multi-worker merge so length-pinned agents cannot invent upgrades.
 */
export function applyHostIncumbentBaseline(
  dto: SolverResultDTO,
  baseline: HostIncumbentBaseline | null | undefined,
): SolverResultDTO {
  if (!baseline?.bar.length) return dto;

  const incumbentScore = finiteFullScore(baseline.score);
  const proposedScore = finiteFullScore(dto.score);
  const sameBar = barsEqual(dto.bar, baseline.bar);
  const beats = candidateBeatsIncumbent(proposedScore, incumbentScore) && !sameBar;

  if (!beats) {
    // Incumbent remains best (or candidate unrankable). Report baseline bar.
    const winnerScore = Number.isFinite(incumbentScore) ? incumbentScore : proposedScore;
    const winnerBar = Number.isFinite(incumbentScore) ? [...baseline.bar] : [...dto.bar];
    const honesty = buildSolverResultHonesty({
      status: dto.honesty?.status ?? "ok",
      isUpgrade: false,
      validForApply: false,
      currentBarScore: incumbentScore,
      proposedBarScore: winnerScore,
      improvement: 0,
      proofLabel: dto.proofLabel ?? "heuristic-best-found",
      residualMass: dto.honesty?.residualMass ?? dto.rng?.residualWeight ?? 0,
      branchExactness: dto.honesty?.branchExactness ?? dto.rng?.exactness ?? null,
    });
    const notes = [...(dto.proof?.notes ?? [])].filter((n) => n !== CURRENT_BAR_REMAINS_BEST_NOTE);
    notes.push(CURRENT_BAR_REMAINS_BEST_NOTE);
    notes.push("host incumbent baseline (outside worker length pins)");
    return {
      ...dto,
      bar: winnerBar,
      score: winnerScore,
      baselineBar: [...baseline.bar],
      baselineScore: incumbentScore,
      winnerScore,
      scoreImprovement: 0,
      percentImprovement: null,
      isUpgrade: false,
      validForApply: false,
      honesty,
      proof: {
        ...dto.proof,
        label: dto.proof?.label ?? dto.proofLabel,
        notes,
      },
    };
  }

  const improvement = scoreImprovementAbsolute(proposedScore, incumbentScore, true);
  const percent = scoreImprovementPercent(proposedScore, incumbentScore, true);
  const honesty = buildSolverResultHonesty({
    status: dto.honesty?.status ?? "ok",
    isUpgrade: true,
    validForApply: dto.validForApply === true,
    currentBarScore: incumbentScore,
    proposedBarScore: proposedScore,
    improvement,
    proofLabel: dto.proofLabel ?? "heuristic-best-found",
    residualMass: dto.honesty?.residualMass ?? dto.rng?.residualWeight ?? 0,
    branchExactness: dto.honesty?.branchExactness ?? dto.rng?.exactness ?? null,
  });
  const notes = [...(dto.proof?.notes ?? [])].filter((n) => n !== CURRENT_BAR_REMAINS_BEST_NOTE);
  notes.push("host incumbent baseline (outside worker length pins)");
  return {
    ...dto,
    baselineBar: [...baseline.bar],
    baselineScore: incumbentScore,
    winnerScore: proposedScore,
    scoreImprovement: honesty.improvement,
    percentImprovement: honesty.beatsBar ? percent : null,
    isUpgrade: true,
    validForApply: honesty.applyAllowed,
    honesty,
    proof: {
      ...dto.proof,
      label: dto.proof?.label ?? dto.proofLabel,
      notes,
    },
  };
}
