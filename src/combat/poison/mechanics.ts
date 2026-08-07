export type WeaponPoisonChoice =
  "none" | "weapon" | "weapon-plus" | "weapon-plus-plus" | "weapon-plus-plus-plus";

export type PoisonTier = 1 | 2 | 3 | 4 | 5;
export type KwuarmPotency = 0 | 1 | 2 | 3 | 4;

export interface PlayerPoisonProfile {
  readonly potion: WeaponPoisonChoice;
  readonly potionUntilTick: number;
  readonly kwuarmPotency: KwuarmPotency;
  readonly cinderbane: boolean;
  readonly blowpipe: boolean;
  readonly laniakea: boolean;
}

export interface PoisonApplicationSnapshot {
  readonly effectiveTier: PoisonTier;
  readonly procChance: number;
  readonly cadenceTicks: 8 | 16;
  readonly hitBudget: 18 | 36;
  readonly sourceDamageMultiplier: number;
  readonly cinderbaneContinuation: boolean;
  readonly continuationChance: number;
  readonly sourceLabel: string;
}

export interface PoisonDamageBand {
  readonly min: number;
  readonly expected: number;
  readonly max: number;
}

export const PLAYER_POISON_EFFECT_ID = "player_weapon_poison";
export const PLAYER_POISON_STATUS_TICKS = 300;
export const PLAYER_POISON_FIRST_HIT_DELAY = 2;
export const PLAYER_POISON_ZERO_DAMAGE_DECAY_INDEX = 44;
export const EVOLVING_TOXIN_MAX_STACKS = 150;
export const EVOLVING_TOXIN_DURATION_TICKS = 50;
export const CINDERBANE_SUPPORT_NOTE =
  "Recursive poison-hit refreshes are modeled as successive 1/8 rolls.";
export const PLAYER_POISON_SUPPORT_NOTE =
  "Integer rounding and ability-damage snapshot timing remain mechanically unverified.";

const BIK_ARROW_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Bik_arrow",
  title: "Bik arrow",
  verifiedAt: "2026-08-06",
};

const PLAYER_POISON_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Poison#Player_poison",
  title: "Poison - Player poison",
  verifiedAt: "2026-08-06",
};

const POTION_TIER: Readonly<Record<WeaponPoisonChoice, 0 | 1 | 2 | 3 | 4>> = {
  none: 0,
  weapon: 1,
  "weapon-plus": 2,
  "weapon-plus-plus": 3,
  "weapon-plus-plus-plus": 4,
};

const POTION_DURATION: Readonly<Record<WeaponPoisonChoice, number>> = {
  none: 0,
  weapon: 250,
  "weapon-plus": 500,
  "weapon-plus-plus": 1_000,
  "weapon-plus-plus-plus": 1_200,
};

const TIER_COEFFICIENT: Readonly<Record<PoisonTier, number>> = {
  1: 0.2,
  2: 0.25,
  3: 0.3,
  4: 0.35,
  5: 0.4,
};

const POISON_CHOICES = new Set<WeaponPoisonChoice>(
  Object.keys(POTION_TIER) as WeaponPoisonChoice[],
);

export const NO_PLAYER_POISON: PlayerPoisonProfile = {
  potion: "none",
  potionUntilTick: 0,
  kwuarmPotency: 0,
  cinderbane: false,
  blowpipe: false,
  laniakea: false,
};

export function normalizeWeaponPoisonChoice(value: unknown): WeaponPoisonChoice {
  return typeof value === "string" && POISON_CHOICES.has(value as WeaponPoisonChoice)
    ? (value as WeaponPoisonChoice)
    : "none";
}

export function normalizeKwuarmPotency(value: unknown): KwuarmPotency {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 4
    ? (value as KwuarmPotency)
    : 0;
}

export function weaponPoisonDurationTicks(choice: WeaponPoisonChoice): number {
  return POTION_DURATION[choice];
}

export function poisonTierCoefficient(tier: PoisonTier): number {
  return TIER_COEFFICIENT[tier];
}

export function kwuarmPoisonMultiplier(potency: KwuarmPotency): number {
  return 1 + 0.025 * potency;
}

export function evolvingToxinMultiplier(stacks: number): number {
  return 1 + 0.03 * Math.max(0, Math.min(EVOLVING_TOXIN_MAX_STACKS, Math.floor(stacks)));
}

export function evolvingToxinPoisonModifier(stacks: number): CombatModifier | null {
  const multiplier = evolvingToxinMultiplier(stacks);
  if (multiplier === 1) return null;
  return {
    id: "ammo:bik-evolving-toxin",
    stage: "target",
    priority: -10,
    appliesToPlayerPoison: true,
    applies: (context) => context.dotKind === "poison",
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
    source: BIK_ARROW_SOURCE,
  };
}

