/**
 * Engine-facing re-export of shared cast/palette availability helpers.
 * Implementation lives in `src/combat/shared/requirements.ts` so shared + solver
 * never depend on engine internals for pure equipment/weapon/passive checks.
 */
export {
  equipmentRecordPassiveIds,
  equipmentRequirementMessage,
  meetsEquipmentRequirement,
  meetsPassiveRequirement,
  meetsWeaponRequirement,
  meetsSpecialAccess,
  equipmentGrantsNativeSpecial,
  hasEssenceOfFinalityEquipped,
  ESSENCE_OF_FINALITY_ITEM_ID,
  missingPassiveMessage,
  passiveIdsFromEquipmentIds,
  permanentAvailabilityBlock,
  resolveAbilityCastAvailability,
  weaponRequirementMessage,
  type AbilityAvailabilityOptions,
  type AbilityCastAvailability,
  type WeaponConfiguration,
} from "../../shared/requirements";
