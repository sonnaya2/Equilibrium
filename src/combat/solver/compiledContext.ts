/**
 * Request-scoped compiled evaluation context (Phase 4 design).
 * Types only until Phase 4 implementation - no evaluate wiring yet.
 * See docs/solver-compiled-context-design.md.
 */
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { CombatModifier } from "../types";
import type { CandidatePool } from "./contracts";

/** Style key for basic auto-attack lookup (mirrors engine basicByStyle). */
export type CompiledStyle = AbilitySpec["style"];

/**
 * Readonly ability registry shared by every bar eval for one solve request.
 * Built once via compileEvaluationContext (Phase 4); createRuntime may accept
 * the same maps to skip per-sim mapAbilitiesById / mapBasicsByStyle.
 */
export interface CompiledAbilityRegistry {
  /** Final catalogue including autos; Strength Cape already applied when flagged. */
  readonly catalogue: readonly AbilitySpec[];
  /** Full catalogue index (mapAbilitiesById semantics). */
  readonly byId: ReadonlyMap<string, AbilitySpec>;
  /** First auto-attack per style (mapBasicsByStyle semantics). */
  readonly basicByStyle: ReadonlyMap<CompiledStyle, AbilitySpec>;
  /** Whether catalogue Dismember was Strength Cape 99 patched. */
  readonly strengthCape99: boolean;
}

/**
 * Immutable solve-session context: abilities + pool + shared sim fields.
 * Per-bar work is only bar id resolution, eligibility, horizon, and simulate.
 */
export interface CompiledEvaluationContext extends CompiledAbilityRegistry {
  readonly style: CompiledStyle;
  readonly pool: CandidatePool;
  /**
   * Optional: prebuilt cast baseMods per ability id (global + ability-aware).
   * Phase 4 stretch - only if profiling shows cast prep cost.
   */
  readonly baseModsByAbilityId?: ReadonlyMap<string, readonly CombatModifier[]>;
}

/** Inputs for the Phase 4 pure builder (not implemented in Phase 0). */
export interface CompileEvaluationContextInput {
  readonly style: CompiledStyle;
  readonly pool: CandidatePool;
  /** Engine catalogue / sim.abilities merge source (includes autos). */
  readonly catalogue: readonly AbilitySpec[];
  readonly strengthCape99?: boolean;
}
