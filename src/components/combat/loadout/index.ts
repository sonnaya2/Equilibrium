/**
 * Combat loadout domain: pure schema/mutations/normalization plus the React hook.
 * Prefer importing from here or the stable `../useLoadout` re-export surface.
 */
export * from "./model";
export * from "./savedSetups";
export { useLoadout, type SetLoadout } from "./useLoadout";
export { useSavedSetups, type SavedSetupActions } from "./useSavedSetups";
export {
  equippedRecordIds,
  equipmentStyleDamageBonus,
  equippedWeaponTier,
  loadoutWeaponTier,
  loadoutAttackLevel,
  loadoutDamageLevel,
  loadoutOverloadTier,
  loadoutEffectiveDamageLevel,
  loadoutWeaponConfig,
  loadoutRangedAmmunitionProfile,
  computedLoadoutBase,
  loadoutBase,
  type WeaponHand,
} from "./weaponConfiguration";
