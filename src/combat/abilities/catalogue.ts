/**
 * Shared ability catalogue for Manual Rotation, Revolution, and solver compile.
 * One Strength Cape transform; mapAbilitiesById enforces behavior fingerprint conflicts.
 */
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { AbilityRegistry } from "../engine/simulation/contracts";
import { mapAbilitiesById } from "../engine/runtime/runtime";
import { withStrengthCape99Dismember } from "../styles/melee/abilities";
import { STRENGTH_CAPE_DISMEMBER_EXTRA_HITS } from "../shared/perks";
import { allEngineSpecs } from "./registry";

/** Style key for basic auto-attack lookup. */
export type CatalogueStyle = AbilitySpec["style"];

/**
 * Resolved engine-facing ability catalogue.
 * Feeds createRuntime via abilityRegistry; catalogue is the ordered ability list.
 */
export interface ResolvedAbilityCatalogue {
  /** Final ordered catalogue including style autos; Strength Cape applied when flagged. */
  readonly catalogue: readonly AbilitySpec[];
  /** Full catalogue index (mapAbilitiesById semantics / conflict checks). */
  readonly byId: ReadonlyMap<string, AbilitySpec>;
  /** First auto-attack per style. */
  readonly basicByStyle: ReadonlyMap<CatalogueStyle, AbilitySpec>;
  readonly strengthCape99: boolean;
  /** Prebuilt maps for SimulateInput.abilityRegistry. */
  readonly abilityRegistry: AbilityRegistry;
}

export interface ResolveAbilityCatalogueOptions {
  /**
   * Base specs (default: full ABILITY_REGISTRY / allEngineSpecs).
   * Later ids in overlays overwrite earlier base entries.
   */
  readonly base?: readonly AbilitySpec[];
  /** Optional overlay specs (e.g. candidate pool); later wins on id. */
  readonly overlays?: readonly AbilitySpec[];
  /** Apply Strength Cape 99 Dismember +N hits once to the merged catalogue. */
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
 * Merge base + overlays by id, apply Strength Cape once, index with fingerprint checks.
 * Does not depend on solver pool/candidate types.
 */
export function resolveAbilityCatalogue(
  options: ResolveAbilityCatalogueOptions = {},
): ResolvedAbilityCatalogue {
  const base = options.base ?? allEngineSpecs();
  const abilityMap = new Map<string, AbilitySpec>();
  for (const ability of base) abilityMap.set(ability.id, ability);
  for (const ability of options.overlays ?? []) abilityMap.set(ability.id, ability);

  const strengthCape99 = options.strengthCape99 === true;
  const merged = [...abilityMap.values()];
  const catalogue = strengthCape99
    ? withStrengthCape99Dismember(merged, STRENGTH_CAPE_DISMEMBER_EXTRA_HITS)
    : merged;

  const byId = mapAbilitiesById(catalogue);
  const basicByStyle = mapBasicsByStyle(catalogue);
  return {
    catalogue,
    byId,
    basicByStyle,
    strengthCape99,
    abilityRegistry: { byId, basicByStyle },
  };
}

/** Resolve bar/rotation ability ids against a catalogue (post Strength Cape). */
export function resolveAbilitySpecsFromCatalogue(
  catalogue: ResolvedAbilityCatalogue,
  ids: readonly string[],
): AbilitySpec[] {
  return ids.map((id) => {
    const spec = catalogue.byId.get(id);
    if (!spec) throw new Error(`Ability id not in catalogue: ${id}`);
    return spec;
  });
}

/**
 * Soft resolve: keep provided spec when id missing (legacy UI paths with partial bars).
 * Prefer resolveAbilitySpecsFromCatalogue when ids are known-good.
 */
export function mapSpecsThroughCatalogue(
  catalogue: ResolvedAbilityCatalogue,
  specs: readonly AbilitySpec[],
): AbilitySpec[] {
  return specs.map((spec) => catalogue.byId.get(spec.id) ?? spec);
}
