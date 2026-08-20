import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { CombatStyle } from "../../types";
import {
  isSharedConstitutionAbilityId,
  SHARED_CONSTITUTION_ABILITIES,
} from "./constitutionAbilities";
import { isSharedDefenceAbilityId, SHARED_DEFENCE_ABILITIES } from "./defenceAbilities";

export const SHARED_ALL_STYLE_ABILITIES: readonly AbilitySpec[] = [
  ...SHARED_CONSTITUTION_ABILITIES,
  ...SHARED_DEFENCE_ABILITIES,
];

export function isSharedAllStyleAbilityId(id: string): boolean {
  return isSharedConstitutionAbilityId(id) || isSharedDefenceAbilityId(id);
}

export function abilityStyleForBar(spec: AbilitySpec, barStyle: CombatStyle): AbilitySpec {
  if (!isSharedAllStyleAbilityId(spec.id) || spec.style === barStyle) return spec;
  return { ...spec, style: barStyle };
}
