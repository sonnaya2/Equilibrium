import type { DamageBand } from "../core/abilityDamage";
import type { CritLayers } from "../core/critical";
import { calculateHit, type HitInput, type HitResult } from "./calculateHit";

export interface AbilityHit {
  band: DamageBand;
  critEligible?: boolean;
  tickOffset?: number;
  /**
   * This hit is a damage-over-time tick, so it ignores damage-boosting prayers
   * and the Berserk / Death's Swiftness / Sunshine windows (wiki Dismember /
   * Slaughter / Massacre). Declared, never inferred: damage over time is a
   * separate axis from crit eligibility and from landing late. Magma Tempest
   * cannot crit and lands over 16 ticks yet is explicitly "not considered as
   * damage over time", and Corruption Shot's first bleed tick lands on the
   * cast tick.
   */
  dot?: boolean;
}

export type StateEffectId =
  | "berserk"
  | "conjure_phantom_guardian"
  | "conjure_putrid_zombie"
  | "conjure_skeleton_warrior"
  | "conjure_undead_army"
  | "conjure_vengeful_ghost"
  | "deaths_swiftness"
  | "greater_deaths_swiftness"
  | "living_death"
  | "runic_charge"
  | "shadow_imbued";

export type AppliedEffectId =
  | "chaos_roar"
  | "fury"
  | "greater_barge"
  | "greater_flurry"
  | "greater_fury"
  | "greater_sunshine"
  | "instability"
  | "meteor_strike"
  | "pulverise"
  | "searing_winds"
  | "sunshine";

export type SupportStatus = "partially-modeled" | "not-modeled" | "mechanics-unverified";

export interface AbilitySpec {
  id: string;
  name: string;
  style: "melee" | "ranged" | "magic" | "necromancy";
  category: "basic" | "enhanced" | "ultimate" | "utility";
  hits: AbilityHit[];
  adrenaline?: { gain?: number; cost?: number };
  cooldownSeconds?: number;
  stateEffect?: StateEffectId;
  appliesEffect?: AppliedEffectId;
  offGcd?: boolean;
  autoAttack?: boolean;
  guaranteedCrit?: boolean;
  /** Equivalent variants share one cooldown and cannot coexist in one action list. */
  replacementGroup?: string;
  /** Shared logical cooldown when distinct ids represent one live timer. */
  cooldownGroup?: string;
  weaponRequirement?: "twohand" | "dualwield" | "mainhand" | "death-guard-and-conduit";
  /** At least one of these catalogue items must be equipped. */
  requiredEquipmentAnyOf?: readonly string[];
  /**
   * Channelled cast occupancy in ticks (last hit offset + 1 — the actor is free
   * the tick after the final hit lands). Absent = one global cooldown.
   */
  channelTicks?: number;
  /**
   * Honest support label shown to users when anything material is missing.
   * Absent = fully modeled within the calculator's generic-target scope.
   */
  supportStatus?: SupportStatus;
  supportNote?: string;
}

export interface AbilityResult {
  hits: HitResult[];
  min: number;
  max: number;
  expected: number;
  adrenalineDelta: number;
}

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
