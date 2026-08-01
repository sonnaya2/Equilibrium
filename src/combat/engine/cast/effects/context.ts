import type { AbilitySpec } from "../../../pipeline/calculateAbility";
import type { SimulationRuntime } from "../../runtime/runtime";
import type { RotationState } from "../../runtime/state";
import type { CastRng } from "../../simulation/contracts";
import type { PreparedCast } from "../prepare";

/**
 * One commit-time cast transition, unpacked once so every effect module reads
 * the same ability, variant and tick instead of re-destructuring the prepared
 * cast. `rng` carries the driver's enumerated outcome for this cast's single
 * state-changing RNG point (absent = did not proc).
 */
export interface CastEffectContext {
  rt: SimulationRuntime;
  prepared: PreparedCast;
  /** The ability as queued — id, style and category checks read this. */
  ability: AbilitySpec;
  /** The resolved variant whose hits were actually scheduled. */
  working: AbilitySpec;
  /** Tick the cast begins. */
  candidate: number;
  rng?: CastRng;
}

export function castEffectContext(
  rt: SimulationRuntime,
  prepared: PreparedCast,
  rng?: CastRng,
): CastEffectContext {
  return {
    rt,
    prepared,
    ability: prepared.ability,
    working: prepared.working,
    candidate: prepared.candidate,
    ...(rng !== undefined ? { rng } : {}),
  };
}

/** Replace runtime state with a shallow patch — the old object is never mutated. */
export function patchState(fx: CastEffectContext, next: Partial<RotationState>): void {
  fx.rt.state = { ...fx.rt.state, ...next };
}
