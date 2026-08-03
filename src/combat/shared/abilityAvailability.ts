/**
 * Public shared surface for cast/palette availability.
 * Implementation lives in `./requirements` (no engine imports).
 */
export {
  equipmentRecordPassiveIds,
  equipmentRequirementMessage,
  meetsEquipmentRequirement,
  meetsPassiveRequirement,
  meetsWeaponRequirement,
  missingPassiveMessage,
  passiveIdsFromEquipmentIds,
  permanentAvailabilityBlock,
  resolveAbilityCastAvailability,
  weaponRequirementMessage,
  type AbilityAvailabilityOptions,
  type AbilityCastAvailability,
  type WeaponConfiguration,
} from "./requirements";
