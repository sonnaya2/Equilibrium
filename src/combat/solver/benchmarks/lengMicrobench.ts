/**
 * Fast Leng microbench: single dual-Leng bar, score-only, ~50 ticks.
 * Peer non-Leng DW bar for wall-time comparison. Not a full solver suite.
 */
import { allEngineSpecs, engineSpecs } from "../../abilities/registry";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { buildCandidatePool } from "../candidatePool";
import type { RevolutionBarEvaluation } from "../contracts";
import { evaluateRevolutionBar } from "../evaluate";
import { requireSimBase, reviveLeague, reviveModifiers } from "../worker/revive";
import { caseById } from "./cases";

/**
 * Fixed dual-wield 4-slot bar (legal under leng-icy-context / four-slot-fixed packing).
 * assault + flurry (DW-only) + fury + dismember - multi-hit land path for Leng fan-out.
 */
export const LENG_MICRO_BAR = ["assault", "flurry", "fury", "dismember"] as const;

/** Explore-style horizon for microbench (~50 ticks). */
export const LENG_MICRO_TICKS = 50;

export interface LengMicroArmResult {
  id: "leng-icy-context" | "four-slot-fixed";
  bar: readonly string[];
  durationTicks: number;
  detailLevel: "score-only";
  wallMs: number;
  /** Ranking ok (residual/exactness may fail dual Leng at full objective). */
  rankOk: boolean;
  /** Simulation produced a summary (physics ran). */
  simOk: boolean;
  score: number | null;
  exploratory: boolean;
  residualWeight: number | null;
  exactness: string | null;
  totalExpected: number | null;
  failureReason?: string;
}

export interface LengMicroReport {
  schemaVersion: 1;
  kind: "leng-microbench";
  generatedAt: string;
  host: { node: string; platform: string };
  durationTicks: number;
  bar: readonly string[];
  totalWallMs: number;
  arms: LengMicroArmResult[];
}

function catalogue(): AbilitySpec[] {
  return allEngineSpecs();
}

function buildSimCommon(request: ReturnType<ReturnType<typeof caseById>["build"]>) {
  const simBase = requireSimBase(request.loadout);
  const abilities = catalogue();
  const league = reviveLeague(simBase.league);
  const modifiers = reviveModifiers(simBase.modifierSources, league);
  return {
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
    equipmentEffects: simBase.equipmentEffects,
    league,
    context: simBase.context,
    targetHpPercent: simBase.targetHpPercent,
    cap: simBase.cap,
    modifiers,
  };
}

function resolveBar(bar: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of bar) {
    if (engineSpecs.has(id)) out.push(id);
  }
  if (out.length < 2) {
    throw new Error(`leng microbench bar unresolved (need >=2 abilities): ${bar.join(",")}`);
  }
  return out;
}

function residualFromEval(evaluation: RevolutionBarEvaluation): number | null {
  const w = evaluation.summary?.rng?.residualWeight;
  return w != null && Number.isFinite(w) ? w : null;
}

function exactnessFromEval(evaluation: RevolutionBarEvaluation): string | null {
  const e = evaluation.summary?.rng?.exactness;
  return e != null ? String(e) : null;
}

function runArm(
  caseId: "leng-icy-context" | "four-slot-fixed",
  bar: readonly string[],
  durationTicks: number,
): LengMicroArmResult {
  const def = caseById(caseId);
  const request = def.build();
  const sim = buildSimCommon(request);
  const pool = buildCandidatePool(catalogue(), request.style, {
    includePartial: request.includePartial === true,
    weaponConfiguration: sim.weaponConfiguration,
    equipmentIds: sim.equipmentIds,
    passiveIds: sim.equipmentEffects?.passiveIds,
    league: sim.league,
  });
  const resolved = resolveBar(bar);

  const t0 = performance.now();
  const evaluation = evaluateRevolutionBar({
    bar: resolved,
    style: request.style,
    durationTicks,
    pool,
    sim,
    profileId: request.profileId,
    customWeights: request.customWeights,
    includePartial: request.includePartial,
    size: { min: request.minBarSize, max: request.maxBarSize },
    detailLevel: "score-only",
  });
  const wallMs = performance.now() - t0;

  const summary = evaluation.summary;
  const simOk = summary != null && summary.ok === true;

  return {
    id: caseId,
    bar: resolved,
    durationTicks,
    detailLevel: "score-only",
    wallMs: Math.round(wallMs * 1000) / 1000,
    rankOk: evaluation.ok,
    simOk,
    score: Number.isFinite(evaluation.score) ? evaluation.score : null,
    exploratory: evaluation.exploratory === true,
    residualWeight: residualFromEval(evaluation),
    exactness: exactnessFromEval(evaluation),
    totalExpected:
      summary?.totalExpected != null && Number.isFinite(summary.totalExpected)
        ? summary.totalExpected
        : null,
    failureReason: evaluation.ok
      ? undefined
      : (evaluation.failureReason ?? evaluation.reasons?.[0]?.message),
  };
}

/**
 * Score-only single-bar microbench:
 * - leng-icy-context packing (dual Leng equipment + passives from cases.ts)
 * - four-slot-fixed peer (same DW 4-slot shape, no Leng)
 */
export function runLengMicrobench(options?: {
  durationTicks?: number;
  bar?: readonly string[];
}): LengMicroReport {
  const durationTicks = options?.durationTicks ?? LENG_MICRO_TICKS;
  const bar = options?.bar ?? LENG_MICRO_BAR;
  const t0 = performance.now();
  const leng = runArm("leng-icy-context", bar, durationTicks);
  const peer = runArm("four-slot-fixed", bar, durationTicks);
  return {
    schemaVersion: 1,
    kind: "leng-microbench",
    generatedAt: new Date().toISOString(),
    host: {
      node: typeof process !== "undefined" ? process.version : "unknown",
      platform: typeof process !== "undefined" ? process.platform : "unknown",
    },
    durationTicks,
    bar: [...bar],
    totalWallMs: Math.round((performance.now() - t0) * 1000) / 1000,
    arms: [leng, peer],
  };
}

export function formatLengMicroSummary(report: LengMicroReport): string {
  const lines = [
    `leng-microbench ticks=${report.durationTicks} bar=${report.bar.join(",")} totalMs=${report.totalWallMs}`,
  ];
  for (const a of report.arms) {
    const bits = [
      a.id.padEnd(18),
      `wallMs=${a.wallMs}`,
      `simOk=${a.simOk}`,
      `rankOk=${a.rankOk}`,
      `score=${a.score == null || !Number.isFinite(a.score) ? "n/a" : a.score.toFixed(2)}`,
      `totalExp=${a.totalExpected == null ? "n/a" : a.totalExpected.toFixed(1)}`,
      `residual=${a.residualWeight == null ? "n/a" : a.residualWeight.toFixed(4)}`,
      `exactness=${a.exactness ?? "n/a"}`,
    ];
    if (a.failureReason) bits.push(`fail=${a.failureReason.slice(0, 72)}`);
    lines.push(bits.join("  "));
  }
  const leng = report.arms.find((a) => a.id === "leng-icy-context");
  const peer = report.arms.find((a) => a.id === "four-slot-fixed");
  if (leng && peer && peer.wallMs > 0) {
    lines.push(`ratio leng/peer wall = ${(leng.wallMs / peer.wallMs).toFixed(1)}x`);
  }
  return lines.join("\n");
}
