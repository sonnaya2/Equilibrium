import { mulFloor } from "../../core/rounding";
import type { AmmunitionSupport, RangedAmmunitionMechanicId } from "../../data/ammunition";
import type { DamageProvenance } from "../../shared/damageProvenance";
import { kwuarmPoisonMultiplier, type PlayerPoisonProfile } from "../../poison/mechanics";
import type { CombatContext, CombatModifier, SourceReference } from "../../types";
import type { ExactDamageDistribution } from "../../pipeline/calculateHit";
import {
  isAmmunitionHitEligible,
  type AmmunitionAttackOrigin,
  type AmmunitionHitEligibilityInput,
} from "./ammunitionEligibility";
import type { ResolvedRangedAmmunitionProfile } from "./ammunitionProfile";

export type RangedTargetRace = "dragon" | "demon" | "other";
export type RangedAttackKind = "ability" | "auto";
export type RangedElementalWeakness = "water" | "fire" | "other" | "unknown";

export const FUL_DAMAGE_MULTIPLIER = 1.15;
export const FUL_ACCURACY_DELTA = -0.1;
export const JAS_DAMAGE_MULTIPLIER = 1.3;
export const JAS_HIT_CHANCE_BONUS_FRACTION = 0.2;
export const BANE_ABILITY_DAMAGE_MULTIPLIER = 1.25;
export const BANE_AUTO_DAMAGE_MULTIPLIER = 1.4;
export const BANE_HIT_CHANCE_BONUS_FRACTION = 0.3;
export const PERNIX_MAX_HIT_BAND_FRACTION = 0.04;
export const PERNIX_TARGET_HEALTH_THRESHOLD = 0.25;
export const OPAL_DAMAGE_MULTIPLIER = 1.1;
export const PEARL_WEAK_TO_WATER_MULTIPLIER = 1.15;
export const PEARL_WEAK_TO_FIRE_MULTIPLIER = 0.85;
export const RUBY_MIN_ABILITY_DAMAGE_FRACTION = 0.25;
export const RUBY_MAX_ABILITY_DAMAGE_FRACTION = 1.25;
export const RUBY_RECOIL_CURRENT_LIFE_FRACTION = 0.05;
export const ONYX_DAMAGE_MULTIPLIER = 1.25;
export const ONYX_HEALING_FRACTION = 0.25;
export const ONYX_HEALING_CAP = 2500;
export const DRAGONSTONE_SEPARATE_HIT_FRACTION = 0.25;
export const EMERALD_POISON_HIT_MIN_FRACTION = 0.02;
export const EMERALD_POISON_HIT_MAX_FRACTION = 0.04;

export const DIAMOND_SUPPORT: AmmunitionSupport = {
  status: "partially-modeled",
  label: "Perfect accuracy modeled",
  note: "The current damage band distribution and cap ordering for the up-to-15% increase remain unresolved.",
};

export const UNSUPPORTED_DEFENSIVE_BOLT_SUPPORT: Readonly<
  Record<"jade" | "topaz" | "sapphire", AmmunitionSupport>
> = {
  jade: {
    status: "unsupported",
    label: "No outgoing DPS modeled",
    note: "Defensive or control effect has no supported outgoing damage consumer.",
  },
  topaz: {
    status: "unsupported",
    label: "No outgoing DPS modeled",
    note: "Defensive target-stat effect is not routed into outgoing DPS.",
  },
  sapphire: {
    status: "unsupported",
    label: "No outgoing DPS modeled",
    note: "Prayer effect lacks supported target prayer state.",
  },
};

export interface RangedSourceHitModifier {
  kind: "source-hit-multiplier";
  multiplier: number;
  appliesTo: RangedAttackKind | "all";
  support?: AmmunitionSupport;
}

export interface RangedAccuracyModifier {
  kind: "accuracy-modifier";
  mode: "additive-fraction";
  additiveHitChanceFraction: number;
  appliesTo: RangedAttackKind | "all";
  stage: "pre-cap";
  support?: AmmunitionSupport;
}

export interface RangedAbilityDamagePayload {
  kind: "ability-damage-additive";
  additiveAbilityDamageFraction: number;
  targetHealthFraction: number;
  roundedStage: "existing-ranged-pipeline";
  support?: AmmunitionSupport;
}

