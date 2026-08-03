import type { CombatContext, OutgoingDamageSource } from "../types";

/**
 * Direct-hit eligibility for on-hit gear (Full Slayer Helmet, Salve).
 * Prefer damageSource / dotKind over ability-id lists.
 *
 * Eligible: player direct hits (damageSource omit or "direct").
 * Ineligible: DoT ticks, conjure autos, commands, procs, blessing-generated.
 */

const NON_DIRECT: ReadonlySet<OutgoingDamageSource> = new Set([
  "dot",
  "conjure",
  "command",
  "proc",
  "blessing",
]);

export function isOnHitPlayerDamage(context: CombatContext): boolean {
  if (context.dotKind != null) return false;
  if (context.blessingGenerated === true) return false;
  const source = context.damageSource;
  if (source != null && NON_DIRECT.has(source)) return false;
  return true;
}
