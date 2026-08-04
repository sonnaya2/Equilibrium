/**
 * Exhaustive branch expand for oracle tests via castOutcomes.
 * Land-time Leng still caps live branches at MAX_LIVE_BRANCHES; residual is tracked.
 * Production must match when residualWeight is 0.
 */
import { castOutcomes, mergeBranches, type Branch } from "./branch";
import type { SimulateInput } from "./contracts";
import { createRuntime } from "../runtime/runtime";
import { firstLegalTick } from "../runtime/state";
import { PRIMORDIAL_ICE_CAP } from "../../styles/melee/effects";
import {
  compileLengLandArms,
  foldLengOutcomesByFutureState,
  lengFutureStateKey,
  lengFutureStatesEquivalent,
  lengLandOutcomes,
  normalizeLengFrostUntil,
} from "../../styles/melee/lengRng";

export interface OracleResult {
  branches: Branch[];
  sawBranching: boolean;
  residualWeight: number;
}

/**
 * Expand state-changing RNG for a manual rotation (cast-time + Leng land forks).
 * When merge is false, equivalent futures stay as separate leaves where possible.
 */
export function oracleSimulate(
  input: SimulateInput,
  opts?: { merge?: boolean },
): OracleResult {
  const doMerge = opts?.merge !== false;
  let branches: Branch[] = [{ weight: 1, rt: createRuntime(input) }];
  let sawBranching = false;
  let residualWeight = 0;

  for (const action of input.rotation) {
    const ability = branches[0]!.rt.byId.get(action.abilityId);
    if (!ability) {
      branches = branches.map((b) => ({
        ...b,
        error: b.error ?? `unknown ability: ${action.abilityId}`,
      }));
      break;
    }
    const next: Branch[] = [];
    for (const branch of branches) {
      if (branch.error !== undefined) {
        next.push(branch);
        continue;
      }
      const ready = firstLegalTick(
        branch.rt.state,
        ability.id,
        ability.cooldownGroup ?? ability.replacementGroup,
      );
      const set = castOutcomes(branch, ability, ready, false);
      residualWeight += set.residualWeight;
      if (set.branches.length > 1) sawBranching = true;
      next.push(...set.branches);
    }
    branches = doMerge ? mergeBranches(next) : next;
  }
  return { branches, sawBranching, residualWeight };
}

export function massOf(branches: readonly Branch[]): number {
  return branches.reduce((s, b) => s + b.weight, 0);
}

export function failedMass(branches: readonly Branch[]): number {
  return branches.filter((b) => b.error !== undefined).reduce((s, b) => s + b.weight, 0);
}

export function successfulMass(branches: readonly Branch[]): number {
  return branches.filter((b) => b.error === undefined).reduce((s, b) => s + b.weight, 0);
}

/**
 * Unconditional E[D|concrete] over expanded terminals (success + failed banked).
 * Matches combineBranchSummaries primary mix (not success-renormalized; residual not mixed).
 */
export function expectedDamageUnconditional(branches: readonly Branch[]): number {
  const w = massOf(branches);
  if (!(w > 0)) return 0;
  return branches.reduce((s, b) => s + b.weight * b.rt.totalExpected, 0) / w;
}

/** Success-conditional E[D] diagnostic (not primary totals). */
export function expectedDamageOnSuccess(branches: readonly Branch[]): number {
  const ok = branches.filter((b) => b.error === undefined);
  const w = massOf(ok);
  if (!(w > 0)) return 0;
  return ok.reduce((s, b) => s + b.weight * b.rt.totalExpected, 0) / w;
}

export function expectedAdrenaline(branches: readonly Branch[]): number {
  const ok = branches.filter((b) => b.error === undefined);
  const w = massOf(ok);
  if (!(w > 0)) return 0;
  return ok.reduce((s, b) => s + b.weight * b.rt.state.adrenaline, 0) / w;
}

/** Read residualWeight when present; treat missing as 0. */
export function residualOf(rng: { residualWeight?: number } | undefined | null): number {
  return rng?.residualWeight ?? 0;
}

export function concretePlusResidual(
  rng: {
    probabilityMass?: number;
    concreteMass?: number;
    residualWeight?: number;
  } | undefined | null,
): number {
  if (!rng) return 1;
  return (rng.concreteMass ?? rng.probabilityMass ?? 0) + residualOf(rng);
}

/**
 * Independent Leng hit tree (cross-check against lengLandOutcomes).
 * Pure probability; cap applied after both rolls. Delegates to compileLengLandArms
 * so oracle and production share the same equipment-static weight table.
 */
export interface LengHitLeaf {
  weight: number;
  deltaStacks: number;
  opensFrostblades: boolean;
}

