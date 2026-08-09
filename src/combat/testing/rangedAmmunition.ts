import {
  resolveAmmunitionProfile,
  type ResolvedRangedAmmunitionProfile,
} from "../styles/ranged/ammunitionProfile";
import type { RangedAmmunitionMechanicId } from "../data/ammunition";

export function testRangedAmmunition(
  mechanicId: Extract<RangedAmmunitionMechanicId, "deathspore" | "splintering" | "bik">,
): ResolvedRangedAmmunitionProfile {
  const projectile = resolveAmmunitionProfile({
    id: `item:test-${mechanicId}-arrows`,
    label: `Test ${mechanicId} arrows`,
    family: "arrows",
    statTier: 95,
    mechanicId,
    support: { status: "partially-modeled", label: "Test fixture" },
  });
  if (projectile == null) throw new Error(`missing test ammunition ${mechanicId}`);
  return Object.freeze({
    projectile,
    quiver: null,
    weaponCapability: { mode: "optional", acceptedFamily: "arrows" } as const,
    effectiveStatTier: 95,
  });
}
