/** Re-export the pure cast/palette availability resolver (engine/cast owns it). */
export {
  equipmentRecordPassiveIds,
  meetsEquipmentRequirement,
  meetsPassiveRequirement,
  meetsWeaponRequirement,
  missingPassiveMessage,
  passiveIdsFromEquipmentIds,
  permanentAvailabilityBlock,
  resolveAbilityCastAvailability,
  type AbilityAvailabilityOptions,
  type AbilityCastAvailability,
} from "../engine/cast/requirements";