export function lengHitOutcomeTree(
  hasEndlessFrost: boolean,
  hasBoundlessChill: boolean,
): LengHitLeaf[] {
  return compileLengLandArms(hasEndlessFrost, hasBoundlessChill).map((arm) => ({
    weight: arm.weight,
    deltaStacks: arm.stackAdd,
    opensFrostblades: arm.opensFrostblades,
  }));
}

/**
 * Exhaustive E[stacks] after `hits` independent Leng-eligible hits from startStacks.
 * Built from lengLandOutcomes (production pure function) when passives are on.
 */
export function lengExpectedStacks(
  hits: number,
  opts: {
    hasEndlessFrost?: boolean;
    hasBoundlessChill?: boolean;
    startStacks?: number;
    frostUntil?: number;
    tick?: number;
  } = {},
): { expectedStacks: number; mass: number; terminalClasses: number } {
  const hasEF = opts.hasEndlessFrost !== false;
  const hasBC = opts.hasBoundlessChill !== false;
  const tick = opts.tick ?? 0;
  // Map stack count -> weight (frost window collapsed for stack EV)
  let dist = new Map<number, number>([[opts.startStacks ?? 0, 1]]);
  for (let h = 0; h < hits; h++) {
    const next = new Map<number, number>();
    for (const [stacks, w] of dist) {
      const leaves = lengLandOutcomes(hasEF, hasBC, stacks, opts.frostUntil ?? 0, tick + h);
      for (const leaf of leaves) {
        next.set(leaf.stacks, (next.get(leaf.stacks) ?? 0) + w * leaf.weight);
      }
    }
    dist = next;
  }
  let mass = 0;
  let expected = 0;
  for (const [stacks, w] of dist) {
    mass += w;
    expected += stacks * w;
  }
  return {
    expectedStacks: mass > 0 ? expected / mass : 0,
    mass,
    terminalClasses: dist.size,
  };
}

/** Weight-mixed stacks from expandLengOnLand-style outcome list. */
export function expectedStacksFromOutcomes(
  outcomes: readonly { weight: number; stacks: number }[],
): number {
  const w = outcomes.reduce((s, o) => s + o.weight, 0);
  if (!(w > 0)) return 0;
  return outcomes.reduce((s, o) => s + o.weight * o.stacks, 0) / w;
}

/**
 * Exhaustive joint (stacks, frost) classes after `hits` lands — future-state mass.
 * Used to prove expandLengOnLand only forks non-equivalent futures.
 */
export function lengExpectedFutureClasses(
  hits: number,
  opts: {
    hasEndlessFrost?: boolean;
    hasBoundlessChill?: boolean;
    startStacks?: number;
    frostUntil?: number;
    tick?: number;
  } = {},
): { mass: number; classes: number; expectedStacks: number } {
  const hasEF = opts.hasEndlessFrost !== false;
  const hasBC = opts.hasBoundlessChill !== false;
  const tick0 = opts.tick ?? 0;
  // key = lengFutureStateKey at the tick of the last land
  let dist = new Map<string, { w: number; stacks: number; frostUntil: number }>([
    [
      lengFutureStateKey(opts.startStacks ?? 0, opts.frostUntil ?? 0, tick0),
      {
        w: 1,
        stacks: opts.startStacks ?? 0,
        frostUntil: normalizeLengFrostUntil(opts.frostUntil ?? 0, tick0),
      },
    ],
  ]);
  for (let h = 0; h < hits; h++) {
    const landTick = tick0 + h;
    const next = new Map<string, { w: number; stacks: number; frostUntil: number }>();
    for (const { w, stacks, frostUntil } of dist.values()) {
      const leaves = lengLandOutcomes(hasEF, hasBC, stacks, frostUntil, landTick);
      for (const leaf of leaves) {
        const key = lengFutureStateKey(leaf.stacks, leaf.frostUntil, landTick);
        const prev = next.get(key);
        if (prev) prev.w += w * leaf.weight;
        else {
          next.set(key, {
            w: w * leaf.weight,
            stacks: leaf.stacks,
            frostUntil: normalizeLengFrostUntil(leaf.frostUntil, landTick),
          });
        }
      }
    }
    dist = next;
  }
  let mass = 0;
  let expected = 0;
  for (const { w, stacks } of dist.values()) {
    mass += w;
    expected += stacks * w;
  }
  return {
    mass,
    classes: dist.size,
    expectedStacks: mass > 0 ? expected / mass : 0,
  };
}

/** Count distinct Leng future-state classes among outcomes at tick. */
export function lengFutureClassCount(
  outcomes: readonly { stacks: number; frostUntil: number }[],
  tick: number,
): number {
  const keys = new Set(outcomes.map((o) => lengFutureStateKey(o.stacks, o.frostUntil, tick)));
  return keys.size;
}

export {
  PRIMORDIAL_ICE_CAP,
  foldLengOutcomesByFutureState,
  lengFutureStateKey,
  lengFutureStatesEquivalent,
  normalizeLengFrostUntil,
};
