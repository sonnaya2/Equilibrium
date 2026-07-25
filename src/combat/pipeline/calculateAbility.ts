import type { DamageBand } from "../core/abilityDamage";
import type { CritLayers } from "../core/critical";
import { calculateHit, type HitInput, type HitResult } from "./calculateHit";

export interface AbilityHit {
  band: DamageBand;
  /** Per-hit crit eligibility inside a multi-hit ability; bleed tails set false. */
  critEligible?: boolean;
  /** Ticks after the cast this hit lands on. Absent = cast tick; bleed/burn tails
   *  carry their sourced interval here. */
  tickOffset?: number;
}

export interface AbilitySpec {
  id: string;
  name: string;
  style: "melee" | "ranged" | "magic" | "necromancy";
  /** Post-modernisation categories; legacy "threshold" semantics are not assumed. */
  category: "basic" | "enhanced" | "ultimate" | "utility";
  hits: AbilityHit[];
  /** Per-ability data — adrenaline is never a magic global. */
  adrenaline?: { gain?: number; cost?: number };
  cooldownSeconds?: number;
  /** Self-buff marker: the cast applies state through a style machine, no damage band. */
  buff?: string;
  /** Damaging cast that also applies a buff (Galeshot → Searing Winds). */
  appliesBuff?: string;
  /** Off-GCD cast (Runic Charge): does not consume or advance the global cooldown. */
  offGcd?: boolean;
  /** The style's basic attack ability — the cast the sim auto-weaves into GCD gaps
   *  and adrenaline shortfalls when autoWeave is on (§5.6: basics auto-used when
   *  nothing else is queued). Exactly one spec per style should carry this. */
  autoAttack?: boolean;
}

export interface AbilityResult {
  hits: HitResult[];
  min: number;
  max: number;
  expected: number;
  /** Net adrenaline after the cast: gain minus cost. */
  adrenalineDelta: number;
}

/** Multi-hit rollup; the single-hit path stays the only hit math. */
export function calculateAbility(
  ability: AbilitySpec,
  input: Omit<HitInput, "band" | "crit"> & { crit: Omit<CritLayers, "eligible"> },
): AbilityResult {
  const hits = ability.hits.map((hit) =>
    calculateHit({
      ...input,
      band: hit.band,
      crit: { ...input.crit, eligible: hit.critEligible ?? true },
    }),
  );
  return {
    hits,
    min: hits.reduce((n, h) => n + h.min, 0),
    max: hits.reduce((n, h) => n + h.max, 0),
    expected: hits.reduce((n, h) => n + h.expected, 0),
    adrenalineDelta: (ability.adrenaline?.gain ?? 0) - (ability.adrenaline?.cost ?? 0),
  };
}
