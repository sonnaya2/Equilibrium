import { endBerserk } from "../../styles/melee/bloodlust";
import { METEOR_STRIKE_PASSIVE_ADREN_PER_TICK } from "../../styles/melee/effects";
import { lengLandOutcomes } from "../../styles/melee/lengRng";
import { hasPassive } from "../../shared/equipment";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { scheduleCastEvents } from "../cast/schedule";
import { applyCastEffects, applyCompletionEffects, castEffectContext } from "../cast/effects";
import type { PreparedCast } from "../cast/prepare";
import { processSpiritEvent } from "../schedulers/conjures";
import { recordResolved } from "../resolution";
import type { ResolvedDamage } from "../resolution/types";
import type { ScheduledEvent } from "../runtime/events";
import { gainAdrenaline, patchMelee } from "../runtime/state";
import type { SimulationRuntime } from "../runtime/runtime";
import type { CastRng } from "./contracts";
import {
  combineExactness,
  emptyBranchSet,
  MAX_LIVE_BRANCHES,
  mergeAndCapBranches,
  mergeBranches,
  snapshotRuntime,
  type Branch,
  type BranchExactness,
  type BranchSet,
} from "./branchCore";

/**
 * Soft intermediate budget while folding Leng expands in one event tick.
 * Merge-only until this; hard cap still uses maxLive (default MAX_LIVE_BRANCHES).
 * Keeps peak below ~maxLive * outcomeFanout without residual-chipping twice.
 */
export const MAX_LENG_INTERMEDIATE_BRANCHES = MAX_LIVE_BRANCHES * 2;

function applyLengOutcome(rt: SimulationRuntime, stacks: number, frostUntil: number): void {
  rt.state = patchMelee(rt.state, {
    primordialIceStacks: stacks,
    frostbladesUntilTick: frostUntil,
  });
}

/** True when this landed hit can roll Endless Frost / Boundless Chill. */
export function isLengEligibleLand(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability: AbilitySpec | undefined,
  damage: ResolvedDamage,
): boolean {
  if (!ability || damage.max <= 0) return false;
  if (!event.procEligible || event.attached) return false;
  if (ability.style !== "melee") return false;
  if (event.family === "dot" || event.dotKind) return false;
  const equipment = rt.input.equipmentEffects;
  return (
    hasPassive(equipment, "leng-endless-frost") || hasPassive(equipment, "leng-boundless-chill")
  );
}

/**
 * Fork a branch on Leng land RNG. Heaviest outcome mutates in place; others
 * snapshot from pre-apply state. Residual policy deferred to caller caps.
 * Preserves branch.error: failed residual banks still fork stacks/frost so
 * later pending hits get Leng-consistent mods (never clears error).
 */
export function expandLengOnLand(branch: Branch, tick: number): BranchSet {
  const equipment = branch.rt.input.equipmentEffects;
  const hasEF = hasPassive(equipment, "leng-endless-frost");
  const hasBC = hasPassive(equipment, "leng-boundless-chill");
  if (!hasEF && !hasBC) return emptyBranchSet([branch]);

  const outcomes = lengLandOutcomes(
    hasEF,
    hasBC,
    branch.rt.state.melee.primordialIceStacks,
    branch.rt.state.melee.frostbladesUntilTick,
    tick,
  );
  if (outcomes.length === 0) return emptyBranchSet([branch]);

  if (outcomes.length === 1) {
    const only = outcomes[0]!;
    applyLengOutcome(branch.rt, only.stacks, only.frostUntil);
    return emptyBranchSet([
      { weight: branch.weight * only.weight, rt: branch.rt, error: branch.error },
    ]);
  }

  const sorted = [...outcomes].sort((a, b) => b.weight - a.weight);
  const primary = sorted[0]!;
  const clones = sorted.slice(1).map((outcome) => ({
    outcome,
    rt: snapshotRuntime(branch.rt),
  }));
  applyLengOutcome(branch.rt, primary.stacks, primary.frostUntil);
  const out: Branch[] = [
    { weight: branch.weight * primary.weight, rt: branch.rt, error: branch.error },
  ];
  for (const { outcome, rt } of clones) {
    applyLengOutcome(rt, outcome.stacks, outcome.frostUntil);
    out.push({ weight: branch.weight * outcome.weight, rt, error: branch.error });
  }
  return emptyBranchSet(out);
}