export interface PernixMaximumHitBandPayload {
  kind: "maximum-hit-band-additive";
  fractionOfAbilityMaximum: number;
  roundedAddition: number | null;
  targetHealthFraction: number | null;
  applies: boolean;
  rounding: "floor-ability-maximum-times-fraction";
  support?: AmmunitionSupport;
}

export interface ResolvedRangedAmmunitionHitEffects {
  readonly mechanicId: RangedAmmunitionMechanicId | null;
  readonly sourceHitMultiplier: number;
  readonly damagePotentialDelta: number;
  readonly maximumHitBandFraction: number;
  readonly abilityDamageFraction: number;
  readonly accuracyOverride: number | null;
}

export interface ResolveRangedAmmunitionHitEffectsInput {
  readonly ammunition: ResolvedRangedAmmunitionProfile | null | undefined;
  readonly style: AmmunitionHitEligibilityInput["style"];
  readonly provenance: DamageProvenance;
  readonly attackOrigin?: AmmunitionAttackOrigin;
  readonly attackKind: RangedAttackKind;
  readonly targetClassification?: {
    readonly demon?: boolean;
    readonly dragon?: boolean;
    readonly elementalWeakness?: RangedElementalWeakness;
    readonly dragonfireImmune?: boolean;
  };
  readonly targetHealthFraction?: number | null;
  readonly enchantedBoltProcActive?: boolean;
}

export interface DiamondResearchGate {
  kind: "partial";
  perfectAccuracy: true;
  damageIncreaseModeled: false;
  support: AmmunitionSupport;
}

export interface DragonstoneSeparateHitPayload {
  kind: "separate-hit";
  fractionOfTriggeringHit: number;
  damageType: "dragonfire";
  blockedByTargetIsDragon: true;
  blockedByDragonfireImmunity: true;
  reTriggersAmmunition: false;
}

export interface EmeraldPoisonHit {
  kind: "poison-hit";
  min: number;
  max: number;
  persistentWeaponPoisonScheduler: false;
  support: AmmunitionSupport;
}

const SOURCE_HIT_SUPPORT: AmmunitionSupport = {
  status: "modeled",
  label: "Damage pipeline",
  note: "The shared ranged hit pipeline applies the sourced damage and accuracy stages.",
};

function targetHealthFractionOf(value: number): number {
  if (!Number.isFinite(value)) throw new Error("target health fraction must be finite");
  return Math.max(0, Math.min(1, value));
}

function qualifiesForBane(targetRace: RangedTargetRace, ammunition: "dragonbane" | "demonbane") {
  return (
    (ammunition === "dragonbane" && targetRace === "dragon") ||
    (ammunition === "demonbane" && targetRace === "demon")
  );
}

export function fulSourceHitModifier(attackKind: RangedAttackKind): RangedSourceHitModifier {
  return {
    kind: "source-hit-multiplier",
    multiplier: attackKind === "ability" ? FUL_DAMAGE_MULTIPLIER : 1,
    appliesTo: attackKind,
    support: SOURCE_HIT_SUPPORT,
  };
}

export function fulAccuracyModifier(attackKind: RangedAttackKind): RangedAccuracyModifier | null {
  return attackKind === "ability"
    ? {
        kind: "accuracy-modifier",
        mode: "additive-fraction",
        additiveHitChanceFraction: FUL_ACCURACY_DELTA,
        appliesTo: "ability",
        stage: "pre-cap",
        support: SOURCE_HIT_SUPPORT,
      }
    : null;
}

export function jasSourceHitModifier(
  targetRace: RangedTargetRace,
  ammunition: "jas-dragonbane" | "jas-demonbane",
): RangedSourceHitModifier | null {
  const qualifies =
    (ammunition === "jas-dragonbane" && targetRace === "dragon") ||
    (ammunition === "jas-demonbane" && targetRace === "demon");
  return qualifies
    ? {
        kind: "source-hit-multiplier",
        multiplier: JAS_DAMAGE_MULTIPLIER,
        appliesTo: "all",
        support: SOURCE_HIT_SUPPORT,
      }
    : null;
}

export function jasAccuracyModifier(
  targetRace: RangedTargetRace,
  ammunition: "jas-dragonbane" | "jas-demonbane",
): RangedAccuracyModifier | null {
  return jasSourceHitModifier(targetRace, ammunition)
    ? {
        kind: "accuracy-modifier",
        mode: "additive-fraction",
        additiveHitChanceFraction: JAS_HIT_CHANCE_BONUS_FRACTION,
        appliesTo: "all",
        stage: "pre-cap",
        support: SOURCE_HIT_SUPPORT,
      }
    : null;
}

