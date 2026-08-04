/**
 * Exhaustive branch expand for oracle tests via castOutcomes.
 * Land-time Leng still caps live branches at MAX_LIVE_BRANCHES; residual is tracked.
 * Production must match when residualWeight is 0.
 */
import { castOutcomes, mergeBranches, type Branch } from "./branch";
import type { SimulateInput } from "./contracts";
import { createRuntime } from "../runtime/runtime";
import { firstLegalTick } from "../runtime/state";
import {
  LENG_BOUNDLESS_CHILL_CHANCE,
  LENG_ENDLESS_FROST_CHANCE,
  PRIMORDIAL_ICE_CAP,
} from "../../styles/melee/effects";
import { lengLandOutcomes } from "../../styles/melee/lengRng";

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

/** @deprecated Use expectedDamageUnconditional or expectedDamageOnSuccess. */
export const expectedDamage = expectedDamageOnSuccess;

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
 * Pure probability; cap applied after both rolls.
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
  const pFrost = hasEndlessFrost ? LENG_ENDLESS_FROST_CHANCE : 0;
  const pChill = hasBoundlessChill ? LENG_BOUNDLESS_CHILL_CHANCE : 0;
  const leaves: LengHitLeaf[] = [];
  for (const frost of [false, true] as const) {
    for (const chill of [false, true] as const) {
      const w = (frost ? pFrost : 1 - pFrost) * (chill ? pChill : 1 - pChill);
      if (w <= 0) continue;
      leaves.push({
        weight: w,
        deltaStacks: (frost ? 1 : 0) + (chill ? 1 : 0),
        opensFrostblades: chill,
      });
    }
  }
  return leaves;
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

export { PRIMORDIAL_ICE_CAP };
