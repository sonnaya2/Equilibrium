import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { RotationState } from "./state";

/** Max charges available at player level. 0 when ability has no charges field. */
export function maxChargesFor(ability: AbilitySpec, level: number): number {
  const c = ability.charges;
  if (!c) return 0;
  if (c.secondChargeLevel != null && level < c.secondChargeLevel) return 1;
  return c.max;
}

/** Drop ready-at entries that have recovered by `tick`. */
export function pruneCharges(recovering: readonly number[], tick: number): number[] {
  return recovering.filter((readyAt) => readyAt > tick);
}

export function readyChargeCount(
  state: RotationState,
  key: string,
  max: number,
  tick: number,
): number {
  if (max <= 0) return 0;
  const recovering = pruneCharges(state.charges[key] ?? [], tick);
  return Math.max(0, max - recovering.length);
}

/**
 * Earliest tick a charge is usable. Returns `tick` when at least one is ready;
 * else min recovering ready-at.
 */
export function firstChargeReadyTick(
  state: RotationState,
  key: string,
  max: number,
  tick: number,
): number {
  if (max <= 0) return tick;
  const recovering = pruneCharges(state.charges[key] ?? [], tick);
  if (recovering.length < max) return tick;
  let earliest = recovering[0]!;
  for (let i = 1; i < recovering.length; i++) {
    if (recovering[i]! < earliest) earliest = recovering[i]!;
  }
  return earliest;
}

/**
 * Consume one ready charge: prune, push atTick+recoveryTicks, sort ascending.
 * Independent recovery - other recovering slots are unchanged.
 */
export function consumeCharge(
  state: RotationState,
  key: string,
  recoveryTicks: number,
  atTick: number,
): RotationState {
  const pruned = pruneCharges(state.charges[key] ?? [], atTick);
  const recovering = [...pruned, atTick + recoveryTicks].sort((a, b) => a - b);
  return { ...state, charges: { ...state.charges, [key]: recovering } };
}

export function clearCharges(state: RotationState, ids: readonly string[]): RotationState {
  if (ids.length === 0) return state;
  let changed = false;
  const charges = { ...state.charges };
  for (const id of ids) {
    if (id in charges) {
      delete charges[id];
      changed = true;
    }
  }
  return changed ? { ...state, charges } : state;
}
