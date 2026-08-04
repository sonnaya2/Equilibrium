import { secondsToTicks } from "../../core/ticks";
import {
  FROSTBLADES_DURATION_SECONDS,
  LENG_BOUNDLESS_CHILL_CHANCE,
  LENG_ENDLESS_FROST_CHANCE,
  PRIMORDIAL_ICE_CAP,
} from "./effects";

/** One probability-weighted Leng land outcome (Primordial Ice + Frostblades). */
export interface LengLandOutcome {
  weight: number;
  stacks: number;
  frostUntil: number;
}

/** One EF×BC product arm before stack-cap / absolute frost materialization. */
export interface LengLandArm {
  weight: number;
  stackAdd: number;
  opensFrostblades: boolean;
}

/** Per-start-stack row: final stacks + whether Chill refreshes Frostblades. */
export interface LengStackRow {
  weight: number;
  stacks: number;
  opensFrostblades: boolean;
}

/**
 * Equipment-static Leng land table. Weights and stack transitions depend only
 * on Endless Frost / Boundless Chill passives (and PRIMORDIAL_ICE_CAP). Absolute
 * frostUntil is applied at land time from tick + current frost window.
 */
export interface CompiledLengLandTable {
  readonly hasEndlessFrost: boolean;
  readonly hasBoundlessChill: boolean;
  /** EF×BC product arms (before cap merge). */
  readonly arms: readonly LengLandArm[];
  /**
   * `byStartStacks[s]` = arms applied at stack `s`, merged by
   * `(finalStacks, opensFrostblades)`. Index range is 0..PRIMORDIAL_ICE_CAP.
   */
  readonly byStartStacks: readonly (readonly LengStackRow[])[];
}

/** Frostblades duration in ticks (equipment-static; land only needs land tick). */
export const FROSTBLADES_DURATION_TICKS = secondsToTicks(FROSTBLADES_DURATION_SECONDS);

function clampStacks(stacks: number): number {
  return Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, Math.floor(stacks)));
}

/**
 * Active Frostblades end tick, or 0 when the window is closed at `tick`.
 *
 * Proven: `frostUntil <= tick` is future-equivalent to 0 for all downstream
 * physics (damage uses `at < frostUntil`; Leng non-chill carry only preserves a
 * value that never reactivates).
 */
export function normalizeLengFrostUntil(frostUntil: number, tick: number): number {
  return frostUntil > tick ? frostUntil : 0;
}

/**
 * Future-state key after a Leng land (or any post-land melee slice).
 *
 * Equivalence proven for merge / no-fork:
 * - Same integer stacks AND same active frostUntil (after expiry normalize).
 *
 * Not foldable when this key diverges:
 * - stacks: Icy Tempest cost/bands (integer thresholds), future Leng stack map
 * - frostUntil: frostblades flat AD on later hits; non-chill frost carry
 *
 * Land-hit damage ledgers are independent of the Leng roll (resolved before
 * expand) — forking is state-only, never a damage-side split of the land itself.
 */
export function lengFutureStateKey(stacks: number, frostUntil: number, tick: number): string {
  return `${clampStacks(stacks)}|${normalizeLengFrostUntil(frostUntil, tick)}`;
}

/** True when two Leng post-land states evolve identically for all non-ledger physics. */
export function lengFutureStatesEquivalent(
  a: { stacks: number; frostUntil: number },
  b: { stacks: number; frostUntil: number },
  tick: number,
): boolean {
  return lengFutureStateKey(a.stacks, a.frostUntil, tick) === lengFutureStateKey(b.stacks, b.frostUntil, tick);
}

/**
 * Collapse outcomes that share future state; sum weights. Exact — residual-free.
 * Input arms with identical keys become one survivor (damage EV already shared).
 */
export function foldLengOutcomesByFutureState(
  outcomes: readonly LengLandOutcome[],
  tick: number,
): LengLandOutcome[] {
  if (outcomes.length <= 1) return [...outcomes];
  const merged = new Map<string, LengLandOutcome>();
  for (const o of outcomes) {
    const stacks = clampStacks(o.stacks);
    const frostUntil = normalizeLengFrostUntil(o.frostUntil, tick);
    const key = `${stacks}|${frostUntil}`;
    const existing = merged.get(key);
    if (existing) existing.weight += o.weight;
    else merged.set(key, { weight: o.weight, stacks, frostUntil });
  }
  return [...merged.values()];
}

/** Compile independent Endless Frost × Boundless Chill product arms. */
export function compileLengLandArms(hasEF: boolean, hasBC: boolean): readonly LengLandArm[] {
  const efArms = hasEF
    ? [
        { p: LENG_ENDLESS_FROST_CHANCE, add: 1 },
        { p: 1 - LENG_ENDLESS_FROST_CHANCE, add: 0 },
      ]
    : [{ p: 1, add: 0 }];
  const bcArms = hasBC
    ? [
        { p: LENG_BOUNDLESS_CHILL_CHANCE, add: 1, frost: true },
        { p: 1 - LENG_BOUNDLESS_CHILL_CHANCE, add: 0, frost: false },
      ]
    : [{ p: 1, add: 0, frost: false }];

  const arms: LengLandArm[] = [];
  for (const ef of efArms) {
    for (const bc of bcArms) {
      const weight = ef.p * bc.p;
      if (weight <= 0) continue;
      arms.push({
        weight,
        stackAdd: ef.add + bc.add,
        opensFrostblades: bc.frost,
      });
    }
  }
  return arms;
}