function grantMeteorPassive(
  rt: SimulationRuntime,
  fromTick: number,
  toTickExclusive: number,
): void {
  if (rt.state.melee.meteorStrikeUntilTick <= 0 || toTickExclusive <= fromTick) return;
  let gain = 0;
  const end = Math.min(toTickExclusive, rt.state.melee.meteorStrikeUntilTick);
  for (let t = fromTick; t < end; t++) gain += METEOR_STRIKE_PASSIVE_ADREN_PER_TICK;
  if (gain > 0) rt.state = gainAdrenaline(rt.state, gain);
}

function grantVestmentsPassive(
  rt: SimulationRuntime,
  fromTick: number,
  toTickExclusive: number,
): void {
  const end = Math.min(toTickExclusive, rt.state.vestmentsAdrenalineUntilTick);
  if (end > fromTick) {
    rt.state = gainAdrenaline(rt.state, (end - fromTick) * 0.5);
  }
}

function completeAdvance(rt: SimulationRuntime, fromTick: number, targetTick: number): void {
  grantMeteorPassive(rt, fromTick, targetTick);
  grantVestmentsPassive(rt, fromTick, targetTick);
  if (rt.state.melee.bloodlust.berserk && targetTick >= rt.state.melee.berserkUntilTick) {
    rt.state = patchMelee(rt.state, {
      bloodlust: endBerserk(rt.state.melee.bloodlust),
      berserkUntilTick: 0,
    });
  }
  if (targetTick > rt.state.tick) rt.state = { ...rt.state, tick: targetTick };
}

/**
 * Append `added` then exact-merge. Hard-cap to maxLive only when unique classes
 * still exceed intermediateMax. Residual is disclosed once (no double-cap chip).
 * Always-merge after Leng expand collapses stack/frost twins before the soft peak.
 */
function foldAfterExpand(
  acc: Branch[],
  added: readonly Branch[],
  maxLive: number,
  intermediateMax: number,
): BranchSet {
  acc.push(...added);
  const before = acc.length;
  const merged = mergeBranches(acc);
  const exactness: BranchExactness =
    merged.length < before ? "merged-exactly" : "exact";
  if (merged.length <= intermediateMax) {
    return { branches: merged, residualWeight: 0, exactness };
  }
  const capped = mergeAndCapBranches(merged, maxLive);
  return {
    branches: capped.branches,
    residualWeight: capped.residualWeight,
    exactness: combineExactness(exactness, capped.exactness),
  };
}

/** Soft-merge (no residual) when a non-expand push crosses the intermediate budget. */
function softBound(acc: Branch[], intermediateMax: number): BranchSet {
  if (acc.length <= intermediateMax) {
    return { branches: acc, residualWeight: 0, exactness: "exact" };
  }
  const before = acc.length;
  const merged = mergeBranches(acc);
  return {
    branches: merged,
    residualWeight: 0,
    exactness: merged.length < before ? "merged-exactly" : "exact",
  };
}

/**
 * Advance one branch through due events, forking on Leng-eligible lands.
 * Passives and tick stamp applied after the event window on every survivor.
 * Failed branches still land banked queue (error preserved); no new casts.
 * Exact-merges after each Leng expand so multi-hit channels do not hold
 * maxLive * outcomeFanout runtimes before the round-end cap.
 */