export function baneSourceHitModifier(
  targetRace: RangedTargetRace,
  ammunition: "dragonbane" | "demonbane",
  attackKind: RangedAttackKind,
): RangedSourceHitModifier | null {
  return qualifiesForBane(targetRace, ammunition)
    ? {
        kind: "source-hit-multiplier",
        multiplier:
          attackKind === "ability" ? BANE_ABILITY_DAMAGE_MULTIPLIER : BANE_AUTO_DAMAGE_MULTIPLIER,
        appliesTo: attackKind,
        support: SOURCE_HIT_SUPPORT,
      }
    : null;
}

export function baneAccuracyModifier(
  targetRace: RangedTargetRace,
  ammunition: "dragonbane" | "demonbane",
): RangedAccuracyModifier | null {
  return baneSourceHitModifier(targetRace, ammunition, "ability")
    ? {
        kind: "accuracy-modifier",
        mode: "additive-fraction",
        additiveHitChanceFraction: BANE_HIT_CHANCE_BONUS_FRACTION,
        appliesTo: "all",
        stage: "pre-cap",
        support: SOURCE_HIT_SUPPORT,
      }
    : null;
}

export function pernixMaximumHitBandPayload(
  targetHealthFraction: number | null | undefined,
  abilityMaximum?: number,
): PernixMaximumHitBandPayload {
  const normalized =
    targetHealthFraction == null || !Number.isFinite(targetHealthFraction)
      ? null
      : targetHealthFractionOf(targetHealthFraction);
  const applies = normalized != null && normalized < PERNIX_TARGET_HEALTH_THRESHOLD;
  if (abilityMaximum != null && (!Number.isFinite(abilityMaximum) || abilityMaximum < 0)) {
    throw new Error("ability maximum must be finite and non-negative");
  }
  return {
    kind: "maximum-hit-band-additive",
    fractionOfAbilityMaximum: PERNIX_MAX_HIT_BAND_FRACTION,
    roundedAddition:
      applies && abilityMaximum != null
        ? Math.floor(abilityMaximum * PERNIX_MAX_HIT_BAND_FRACTION)
        : null,
    targetHealthFraction: normalized,
    applies,
    rounding: "floor-ability-maximum-times-fraction",
    support: SOURCE_HIT_SUPPORT,
  };
}

export function resolveRangedAmmunitionHitEffects(
  input: ResolveRangedAmmunitionHitEffectsInput,
): ResolvedRangedAmmunitionHitEffects {
  const mechanicId = input.ammunition?.projectile?.mechanicId ?? null;
  if (
    !isAmmunitionHitEligible({
      style: input.style,
      provenance: input.provenance,
      attackOrigin: input.attackOrigin,
    })
  ) {
    return {
      mechanicId,
      sourceHitMultiplier: 1,
      damagePotentialDelta: 0,
      maximumHitBandFraction: 0,
      abilityDamageFraction: 0,
      accuracyOverride: null,
    };
  }

  let sourceHit: RangedSourceHitModifier | null = null;
  let accuracy: RangedAccuracyModifier | null = null;
  let abilityDamageFraction = 0;
  let accuracyOverride: number | null = null;
  if (mechanicId === "ful") {
    sourceHit = fulSourceHitModifier(input.attackKind);
    accuracy = fulAccuracyModifier(input.attackKind);
  } else if (mechanicId === "jas-dragonbane" || mechanicId === "jas-demonbane") {
    const targetRace =
      mechanicId === "jas-dragonbane"
        ? input.targetClassification?.dragon === true
          ? "dragon"
          : "other"
        : input.targetClassification?.demon === true
          ? "demon"
          : "other";
    sourceHit = jasSourceHitModifier(targetRace, mechanicId);
    accuracy = jasAccuracyModifier(targetRace, mechanicId);
  } else if (mechanicId === "dragonbane" || mechanicId === "demonbane") {
    const targetRace =
      mechanicId === "dragonbane"
        ? input.targetClassification?.dragon === true
          ? "dragon"
          : "other"
        : input.targetClassification?.demon === true
          ? "demon"
          : "other";
    sourceHit = baneSourceHitModifier(targetRace, mechanicId, input.attackKind);
    accuracy = baneAccuracyModifier(targetRace, mechanicId);
  } else if (input.enchantedBoltProcActive && mechanicId === "opal") {
    sourceHit = opalSourceHitModifier();
  } else if (input.enchantedBoltProcActive && mechanicId === "pearl") {
    sourceHit = pearlSourceHitModifier(input.targetClassification?.elementalWeakness ?? "unknown");
  } else if (input.enchantedBoltProcActive && mechanicId === "ruby") {
    if (input.targetHealthFraction != null) {
      abilityDamageFraction = rubyBloodForfeitPayload(
        input.targetHealthFraction,
      ).additiveAbilityDamageFraction;
    }
  } else if (input.enchantedBoltProcActive && mechanicId === "diamond") {
    const diamond = resolveDiamondSourceHit();
    accuracyOverride = diamond.perfectAccuracy ? 1 : null;
  } else if (input.enchantedBoltProcActive && mechanicId === "onyx") {
    sourceHit = onyxSourceHitModifier();
  }

  const pernix = input.ammunition?.quiver?.passiveIds.includes("pernix-quiver-max-hit-band")
    ? pernixMaximumHitBandPayload(input.targetHealthFraction)
    : null;
  const diamondMaximumHitBandFraction = 0;
  return {
    mechanicId,
    sourceHitMultiplier: sourceHit?.multiplier ?? 1,
    damagePotentialDelta: accuracy?.additiveHitChanceFraction ?? 0,
    maximumHitBandFraction:
      (pernix?.applies ? pernix.fractionOfAbilityMaximum : 0) + diamondMaximumHitBandFraction,
    abilityDamageFraction,
    accuracyOverride,
  };
}

