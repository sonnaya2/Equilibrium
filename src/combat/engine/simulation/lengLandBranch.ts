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
  mergeAndCapBranches,
  snapshotRuntime,
  type Branch,
  type BranchExactness,
  type BranchSet,
} from "./branch";

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
 */
export function expandLengOnLand(branch: Branch, tick: number): BranchSet {
  if (branch.error !== undefined) return emptyBranchSet([branch]);

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
 * Advance one branch through due events, forking on Leng-eligible lands.
 * Passives and tick stamp applied after the event window on every survivor.
 */
export function advanceToBranches(branch: Branch, targetTick: number): BranchSet {
  if (branch.error !== undefined) return emptyBranchSet([branch]);
  if (targetTick < branch.rt.state.tick) return emptyBranchSet([branch]);

  const fromTick = branch.rt.state.tick;
  const bound =
    branch.rt.horizon != null ? Math.min(targetTick, branch.rt.horizon - 1) : targetTick;

  let live: Branch[] = [branch];
  let residualWeight = 0;
  let exactness: BranchExactness = "exact";

  for (;;) {
    const withEvents = live.filter((b) => {
      if (b.error !== undefined) return false;
      const peek = b.rt.queue.peek();
      return peek != null && peek.tick <= bound;
    });
    if (withEvents.length === 0) break;

    let minTick = Infinity;
    for (const b of withEvents) {
      const t = b.rt.queue.peek()!.tick;
      if (t < minTick) minTick = t;
    }

    const next: Branch[] = [];
    for (const b of live) {
      if (b.error !== undefined) {
        next.push(b);
        continue;
      }
      const peek = b.rt.queue.peek();
      if (!peek || peek.tick > bound || peek.tick !== minTick) {
        next.push(b);
        continue;
      }

      const event = b.rt.queue.shift()!;
      if (event.family === "conjureAuto" || event.family === "poison") {
        processSpiritEvent(b.rt, event);
        next.push(b);
        continue;
      }

      const resolution = event.resolve(b.rt, event.tick);
      recordResolved(b.rt, event, resolution);

      const ability = b.rt.byId.get(event.abilityId);
      if (isLengEligibleLand(b.rt, event, ability, resolution.damage)) {
        const expanded = expandLengOnLand(b, event.tick);
        residualWeight += expanded.residualWeight;
        exactness = combineExactness(exactness, expanded.exactness);
        next.push(...expanded.branches);
      } else {
        next.push(b);
      }
    }

    const capped = mergeAndCapBranches(next);
    residualWeight += capped.residualWeight;
    exactness = combineExactness(exactness, capped.exactness);
    live = capped.branches;
  }

  for (const b of live) {
    if (b.error !== undefined) continue;
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

/** Drain pending queue (and optional horizon) with Leng land forks. */
export function drainBranchToEnd(branch: Branch, horizonTicks?: number): BranchSet {
  if (branch.error !== undefined) return emptyBranchSet([branch]);
  const rt = branch.rt;
  const effectiveHorizon = horizonTicks ?? rt.horizon;
  if (effectiveHorizon != null && effectiveHorizon > 0) {
    const advanced = advanceToBranches(branch, effectiveHorizon - 1);
    for (const b of advanced.branches) {
      if (b.error === undefined && b.rt.state.tick < effectiveHorizon) {
        b.rt.state = { ...b.rt.state, tick: effectiveHorizon };
      }
    }
    return advanced;
  }
  let live: BranchSet = emptyBranchSet([branch]);
  for (;;) {
    const pending = live.branches.filter(
      (b) => b.error === undefined && b.rt.queue.length > 0,
    );
    if (pending.length === 0) break;
    const next: Branch[] = [];
    let residualWeight = live.residualWeight;
    let exactness = live.exactness;
    for (const b of live.branches) {
      if (b.error !== undefined || b.rt.queue.length === 0) {
        next.push(b);
        continue;
      }
      const step = advanceToBranches(b, b.rt.queue.maxTick());
      residualWeight += step.residualWeight;
      exactness = combineExactness(exactness, step.exactness);
      next.push(...step.branches);
    }
    const capped = mergeAndCapBranches(next);
    live = {
      branches: capped.branches,
      residualWeight: residualWeight + capped.residualWeight,
      exactness: combineExactness(exactness, capped.exactness),
    };
  }
  return live;
}
