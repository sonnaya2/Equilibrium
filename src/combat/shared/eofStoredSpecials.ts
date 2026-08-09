import type { AbilitySpec } from "../pipeline/calculateAbility";
import { allEngineSpecs } from "../abilities/registry";

/**
 * Modelled weapon specials that can be stored in Essence of Finality.
 * Picker + loadout only list these; never invent unmodelled specials.
 */
export function isEofStorableSpecial(ability: AbilitySpec): boolean {
  return ability.weaponSpecial === true && ability.requiresSpecialAccess === true;
}

/** Sorted catalogue of EoF-storable specials from the live engine registry. */
export function eofStorableSpecials(
  catalogue: readonly AbilitySpec[] = allEngineSpecs(),
): AbilitySpec[] {
  return catalogue
    .filter(isEofStorableSpecial)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }));
}
