import type { DamageBand } from "../core/abilityDamage";
import type { CritLayers } from "../core/critical";
import type { ItemPassiveId } from "../data/records";
import {
  outgoingSourceOf,
  provenanceForCastHit,
  type DamageProvenance,
} from "../shared/damageProvenance";
import { isBasicAttack } from "../shared/adrenalineGain";
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
  | "command_vengeful_ghost"
  | "conjure_phantom_guardian"
  | "conjure_putrid_zombie"
  | "conjure_skeleton_warrior"
  | "conjure_undead_army"
  | "conjure_vengeful_ghost"
  | "deaths_swiftness"
  | "greater_deaths_swiftness"
  | "living_death"
  | "runic_charge"
  | "shadow_imbued"
  | "preparation"
  | "revenge"
  | "balance_by_force";

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

export interface DerivedHitsSpec {
  count: number;
  intervalTicks: number;
  firstOffset: number;
  /** Uniform fraction of resolved parent (Bloat 25, Death Skulls 100). */
  fractionPct: number;
  /**
   * Per-descendant fractions of the resolved parent.
   * Corruption: [80, 60, 40, 20]. When set, length must equal count;
   * resolve uses fractionPcts[i] instead of fractionPct.
   */
  fractionPcts?: readonly number[];
  /** true = DoT family (Bloat, Corruption); false = bounce (Death Skulls). */
  dot: boolean;
}

export interface AbilitySpec {
  id: string;
  name: string;
  style: "melee" | "ranged" | "magic" | "necromancy";
  category: "basic" | "enhanced" | "threshold" | "ultimate" | "utility";
  hits: AbilityHit[];
  /** Canonical player DoT metadata used by Tearing Thorns. */
  tearingThornsEligible?: boolean;
  /** Each listed hit has a matching self-damage occurrence that advances Tearing Thorns. */
  tearingThornsSelfDamagePerHit?: boolean;
  /** Song of Destruction Essence Corruption stack and flat-damage capability. */
  essenceCorruptionEligible?: boolean;
  essenceCorruptionMagicHitEligible?: boolean;
  /** Song two-piece modifier applies to this ability's DoT hits. */
  songAffectedDot?: boolean;
  /**
   * Weapon special attack (including Essence of Finality stored specs).
   * Ring of Vigour reduces requirement and spend to 90% of original cost.
   */
  weaponSpecial?: boolean;
  /**
   * When true, cast requires a native weapon with specialAttackId === ability.id
   * or Essence of Finality with a matching stored special id.
   * Weapon specials that are always available via style alone leave this unset/false.
   */
  requiresSpecialAccess?: boolean;
  /** Minimum ticks between automatic native-special casts; manual casts ignore this policy. */
  minimumAutomaticRecastTicks?: number;
  adrenaline?: { gain?: number; cost?: number };
  cooldownSeconds?: number;
  stateEffect?: StateEffectId;
  appliesEffect?: AppliedEffectId;
  offGcd?: boolean;
  basicAttack?: boolean;
  /** @deprecated Read compatibility for pre-modernisation callers. */
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
     * Style level for second charge. When player level < this, max is 1.
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
    | "shield-or-defender"
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
  /**
   * Flat extra bleed hits already present in `hits` (Strength cape +3 on Dismember).
   * Excluded from Masterwork spear floor(base * 0.5) so cape+spear totals 15, not 16.
   * Wiki: https://runescape.wiki/w/Masterwork_Spear_of_Annihilation
   */
  flatBleedHitBonus?: number;
  /**
   * Hits derived from the resolved first hit at a fraction of it (Bloat tails,
   * Death Skulls bounces, Corruption). They inherit the source hit's crit-
   * boosted damage, never crit themselves, and are never re-modified.
   */
  derivedHits?: DerivedHitsSpec;
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
  // Wiki hit chance: Sunshine / Greater Sunshine zone DoT uses full Damage Potential.
  // https://runescape.wiki/w/Hit_chance
  const accuracy =
    ability.id === "sunshine" || ability.id === "greater_sunshine" ? 1 : input.accuracy;
  const hits = ability.hits.map((hit, index) => {
    const { damageSource, provenance } = hitProvenance(ability, hit);
    return calculateHit({
      ...input,
      accuracy,
      band: hit.band,
      crit: { ...(input.critByHit?.[index] ?? input.crit), eligible: hit.critEligible ?? true },
      provenance,
      context: {
        ...input.context,
        style: ability.style,
        dotKind: hit.dotKind,
        abilityCategory: ability.category,
        basicAttack: isBasicAttack(ability),
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