export function advanceToBranches(
  branch: Branch,
  targetTick: number,
  maxLive: number = MAX_LIVE_BRANCHES,
  intermediateMax: number = MAX_LENG_INTERMEDIATE_BRANCHES,
): BranchSet {
  if (targetTick < branch.rt.state.tick) return emptyBranchSet([branch]);
  if (!Number.isInteger(maxLive) || maxLive < 1) {
    throw new RangeError(`advanceToBranches: maxLive must be a positive integer, got ${maxLive}`);
  }
  if (!Number.isInteger(intermediateMax) || intermediateMax < maxLive) {
    throw new RangeError(
      `advanceToBranches: intermediateMax must be an integer >= maxLive, got ${intermediateMax}`,
    );
  }

  const fromTick = branch.rt.state.tick;
  const bound =
    branch.rt.horizon != null ? Math.min(targetTick, branch.rt.horizon - 1) : targetTick;

  let live: Branch[] = [branch];
  let residualWeight = 0;
  let exactness: BranchExactness = "exact";

  for (;;) {
    const withEvents = live.filter((b) => {
      const peek = b.rt.queue.peek();
      return peek != null && peek.tick <= bound;
    });
    if (withEvents.length === 0) break;

    let minTick = Infinity;
    for (const b of withEvents) {
      const t = b.rt.queue.peek()!.tick;
      if (t < minTick) minTick = t;
    }

    // Heaviest first: mid-round hard-cap prefers mass the final heaviest-k keeps.
    const ordered =
      live.length > 1 ? [...live].sort((a, b) => b.weight - a.weight) : live;

    let next: Branch[] = [];
    let expandedAny = false;

    for (const b of ordered) {
      const peek = b.rt.queue.peek();
      if (!peek || peek.tick > bound || peek.tick !== minTick) {
        next.push(b);
        if (next.length > intermediateMax) {
          const boundSet = softBound(next, intermediateMax);
          exactness = combineExactness(exactness, boundSet.exactness);
          next = boundSet.branches;
        }
        continue;
      }

      const event = b.rt.queue.shift()!;
      if (event.family === "conjureAuto" || event.family === "poison") {
        processSpiritEvent(b.rt, event);
        next.push(b);
        if (next.length > intermediateMax) {
          const boundSet = softBound(next, intermediateMax);
          exactness = combineExactness(exactness, boundSet.exactness);
          next = boundSet.branches;
        }
        continue;
      }

      const resolution = event.resolve(b.rt, event.tick);
      recordResolved(b.rt, event, resolution);

      const ability = b.rt.byId.get(event.abilityId);
      // Failed residual banks still Leng-fork (error preserved): frostblades /
      // stacks from earlier pending hits change later banked damage.
      if (isLengEligibleLand(b.rt, event, ability, resolution.damage)) {
        const expanded = expandLengOnLand(b, event.tick);
        residualWeight += expanded.residualWeight;
        exactness = combineExactness(exactness, expanded.exactness);
        expandedAny = true;
        const folded = foldAfterExpand(
          next,
          expanded.branches,
          maxLive,
          intermediateMax,
        );
        residualWeight += folded.residualWeight;
        exactness = combineExactness(exactness, folded.exactness);
        next = folded.branches;
      } else {
        next.push(b);
        if (next.length > intermediateMax) {
          const boundSet = softBound(next, intermediateMax);
          exactness = combineExactness(exactness, boundSet.exactness);
          next = boundSet.branches;
        }
      }
    }

    // Non-Leng under budget: skip re-key. Otherwise one merge+cap to maxLive.
    if (!expandedAny && next.length <= maxLive) {
      live = next;
      continue;
    }
    if (next.length <= maxLive) {
      // Leng expanded but already within live cap (foldAfterExpand merged).
      live = next;
      continue;
    }
    const capped = mergeAndCapBranches(next, maxLive);
    residualWeight += capped.residualWeight;
    exactness = combineExactness(exactness, capped.exactness);
    live = capped.branches;
  }

  for (const b of live) {
    completeAdvance(b.rt, fromTick, targetTick);
  }

  return { branches: live, residualWeight, exactness };
}

function castSeqOf(
  rt: SimulationRuntime,
  prepared: PreparedCast,
): number | undefined {
  for (const [seq, rec] of rt.recordBySeq) {
    if (rec.tick === prepared.candidate && rec.abilityId === prepared.ability.id) return seq;
  }
  return undefined;
}

/**
 * Commit a prepared cast with Leng land-time multi-branch advance through occupancy.
 */