/**
 * Compile full land table for equipment passives. Call once per simulation /
 * equipment context — not per land.
 * Returns null when neither Leng passive is present (no land fork).
 */
export function compileLengLandTable(
  hasEF: boolean,
  hasBC: boolean,
): CompiledLengLandTable | null {
  if (!hasEF && !hasBC) return null;

  const arms = compileLengLandArms(hasEF, hasBC);
  const byStartStacks: LengStackRow[][] = [];
  for (let s = 0; s <= PRIMORDIAL_ICE_CAP; s++) {
    const merged = new Map<string, LengStackRow>();
    for (const arm of arms) {
      const nextStacks = Math.min(PRIMORDIAL_ICE_CAP, s + arm.stackAdd);
      const key = `${nextStacks}|${arm.opensFrostblades ? 1 : 0}`;
      const existing = merged.get(key);
      if (existing) existing.weight += arm.weight;
      else {
        merged.set(key, {
          weight: arm.weight,
          stacks: nextStacks,
          opensFrostblades: arm.opensFrostblades,
        });
      }
    }
    byStartStacks.push([...merged.values()]);
  }
  return {
    hasEndlessFrost: hasEF,
    hasBoundlessChill: hasBC,
    arms,
    byStartStacks,
  };
}

// Four equipment combinations only — cache compile-once tables.
const TABLE_CACHE: (CompiledLengLandTable | null | undefined)[] = [
  undefined,
  undefined,
  undefined,
  undefined,
];

/** Memoized compile for the four (EF, BC) passive combinations. */
export function lengLandTableFor(
  hasEF: boolean,
  hasBC: boolean,
): CompiledLengLandTable | null {
  const i = (hasEF ? 2 : 0) + (hasBC ? 1 : 0);
  if (i === 0) return null;
  const hit = TABLE_CACHE[i];
  if (hit !== undefined) return hit;
  const compiled = compileLengLandTable(hasEF, hasBC);
  TABLE_CACHE[i] = compiled;
  return compiled;
}

/**
 * Materialize absolute (stacks, frostUntil) outcomes from a precompiled table.
 * Probabilities match `lengLandOutcomes` for the same equipment + state.
 *
 * Partial fold (exact): outcomes are keyed by future state only. Identical
 * (stacks, active frostUntil) arms sum weights — no branch snapshot needed.
 * Expired input frost normalizes to 0 so stale windows do not invent classes.
 */
export function materializeLengLandOutcomes(
  table: CompiledLengLandTable,
  stacks: number,
  frostUntil: number,
  tick: number,
): LengLandOutcome[] {
  const baseStacks = clampStacks(stacks);
  const baseFrost = normalizeLengFrostUntil(frostUntil, tick);
  const rows = table.byStartStacks[baseStacks]!;
  const frostOpen = tick + FROSTBLADES_DURATION_TICKS;

  // Common path: chill refresh differs from current active frost → rows unique.
  if (baseFrost !== frostOpen) {
    const out: LengLandOutcome[] = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!;
      out[i] = {
        weight: r.weight,
        stacks: r.stacks,
        frostUntil: r.opensFrostblades ? frostOpen : baseFrost,
      };
    }
    return out;
  }

  // frost already equals this land's frostOpen: chill is a no-op on the window —
  // re-merge by final stacks only (same as Map key collapse / fold by future state).
  const merged = new Map<number, number>();
  for (const r of rows) {
    merged.set(r.stacks, (merged.get(r.stacks) ?? 0) + r.weight);
  }
  const out: LengLandOutcome[] = [];
  for (const [nextStacks, weight] of merged) {
    out.push({ weight, stacks: nextStacks, frostUntil: frostOpen });
  }
  return out;
}

/**
 * Enumerate independent Endless Frost (0.1) and Boundless Chill (0.02) arms.
 * Both can fire on the same hit; stacks cap at PRIMORDIAL_ICE_CAP; Chill opens
 * Frostblades for FROSTBLADES_DURATION_SECONDS from `tick`. Identical states merge.
 *
 * Pure convenience over compile + materialize (tests / oracles). Hot land path
 * should reuse a `CompiledLengLandTable` from the simulation runtime.
 */
export function lengLandOutcomes(
  hasEF: boolean,
  hasBC: boolean,
  stacks: number,
  frostUntil: number,
  tick: number,
): LengLandOutcome[] {
  if (!hasEF && !hasBC) {
    return [
      {
        weight: 1,
        stacks: clampStacks(stacks),
        frostUntil: normalizeLengFrostUntil(frostUntil, tick),
      },
    ];
  }
  const table = lengLandTableFor(hasEF, hasBC)!;
  return materializeLengLandOutcomes(table, stacks, frostUntil, tick);
}
