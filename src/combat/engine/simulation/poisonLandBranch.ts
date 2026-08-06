import {
  nextEvolvingToxin,
  isTargetPoisonImmune,
  resolvePoisonApplication,
  type PoisonApplicationSnapshot,
} from "../../poison/mechanics";
import { capabilitiesOf } from "../../shared/damageProvenance";
import type { ResolvedDamage } from "../resolution/types";
import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import { patchTarget } from "../runtime/state";
import { applyPlayerPoison, recordPlayerPoisonApplication } from "../schedulers/playerPoison";
import { snapshotRuntime, type Branch, type BranchSet } from "./branchCore";

function exact(branches: Branch[]): BranchSet {
  return { branches, residualWeight: 0, exactness: "exact" };
}

export function applyEvolvingToxinOnLand(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  if (
    !rt.input.playerPoison?.bik ||
    damage.expected <= 0 ||
    event.attached ||
    capabilitiesOf(event.provenance).canApplyEvolvingToxin !== true
  ) {
    return;
  }
  const toxin = rt.state.target.evolvingToxin;
  rt.state = patchTarget(rt.state, {
    evolvingToxin: nextEvolvingToxin(toxin.stacks, toxin.expiresAtTick, event.tick),
  });
}

function expandApplication(
  branch: Branch,
  atTick: number,
  source: PoisonApplicationSnapshot,
): BranchSet {
  recordPlayerPoisonApplication(branch.rt, "attempt");
  const chance = source.procChance;
  if (chance >= 1) {
    recordPlayerPoisonApplication(branch.rt, "success");
    applyPlayerPoison(branch.rt, atTick, source);
    return exact([branch]);
  }
  const success = snapshotRuntime(branch.rt);
  recordPlayerPoisonApplication(success, "success");
  applyPlayerPoison(success, atTick, source);
  return exact([
    { ...branch, weight: branch.weight * (1 - chance) },
    { weight: branch.weight * chance, rt: success, error: branch.error },
  ]);
}

export function expandPlayerPoisonOnLand(
  branch: Branch,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): BranchSet {
  if (
    !branch.rt.input.playerPoison ||
    damage.expected <= 0 ||
    event.attached ||
    capabilitiesOf(event.provenance).canApplyWeaponPoison !== true
  ) {
    return exact([branch]);
  }
  if (
    isTargetPoisonImmune(
      branch.rt.input.playerPoison,
      branch.rt.state.target.poisonImmunityDisabledUntilTick,
      event.tick,
    )
  ) {
    return exact([branch]);
  }
  const source = resolvePoisonApplication(branch.rt.input.playerPoison, event.tick);
  return source ? expandApplication(branch, event.tick, source) : exact([branch]);
}

export function expandCinderbaneContinuation(
  branch: Branch,
  atTick: number,
  source: PoisonApplicationSnapshot | null,
): BranchSet {
  return source ? expandApplication(branch, atTick, source) : exact([branch]);
}
