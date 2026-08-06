/**
 * Request-scoped compiled evaluation context.
 * Ability catalogue, byId index, Strength Cape Dismember patch - once per solve.
 * See docs/solver-compiled-context-design.md.
 *
 * Lower-level merge/cape/index lives in abilities/catalogue (shared with Manual/Revo).
 */
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { CombatModifier } from "../types";
import { resolveAbilityCatalogue } from "../abilities/catalogue";
import { noteAbilityMapRebuild, noteCatalogueArrayRebuild } from "../profiling/allocation";
import type { CandidatePool, RevolutionEvalRequest } from "./contracts";

/** Style key for Basic Attack lookup (mirrors engine basicByStyle). */
export type CompiledStyle = AbilitySpec["style"];

/**
 * Readonly ability registry shared by every bar eval for one solve request.
 * createRuntime accepts the same maps via abilityRegistry (skips per-sim rebuilds).
 */
export interface CompiledAbilityRegistry {
  /** Final catalogue including Basic Attacks; Strength Cape already applied when flagged. */
  readonly catalogue: readonly AbilitySpec[];
  /** Full catalogue index (mapAbilitiesById semantics). */
  readonly byId: ReadonlyMap<string, AbilitySpec>;
  /** First Basic Attack per style (mapBasicsByStyle semantics). */
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
   * Stretch - only if profiling shows cast prep cost.
   */
  readonly baseModsByAbilityId?: ReadonlyMap<string, readonly CombatModifier[]>;
}

/** Inputs for the pure builder. */
export interface CompileEvaluationContextInput {
  readonly style: CompiledStyle;
  readonly pool: CandidatePool;
  /** Engine catalogue / sim.abilities merge source (includes Basic Attacks). */
  readonly catalogue: readonly AbilitySpec[];
  readonly strengthCape99?: boolean;
}

/**
 * Merge sim catalogue + pool (pool wins on id), apply Strength Cape once,
 * build readonly byId / basicByStyle. Call once per solve session.
 */
export function compileEvaluationContext(
  input: CompileEvaluationContextInput,
): CompiledEvaluationContext {
  noteAbilityMapRebuild();
  noteCatalogueArrayRebuild();
  // Pool overlays win on id, matching the prior Map set order.
  const resolved = resolveAbilityCatalogue({
    base: input.catalogue,
    overlays: [...input.pool.byId.values()] as AbilitySpec[],
    strengthCape99: input.strengthCape99,
  });

  return {
    style: input.style,
    pool: input.pool,
    catalogue: resolved.catalogue,
    byId: resolved.byId,
    basicByStyle: resolved.basicByStyle,
    strengthCape99: resolved.strengthCape99,
  };
}

/** One-shot compile for standalone evaluateRevolutionBar (tests / benches). */
export function compileEvaluationContextFromEvalRequest(
  request: Pick<RevolutionEvalRequest, "style" | "pool" | "sim">,
): CompiledEvaluationContext {
  const strengthCape99 = (request.sim as { strengthCape99?: boolean }).strengthCape99 === true;
  return compileEvaluationContext({
    style: request.style,
    pool: request.pool,
    catalogue: request.sim.abilities as AbilitySpec[],
    strengthCape99,
  });
}
