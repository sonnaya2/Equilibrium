import type { DamageBand } from "../core/abilityDamage";
import type { CritLayers } from "../core/critical";
import type { ItemPassiveId } from "../data/records";
import {
  outgoingSourceOf,
  provenanceForCastHit,
  type DamageProvenance,
} from "../shared/damageProvenance";
import { COMMAND_REQUIRES_CONJURE } from "../styles/necromancy/conjures";
import type { BleedId, DamageOverTimeKind, OutgoingDamageSource } from "../types";
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
  dotKind?: DamageOverTimeKind;
  bleedId?: BleedId;
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
  /**
   * Weapon special attack (including Essence of Finality stored specs).
   * Ring of Vigour reduces requirement and spend to 90% of original cost.
   */
  weaponSpecial?: boolean;
  adrenaline?: { gain?: number; cost?: number };
  cooldownSeconds?: number;
  stateEffect?: StateEffectId;
  appliesEffect?: AppliedEffectId;
  offGcd?: boolean;
  autoAttack?: boolean;
  /** Declared targeting shape used by mechanics such as Splash Zone. */
  area?: "aoe" | "multi-target";
  guaranteedCrit?: boolean;
  /** Equivalent variants share one cooldown and cannot coexist in one action list. */
  replacementGroup?: string;
  /** Shared logical cooldown when distinct ids represent one live timer. */
  cooldownGroup?: string;
  /**
   * Independent charges. Absent = single-slot via cooldowns map.
   * Recovery clocks live on RotationState.charges (not cooldowns[key]).
   */
  charges?: {
    /** Fully unlocked max (2 for stun basics). */
    max: number;
    /**
     * Style level for second charge (54). When player level < this, max is 1.
     * Product default level is 120 -> 2 charges.
     */
    secondChargeLevel?: number;
  };
  /**
   * Weapon shape gate. Necromancy conjures use `"conduit"` (wiki: Conjuration
   * requires an off-hand conduit). `"death-guard-and-conduit"` is full dual
   * necro shape. Other styles use twohand / dualwield / mainhand.
   */
  weaponRequirement?:
    | "twohand"
    | "dualwield"
    | "mainhand"
    | "mainhand-empty"
    | "conduit"
    | "death-guard-and-conduit";
  /** At least one of these catalogue items must be equipped. */
  requiredEquipmentAnyOf?: readonly string[];
  /**
   * At least one of these equipment passives must be active (capability gate).
   * Prefer this over item-id lists when multiple items grant the same unlock.
   */
  requiredPassiveAnyOf?: readonly ItemPassiveId[];
  /**
   * Channelled cast occupancy in ticks (last hit offset + 1 - the actor is free
   * the tick after the final hit lands). Absent = one global cooldown.
   */
  channelTicks?: number;
  /**
   * Honest support label shown to users when anything material is missing.
   * Absent = fully modeled within the calculator's generic-target scope.
   */
  supportStatus?: SupportStatus;
  supportNote?: string;
  /**
   * Bleed-tail duration extension from a named equipment passive (e.g. Masterwork
   * Spear of Annihilation). Declared on the ability; scheduling code reads this
   * metadata and never hardcodes ability ids for eligibility.
   */
  bleedDurationExtension?: {
    equipmentPassive: "masterwork-spear-bleed-extension";
  };
}

export interface AbilityResult {
  hits: HitResult[];
  min: number;
  max: number;
  expected: number;
  /**
   * Catalogue listed gain - listed cost only.
   * Not loadout economy and not a cast transaction. Prefer
   * previewAdrenalineTransaction / cast adrenalineTransaction for real deltas.
   */
  listedAdrenalineDelta: number;
  /**
   * Economy net when resolved (league analysis or cast commit).
   * Absent on bare calculateAbility results.
   */
  adrenalineDelta?: number;
}

function hitProvenance(
  ability: AbilitySpec,
  hit: AbilityHit,
): { damageSource: OutgoingDamageSource; provenance: DamageProvenance } {
  // Converted channel is cast-time only (schedule channelAsDot); AbilityHit has no flag for it.
  const provenance = provenanceForCastHit({
    isCommand: COMMAND_REQUIRES_CONJURE[ability.id] !== undefined,
    isDot: hit.dot === true || hit.dotKind != null,
    autoAttack: ability.autoAttack,
    dotKind: hit.dotKind,
    bleedId: hit.bleedId,
  });
  return { damageSource: outgoingSourceOf(provenance), provenance };
}

export function calculateAbility(
  ability: AbilitySpec,
  input: Omit<HitInput, "band" | "crit"> & {
    crit: Omit<CritLayers, "eligible">;
    critByHit?: readonly Omit<CritLayers, "eligible">[];
  },
): AbilityResult {
  const hits = ability.hits.map((hit, index) => {
    const { damageSource, provenance } = hitProvenance(ability, hit);
    return calculateHit({
      ...input,
      band: hit.band,
      crit: { ...(input.critByHit?.[index] ?? input.crit), eligible: hit.critEligible ?? true },
      provenance,
      context: {
        ...input.context,
        style: ability.style,
        dotKind: hit.dotKind,
        abilityCategory: ability.category,
        autoAttack: ability.autoAttack,
        area: ability.area,
        damageSource,
        provenance,
      },
    });
  });
  return {
    hits,
    min: hits.reduce((n, h) => n + h.min, 0),
    max: hits.reduce((n, h) => n + h.max, 0),
    expected: hits.reduce((n, h) => n + h.expected, 0),
    listedAdrenalineDelta: (ability.adrenaline?.gain ?? 0) - (ability.adrenaline?.cost ?? 0),
  };
}
