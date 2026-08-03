import type { CombatContext } from "../types";
import { capabilitiesOf, resolveCombatProvenance } from "./damageProvenance";

/**
 * Direct-hit eligibility for on-hit gear (Full Slayer Helmet, Salve).
 * Capability-derived from DamageProvenance (not ability-id lists).
 *
 * Eligible: player_direct / player_auto / attached (only when parent is direct-hit family).
 * Ineligible: DoT, conjure auto/poison/command, procs, blessing-generated.
 */
export function isOnHitPlayerDamage(context: CombatContext): boolean {
  return capabilitiesOf(resolveCombatProvenance(context)).onHitGear;
}