export function poisonProfileDamageMultiplier(
  profile: PlayerPoisonProfile | undefined,
  atTick: number,
): number {
  if (!profile) return 1;
  const application = resolvePoisonApplication(profile, atTick);
  if (!application) {
    return kwuarmPoisonMultiplier(profile.kwuarmPotency) * (profile.laniakea ? 1.05 : 1);
  }
  return (
    (poisonTierCoefficient(application.effectiveTier) / poisonTierCoefficient(1)) *
    application.sourceDamageMultiplier
  );
}

export function poisonProfileDamageModifier(
  profile: PlayerPoisonProfile | undefined,
  atTick: number,
): CombatModifier | null {
  const multiplier = poisonProfileDamageMultiplier(profile, atTick);
  if (multiplier === 1) return null;
  return {
    id: "poison:active-profile",
    stage: "target",
    priority: -20,
    appliesToPlayerPoison: true,
    applies: (context) => context.dotKind === "poison",
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
    source: PLAYER_POISON_SOURCE,
  };
}

export function activeEvolvingToxinStacks(
  stacks: number,
  expiresAtTick: number,
  atTick: number,
): number {
  return atTick < expiresAtTick
    ? Math.max(0, Math.min(EVOLVING_TOXIN_MAX_STACKS, Math.floor(stacks)))
    : 0;
}

export function nextEvolvingToxin(
  stacks: number,
  expiresAtTick: number,
  atTick: number,
): { stacks: number; expiresAtTick: number } {
  return {
    stacks: Math.min(
      EVOLVING_TOXIN_MAX_STACKS,
      activeEvolvingToxinStacks(stacks, expiresAtTick, atTick) + 1,
    ),
    expiresAtTick: atTick + EVOLVING_TOXIN_DURATION_TICKS,
  };
}

export function isTargetPoisonImmune(
  targetPoisonImmune: boolean | undefined,
  immunityDisabledUntilTick: number,
  atTick: number,
): boolean {
  return targetPoisonImmune === true && atTick >= immunityDisabledUntilTick;
}

function labelFor(profile: PlayerPoisonProfile, tier: PoisonTier): string {
  const sources: string[] = [];
  if (profile.cinderbane) sources.push("Cinderbane");
  if (profile.blowpipe) sources.push("upgraded bone blowpipe");
  if (profile.potion !== "none") sources.push(profile.potion.replaceAll("-", " "));
  return `${sources.join(" + ")} (tier ${tier})`;
}

export function resolvePoisonApplication(
  profile: PlayerPoisonProfile | undefined,
  atTick: number,
): PoisonApplicationSnapshot | null {
  if (!profile) return null;
  const potionTier = atTick < profile.potionUntilTick ? POTION_TIER[profile.potion] : 0;
  const otherTier = Math.max(potionTier, profile.blowpipe ? 1 : 0);
  const effectiveTier = profile.cinderbane
    ? Math.min(5, otherTier > 0 ? otherTier + 1 : 2)
    : otherTier;
  if (effectiveTier === 0) return null;
  const tier = effectiveTier as PoisonTier;
  return {
    effectiveTier: tier,
    procChance: 0.125 + (profile.laniakea ? 0.05 : 0),
    cadenceTicks: profile.blowpipe ? 8 : 16,
    hitBudget: profile.blowpipe ? 36 : 18,
    sourceDamageMultiplier:
      (profile.blowpipe ? 0.5 : 1) *
      (profile.laniakea ? 1.05 : 1) *
      kwuarmPoisonMultiplier(profile.kwuarmPotency),
    cinderbaneContinuation: profile.cinderbane,
    continuationChance: profile.laniakea ? 0.175 : 0.125,
    sourceLabel: labelFor(profile, tier),
  };
}

export function playerPoisonDamage(
  abilityDamage: number,
  tier: PoisonTier,
  decayIndex: number,
  sourceDamageMultiplier: number,
): PoisonDamageBand {
  const minFactor = Math.max(0, 0.65 - 0.015 * decayIndex);
  const maxFactor = Math.max(0, 1.3 - 0.03 * decayIndex);
  const base = abilityDamage * poisonTierCoefficient(tier) * sourceDamageMultiplier;
  return {
    min: base * minFactor,
    expected: base * ((minFactor + maxFactor) / 2),
    max: base * maxFactor,
  };
}
import { mulFloor } from "../core/rounding";
import type { CombatModifier, SourceReference } from "../types";
