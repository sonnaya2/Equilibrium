/**
 * Combat loadout domain: pure schema/mutations/normalization plus the React hook.
 * Prefer importing from here or the stable `../useLoadout` re-export surface.
 */
export * from "./model";
export { useLoadout, type SetLoadout } from "./useLoadout";
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
