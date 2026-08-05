/**
 * Loadout-gated ability lists for Quick / Manual palette / Revo display.
 * Under use-build, hide locked upgrades and superseded bases (Igneous pairs).
 */
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { ItemPassiveId } from "@/combat/data/records";
import {
  resolveAbilityCastAvailability,
  resolveEquippedAbilityVariant,
  type WeaponConfiguration,
} from "@/combat/shared/abilityAvailability";

export type LoadoutAbilityGate = {
  weaponConfiguration?: WeaponConfiguration;
  equipmentIds?: readonly string[];
  passiveIds?: readonly ItemPassiveId[];
};

/**
 * Keep only abilities legal under the loadout.
 * Base Overpower drops when Kal-Ket is on; Overpower (Igneous) drops when cape is off.
 */
export function filterAbilitiesForLoadout(
  abilities: readonly AbilitySpec[],
  gate: LoadoutAbilityGate,
): AbilitySpec[] {
  return abilities.filter(
    (a) =>
      resolveAbilityCastAvailability(a, {
        weaponConfiguration: gate.weaponConfiguration,
        equipmentIds: gate.equipmentIds,
        passiveIds: gate.passiveIds,
        groupPeers: abilities,
      }).available,
  );
}

/** Display/sim spec: rewrite base ultimate to equipped upgrade when passive is live. */
export function equipAbilityForLoadout(
  ability: AbilitySpec,
  byId: ReadonlyMap<string, AbilitySpec>,
  gate: LoadoutAbilityGate,
): AbilitySpec {
  return resolveEquippedAbilityVariant(ability, {
    byId,
    passiveIds: gate.passiveIds,
    equipmentIds: gate.equipmentIds,
  });
}