export function opalSourceHitModifier(): RangedSourceHitModifier {
  return {
    kind: "source-hit-multiplier",
    multiplier: OPAL_DAMAGE_MULTIPLIER,
    appliesTo: "all",
    support: SOURCE_HIT_SUPPORT,
  };
}

export function pearlSourceHitModifier(
  weakness: RangedElementalWeakness,
): RangedSourceHitModifier | null {
  if (weakness === "water") {
    return {
      kind: "source-hit-multiplier",
      multiplier: PEARL_WEAK_TO_WATER_MULTIPLIER,
      appliesTo: "all",
      support: SOURCE_HIT_SUPPORT,
    };
  }
  if (weakness === "fire") {
    return {
      kind: "source-hit-multiplier",
      multiplier: PEARL_WEAK_TO_FIRE_MULTIPLIER,
      appliesTo: "all",
      support: SOURCE_HIT_SUPPORT,
    };
  }
  return null;
}

export function rubyBloodForfeitPayload(targetHealthFraction: number): RangedAbilityDamagePayload {
  const normalized = targetHealthFractionOf(targetHealthFraction);
  return {
    kind: "ability-damage-additive",
    additiveAbilityDamageFraction:
      RUBY_MIN_ABILITY_DAMAGE_FRACTION +
      normalized * (RUBY_MAX_ABILITY_DAMAGE_FRACTION - RUBY_MIN_ABILITY_DAMAGE_FRACTION),
    targetHealthFraction: normalized,
    roundedStage: "existing-ranged-pipeline",
    support: SOURCE_HIT_SUPPORT,
  };
}

export function rubyRecoilDamage(currentPlayerLifePoints: number): number {
  if (!Number.isFinite(currentPlayerLifePoints) || currentPlayerLifePoints < 0) {
    throw new Error("current player life points must be finite and non-negative");
  }
  return Math.floor(currentPlayerLifePoints * RUBY_RECOIL_CURRENT_LIFE_FRACTION);
}

export function resolveDiamondSourceHit(): DiamondResearchGate {
  return {
    kind: "partial",
    perfectAccuracy: true,
    damageIncreaseModeled: false,
    support: DIAMOND_SUPPORT,
  };
}

export function onyxSourceHitModifier(): RangedSourceHitModifier {
  return {
    kind: "source-hit-multiplier",
    multiplier: ONYX_DAMAGE_MULTIPLIER,
    appliesTo: "all",
    support: SOURCE_HIT_SUPPORT,
  };
}

