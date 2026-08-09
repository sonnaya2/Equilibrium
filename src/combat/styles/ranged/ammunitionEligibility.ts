import type { CombatStyle } from "../../types";
import { capabilitiesOf, type DamageProvenance } from "../../shared/damageProvenance";

export type AmmunitionAttackOrigin = "player" | "botlg";

export interface AmmunitionHitEligibilityInput {
  style: CombatStyle;
  provenance: DamageProvenance;
  attackOrigin?: AmmunitionAttackOrigin;
}

export function isAmmunitionHitEligible<T extends AmmunitionHitEligibilityInput>(
  input: T,
): boolean {
  const capabilities = capabilitiesOf(input.provenance);
  if (input.style !== "ranged" || !capabilities.canApplyAmmunition) return false;
  if (input.attackOrigin === "botlg") {
    return input.provenance.kind === "botlg_perfect_equilibrium";
  }
  return capabilities.playerAttack && capabilities.directHit;
}
