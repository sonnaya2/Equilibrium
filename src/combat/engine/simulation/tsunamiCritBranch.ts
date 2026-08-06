import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { tsunamiCritAdrenActive, tsunamiCritAdrenGrant } from "../../styles/magic/effects";
import type { ScheduledEvent } from "../runtime/events";
import { gainAdrenaline } from "../runtime/state";
import type { SimulationRuntime } from "../runtime/runtime";
import type { ResolvedDamage } from "../resolution/types";
import { emptyBranchSet, snapshotRuntime, type Branch, type BranchSet } from "./branchCore";

/**
 * Crit chance for Tsunami adren branching. Prefer resolution.critical (always on
 * damage) so score-only can drop hitDetails without losing p.
 */
export function tsunamiCritChanceFromDamage(damage: ResolvedDamage): number {
  const p = damage.critical?.chance;
  if (typeof p === "number" && Number.isFinite(p)) return Math.min(1, Math.max(0, p));
  return 0;
}

/**
 * Real Magic lands that can roll a crit while the Tsunami window is open.
 * Same real-hit gate as style landed effects (not attached pure DoTs).
 */
export function isTsunamiCritAdrenEligibleLand(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability: AbilitySpec | undefined,
  damage: ResolvedDamage,
): boolean {
  if (!ability || ability.style !== "magic") return false;
  if (event.attached) return false;
  if (!(event.procEligible || event.convertedChannel)) return false;
  if (damage.max <= 0 && damage.expected <= 0) return false;
  if (!tsunamiCritAdrenActive(rt.state.magic, event.tick)) return false;
  return true;
}

/**
 * Adren-only Bernoulli expand for Tsunami crit-adren.
 * Damage stays EV on the parent path; only adrenaline (future legality) forks.
 */
export function expandTsunamiCritAdrenOnLand(
  branch: Branch,
  tick: number,
  critChance: number,
): BranchSet {
  const p = Math.min(1, Math.max(0, critChance));
  if (p <= 0) return emptyBranchSet([branch]);

  const grant = tsunamiCritAdrenGrant(branch.rt.state.naturalInstinctUntilTick, tick);
  if (grant <= 0) return emptyBranchSet([branch]);

  // Grant cannot change state when already at cap.
  if (branch.rt.state.adrenaline >= branch.rt.state.adrenalineCap) {
    return emptyBranchSet([branch]);
  }

  if (p >= 1) {
    branch.rt.state = gainAdrenaline(branch.rt.state, grant);
    return emptyBranchSet([{ weight: branch.weight, rt: branch.rt, error: branch.error }]);
  }

  const critRt = snapshotRuntime(branch.rt);
  critRt.state = gainAdrenaline(critRt.state, grant);
  return emptyBranchSet([
    { weight: branch.weight * p, rt: critRt, error: branch.error },
    { weight: branch.weight * (1 - p), rt: branch.rt, error: branch.error },
  ]);
}
