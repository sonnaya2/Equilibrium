/**
 * Loadout-gated ability lists for Quick / Manual palette / Revo display.
 * Under use-build, hide locked upgrades and superseded bases (Igneous pairs).
 */
import type { AbilitySpec } from "@/combat/pipeline/calculateAbility";
import type { ItemPassiveId } from "@/combat/data/records";
import type { ActiveWeaponCapability } from "@/combat/shared/equipment";
import type { ResolvedLeagueRules } from "@/combat/league/ruleset";
import {
  resolveAbilityCastAvailability,
  resolveEquippedAbilityVariant,
  type WeaponConfiguration,
} from "@/combat/shared/abilityAvailability";

export type LoadoutAbilityGate = {
  weaponConfiguration?: WeaponConfiguration;
  equipmentIds?: readonly string[];
  activeWeapon?: ActiveWeaponCapability;
  passiveIds?: readonly ItemPassiveId[];
  league?: ResolvedLeagueRules;
};

export function sortAbilitiesForDisplay(abilities: readonly AbilitySpec[]): AbilitySpec[] {
  return abilities
    .map((ability, index) => ({ ability, index }))
    .sort(
      (left, right) =>
        displayPriority(left.ability) - displayPriority(right.ability) ||
        compareAbilityNames(left.ability, right.ability) ||
        left.index - right.index,
    )
    .map(({ ability }) => ability);
}

function displayPriority(ability: AbilitySpec): number {
  if (ability.weaponSpecial === true) return 0;
  if (ability.category === "utility") return 1;
  if (ability.category === "basic") return 2;
  if (ability.category === "enhanced") return 3;
  if (ability.category === "threshold") return 4;
  if (ability.category === "ultimate") return 5;
  return 6;
}

function compareAbilityNames(left: AbilitySpec, right: AbilitySpec): number {
  return left.name.localeCompare(right.name, "en", { numeric: true, sensitivity: "base" });
}

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
        activeWeapon: gate.activeWeapon,
        passiveIds: gate.passiveIds,
        league: gate.league,
        groupPeers: abilities,
      }).available,
  );
}

/** Display/sim spec: base->upgrade when passive live; upgrade->base when not. */
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