export function onyxHealingAmount(originalDamagePotential: number): number {
  if (!Number.isFinite(originalDamagePotential) || originalDamagePotential < 0) {
    throw new Error("original damage potential must be finite and non-negative");
  }
  return Math.min(ONYX_HEALING_CAP, Math.floor(originalDamagePotential * ONYX_HEALING_FRACTION));
}

const EMERALD_POISON_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Enchant_Crossbow_Bolt_%28Emerald%29",
  title: "Enchant Crossbow Bolt (Emerald)",
  verifiedAt: "2026-08-09",
};

export function emeraldExternalPoisonMultiplier(profile: PlayerPoisonProfile | undefined): number {
  if (!profile) return 1;
  return (
    (profile.cinderbane ? 1.25 : 1) *
    kwuarmPoisonMultiplier(profile.kwuarmPotency) *
    (profile.blowpipe ? 0.5 : 1) *
    (profile.laniakea ? 1.05 : 1)
  );
}

export function emeraldExternalPoisonModifier(
  profile: PlayerPoisonProfile | undefined,
): CombatModifier | null {
  const multiplier = emeraldExternalPoisonMultiplier(profile);
  if (multiplier === 1) return null;
  return {
    id: "ammo:emerald-external-poison",
    stage: "target",
    priority: -20,
    appliesToPlayerPoison: true,
    applies: (context: CombatContext) => context.dotKind === "poison",
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
    source: EMERALD_POISON_SOURCE,
  };
}

export function dragonstoneSeparateHitPayload(): DragonstoneSeparateHitPayload {
  return {
    kind: "separate-hit",
    fractionOfTriggeringHit: DRAGONSTONE_SEPARATE_HIT_FRACTION,
    damageType: "dragonfire",
    blockedByTargetIsDragon: true,
    blockedByDragonfireImmunity: true,
    reTriggersAmmunition: false,
  };
}

export function dragonstoneSeparateHitDamage(triggeringHitDamage: number): number {
  if (!Number.isFinite(triggeringHitDamage) || triggeringHitDamage < 0) {
    throw new Error("triggering hit damage must be finite and non-negative");
  }
  return Math.floor(triggeringHitDamage * DRAGONSTONE_SEPARATE_HIT_FRACTION);
}

export function dragonstoneSeparateHitExpected(
  sourceDistribution: readonly ExactDamageDistribution[],
  activationChance: number,
  cap = 30_000,
): number {
  if (!Number.isFinite(activationChance) || activationChance < 0 || activationChance > 1) {
    throw new Error("Dragonstone activation chance must be between 0 and 1");
  }
  if (!Number.isFinite(cap) || cap < 0)
    throw new Error("Dragonstone cap must be finite and non-negative");
  const weight = sourceDistribution.reduce((total, outcome) => total + outcome.weight, 0);
  if (!Number.isFinite(weight) || Math.abs(weight - 1) > 1e-9) {
    throw new Error("Dragonstone source distribution must have unit mass");
  }
  return (
    activationChance *
    sourceDistribution.reduce(
      (total, outcome) =>
        total + Math.min(cap, dragonstoneSeparateHitDamage(outcome.damage)) * outcome.weight,
      0,
    )
  );
}

export function dragonstoneCanHitTarget(args: {
  targetIsDragon: boolean;
  targetHasDragonfireImmunity: boolean;
}): boolean {
  return !args.targetIsDragon && !args.targetHasDragonfireImmunity;
}

export function emeraldPoisonHit(weaponDamage: number): EmeraldPoisonHit {
  if (!Number.isFinite(weaponDamage) || weaponDamage < 0) {
    throw new Error("weapon damage must be finite and non-negative");
  }
  return {
    kind: "poison-hit",
    min: Math.floor(weaponDamage * EMERALD_POISON_HIT_MIN_FRACTION),
    max: Math.floor(weaponDamage * EMERALD_POISON_HIT_MAX_FRACTION),
    persistentWeaponPoisonScheduler: false,
    support: {
      status: "modeled",
      label: "Poison hit",
      note: "The single poison-type hit uses supported player-poison modifiers and immunity.",
    },
  };
}

export function unsupportedBoltSupport(
  mechanicId: RangedAmmunitionMechanicId,
): AmmunitionSupport | null {
  if (mechanicId === "jade" || mechanicId === "topaz" || mechanicId === "sapphire") {
    return UNSUPPORTED_DEFENSIVE_BOLT_SUPPORT[mechanicId];
  }
  return null;
}