export function commitCastBranches(
  branch: Branch,
  prepared: PreparedCast,
  auto: boolean,
  rng?: CastRng,
): BranchSet {
  if (branch.error !== undefined) return emptyBranchSet([branch]);

  const rt = branch.rt;
  const record = scheduleCastEvents(rt, prepared, auto);
  applyCastEffects(rt, prepared, rng);
  const tx = rt.lastCastAdrenalineTransaction;
  rt.lastCastAdrenalineTransaction = null;
  const completesAt = prepared.candidate + prepared.occupancyTicks;
  rt.endTick = Math.max(rt.endTick, completesAt);

  const castSeq = castSeqOf(rt, prepared);
  const advanced = advanceToBranches({ weight: branch.weight, rt }, completesAt);

  for (const b of advanced.branches) {
    if (b.error !== undefined) continue;
    applyCompletionEffects(castEffectContext(b.rt, prepared, rng));
    const rec = (castSeq != null ? b.rt.recordBySeq.get(castSeq) : undefined) ?? record;
    rec.adrenalineAfter = b.rt.state.adrenaline;
    if (tx) {
      rec.adrenalineTransaction = tx;
      rec.adrenalineAfterResources = tx.afterResources;
      rec.effectiveCost = tx.effectiveCost;
      rec.actualSpend = tx.actualSpend;
      rec.refund = tx.spendPreventedBy === "relentless" ? tx.effectiveCost : 0;
      rec.adrenalineGained =
        tx.totalAbilityGain +
        tx.otherImmediateGrants +
        tx.conservationOfEnergyRefund +
        tx.ringOfVigourRefund;
      const economyDelta =
        tx.totalAbilityGain +
        tx.otherImmediateGrants -
        tx.actualSpend +
        tx.conservationOfEnergyRefund +
        tx.ringOfVigourRefund;
      rec.result = {
        ...rec.result,
        listedAdrenalineDelta: tx.listedGain - tx.listedCost,
        adrenalineDelta: economyDelta,
      };
    }
    if (!b.rt.casts.includes(rec)) b.rt.casts.push(rec);
  }

  return advanced;
}

/**
 * Drain pending queue (and optional horizon) with Leng land forks.
 * Failed branches with banked pending events still drain (error preserved);
 * never invents success from residual land.
 */
export function drainBranchToEnd(branch: Branch, horizonTicks?: number): BranchSet {
  const rt = branch.rt;
  const effectiveHorizon = horizonTicks ?? rt.horizon;
  if (effectiveHorizon != null && effectiveHorizon > 0) {
    const advanced = advanceToBranches(branch, effectiveHorizon - 1);
    for (const b of advanced.branches) {
      if (b.rt.state.tick < effectiveHorizon) {
        b.rt.state = { ...b.rt.state, tick: effectiveHorizon };
      }
    }
    return advanced;
  }
  let live: BranchSet = emptyBranchSet([branch]);
  for (;;) {
    const pending = live.branches.filter((b) => b.rt.queue.length > 0);
    if (pending.length === 0) break;
    // Heaviest first when soft intermediate budget may hard-cap mid-fold.
    const ordered =
      live.branches.length > 1
        ? [...live.branches].sort((a, b) => b.weight - a.weight)
        : live.branches;
    let next: Branch[] = [];
    let residualWeight = live.residualWeight;
    let exactness = live.exactness;
    let needsFinalCap = false;
    for (const b of ordered) {
      if (b.rt.queue.length === 0) {
        next.push(b);
        continue;
      }
      const step = advanceToBranches(b, b.rt.queue.maxTick());
      residualWeight += step.residualWeight;
      exactness = combineExactness(exactness, step.exactness);
      next.push(...step.branches);
      needsFinalCap = true;
      if (next.length > MAX_LENG_INTERMEDIATE_BRANCHES) {
        const folded = mergeAndCapBranches(next);
        residualWeight += folded.residualWeight;
        exactness = combineExactness(exactness, folded.exactness);
        next = folded.branches;
        needsFinalCap = folded.branches.length > MAX_LIVE_BRANCHES;
      }
    }
    if (needsFinalCap || next.length > MAX_LIVE_BRANCHES) {
      const capped = mergeAndCapBranches(next);
      live = {
        branches: capped.branches,
        residualWeight: residualWeight + capped.residualWeight,
        exactness: combineExactness(exactness, capped.exactness),
      };
    } else {
      live = { branches: next, residualWeight, exactness };
    }
  }
  return live;
}
