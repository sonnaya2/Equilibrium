/**
 * Request-scoped compiled evaluation context.
 * Ability catalogue, byId index, Strength Cape Dismember patch - once per solve.
 * See docs/solver-compiled-context-design.md.
 */
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { CombatModifier } from "../types";
import { mapAbilitiesById } from "../engine/runtime/runtime";
import { withStrengthCape99Dismember } from "../styles/melee/abilities";
import { STRENGTH_CAPE_DISMEMBER_EXTRA_HITS } from "../shared/perks";
import { noteAbilityMapRebuild, noteCatalogueArrayRebuild } from "../profiling/allocation";
import type { CandidatePool, RevolutionEvalRequest } from "./contracts";

/** Style key for basic auto-attack lookup (mirrors engine basicByStyle). */
export type CompiledStyle = AbilitySpec["style"];

/**
 * Readonly ability registry shared by every bar eval for one solve request.
 * createRuntime accepts the same maps via abilityRegistry (skips per-sim rebuilds).
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
   * Stretch - only if profiling shows cast prep cost.
   */
  readonly baseModsByAbilityId?: ReadonlyMap<string, readonly CombatModifier[]>;
}

/** Inputs for the pure builder. */
export interface CompileEvaluationContextInput {
  readonly style: CompiledStyle;
  readonly pool: CandidatePool;
  /** Engine catalogue / sim.abilities merge source (includes autos). */
  readonly catalogue: readonly AbilitySpec[];
  readonly strengthCape99?: boolean;
}

function mapBasicsByStyle(
  abilities: readonly AbilitySpec[],
): Map<AbilitySpec["style"], AbilitySpec> {
  const basicByStyle = new Map<AbilitySpec["style"], AbilitySpec>();
  for (const ability of abilities) {
    if (!ability.autoAttack || basicByStyle.has(ability.style)) continue;
    basicByStyle.set(ability.style, ability);
  }
  return basicByStyle;
}

/**
 * Merge sim catalogue + pool (pool wins on id), apply Strength Cape once,
 * build readonly byId / basicByStyle. Call once per solve session.
 */
export function compileEvaluationContext(
  input: CompileEvaluationContextInput,
): CompiledEvaluationContext {
  noteAbilityMapRebuild();
  const abilityMap = new Map<string, AbilitySpec>();
  for (const ability of input.catalogue) abilityMap.set(ability.id, ability);
  for (const ability of input.pool.byId.values()) {
    abilityMap.set(ability.id, ability as AbilitySpec);
  }

  noteCatalogueArrayRebuild();
  const strengthCape99 = input.strengthCape99 === true;
  const merged = [...abilityMap.values()];
  const catalogue = strengthCape99
    ? withStrengthCape99Dismember(merged, STRENGTH_CAPE_DISMEMBER_EXTRA_HITS)
    : merged;

  return {
    style: input.style,
    pool: input.pool,
    catalogue,
    byId: mapAbilitiesById(catalogue),
    basicByStyle: mapBasicsByStyle(catalogue),
    strengthCape99,
  };
}

/** One-shot compile for standalone evaluateRevolutionBar (tests / benches). */
export function compileEvaluationContextFromEvalRequest(
  request: Pick<RevolutionEvalRequest, "style" | "pool" | "sim">,
): CompiledEvaluationContext {
  const strengthCape99 =
    (request.sim as { strengthCape99?: boolean }).strengthCape99 === true;
  return compileEvaluationContext({
    style: request.style,
    pool: request.pool,
    catalogue: request.sim.abilities as AbilitySpec[],
    strengthCape99,
  });
}
