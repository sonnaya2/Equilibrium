import {
  resolveAmmunitionProfile,
  type ResolvedRangedAmmunitionProfile,
} from "../styles/ranged/ammunitionProfile";
import type { RangedAmmunitionMechanicId } from "../data/ammunition";

export function testRangedAmmunition(
  mechanicId: Extract<
    RangedAmmunitionMechanicId,
    "deathspore" | "splintering" | "bik" | "wen" | "opal" | "pearl" | "hydrix" | "ascendri"
  >,
): ResolvedRangedAmmunitionProfile {
  const family =
    mechanicId === "opal" ||
    mechanicId === "pearl" ||
    mechanicId === "hydrix" ||
    mechanicId === "ascendri"
      ? ("bolts" as const)
      : ("arrows" as const);
  const projectile = resolveAmmunitionProfile({
    id: `item:test-${mechanicId}-${family}`,
    label: `Test ${mechanicId} ${family}`,
    family,
    statTier: 95,
    mechanicId,
    support: { status: "partially-modeled", label: "Test fixture" },
  });
  if (projectile == null) throw new Error(`missing test ammunition ${mechanicId}`);
  return Object.freeze({
    projectile,
    quiver: null,
    weaponCapability: { mode: "optional", acceptedFamily: family } as const,
    effectiveStatTier: 95,
  });
}
