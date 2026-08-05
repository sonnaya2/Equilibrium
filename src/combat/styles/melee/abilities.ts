import type { SourceReference } from "../../types";
import type { AbilityHit, AbilitySpec } from "../../pipeline/calculateAbility";

/**
 * Post-modernisation melee kit. Bands and adrenaline are wiki-verified (Melee
 * abilities list + individual pages, verifiedAt 2026-07-26). Bleed tails are
 * crit-ineligible by default. Variable / target-stage effects stay in MELEE_EFFECTS.
 */
export interface MeleeAbilitySpec extends AbilitySpec {
  style: "melee";
  bloodlustGain?: number;
  /** Higher per-hit band once a Bloodlust threshold is met (Assault at 4). */
  bloodlustScale?: { threshold: number; band: { minPct: number; maxPct: number } };
  /** Extra hit(s) appended when Bloodlust threshold is met (Hurricane at 4). */
  bloodlustExtraHits?: { threshold: number; hits: AbilityHit[] };
  /**
   * Bloodlust empowerment scaling with the target's missing life points
   * (Flurry / Greater Flurry at 4): +1% damage per 1% missing LP, capped.
   * Needs targetHpPercent in the simulation input; without it the stacks are
   * still consumed but no bonus applies (partially modeled).
   */
  bloodlustMissingHp?: { threshold: number; capPct: number };
  /** Channelled cast: Chaos Roar empowers first hit only (wiki). */
  channelled?: boolean;
  /** Bleed-chain enabler: Dismember -> Slaughter -> Massacre. */
  enables?: string;
  /**
   * Bleed-chain predecessor this cast needs live (Slaughter needs Dismember,
   * Massacre needs Slaughter, within the 40-tick recast window).
   */
  recastOf?: "dismember" | "slaughter";
  source: SourceReference;
}

export function isMeleeAbility(ability: AbilitySpec): ability is MeleeAbilitySpec {
  return ability.style === "melee";
}

const wikiAbility = (title: string, path: string, verifiedAt = "2026-07-26"): SourceReference => ({
  source: "runescape-wiki",
  url: `https://runescape.wiki/w/${path}`,
  title,
  verifiedAt,
});

export const CHAOS_ROAR_DAMAGE_MULTIPLIER = 1.75;
export const CHAOS_ROAR_DURATION_SECONDS = 7.2;
export const GREATER_FURY_CRIT_WINDOW_SECONDS = 15;
export const METEOR_STRIKE_ADREN_BUFF_SECONDS = 30;
/** Dismember chain: a recast must land within this window of the previous cast. */
export const BLEED_CHAIN_RECAST_WINDOW_TICKS = 40;
/** Punish: x2.5 when the target is below 50% life points (wiki, verified 2026-07-31). */
export const PUNISH_LOW_HP_MULTIPLIER = 2.5;
export const PUNISH_LOW_HP_THRESHOLD_PCT = 50;

/** Wiki Adaptive Strike: MH empty OH and 2h share this ST band (cone multi = ST scope). */
export const ADAPTIVE_STRIKE_PRIMARY_BAND = { minPct: 120, maxPct: 140 } as const;
/** Wiki Adaptive Strike dual-wield: each of two hits. */
export const ADAPTIVE_STRIKE_DW_HIT_BAND = { minPct: 60, maxPct: 75 } as const;

export type AdaptiveStrikeWeaponConfiguration =
  | "twohand"
  | "dualwield"
  | "mainhand"
  | "shield"
  | "defender"
  | "necromancy";

/**
 * Legal Adaptive Strike engine form for a resolved weapon shape.
 * MH + shield uses the main-hand form (same 120-140 band as empty OH).
 * Defender / necro / unknown => no form (null).
 * Manual / Revo / solver must use this; never re-read UI slots in the engine.
 */
export function adaptiveStrikeEngineId(
  weaponConfiguration: AdaptiveStrikeWeaponConfiguration | undefined,
): string | null {
  switch (weaponConfiguration) {
    case "twohand":
      return "adaptive_strike_2h";
    case "dualwield":
      return "adaptive_strike_dw";
    case "mainhand":
    case "shield":
      return "adaptive_strike_mh";
    default:
      return null;
  }
}

/** Wiki bar setup string -> weapon shape when loadout config is not supplied. */
export function weaponConfigurationFromBarSetup(
  setup?: string,
): AdaptiveStrikeWeaponConfiguration | undefined {
  if (!setup || setup === "Any") return undefined;
  if (setup === "Two-handed") return "twohand";
  if (setup === "Dual wield" || setup === "Dual-wield") return "dualwield";
  return undefined;
}

export const MELEE_ABILITIES: MeleeAbilitySpec[] = [
  {
    // Wiki Attack (ability): 110-130, +9% adren, +1 Bloodlust, auto-triggered.
    id: "attack",
    name: "Attack",
    style: "melee",
    category: "basic",
    autoAttack: true,
    hits: [{ band: { minPct: 110, maxPct: 130 } }],
    adrenaline: { gain: 9 },
    bloodlustGain: 1,
    source: wikiAbility("Attack (ability)", "Attack_(ability)"),
  },
  {
    // Wiki Adaptive Strike: +12% adren, 5.4s CD; MH empty OH / 2h 120-140; DW 2x 60-75.
    id: "adaptive_strike_2h",
    name: "Adaptive Strike (two-handed)",
    style: "melee",
    category: "basic",
    hits: [{ band: { ...ADAPTIVE_STRIKE_PRIMARY_BAND } }],
    adrenaline: { gain: 12 },
    cooldownSeconds: 5.4,
    bloodlustGain: 1,
    weaponRequirement: "twohand",
    replacementGroup: "adaptive_strike",
    source: wikiAbility("Adaptive Strike", "Adaptive_Strike", "2026-08-04"),
  },
  {
    id: "adaptive_strike_mh",
    name: "Adaptive Strike (main-hand)",
    style: "melee",
    category: "basic",
    hits: [{ band: { ...ADAPTIVE_STRIKE_PRIMARY_BAND } }],
    adrenaline: { gain: 12 },
    cooldownSeconds: 5.4,
    bloodlustGain: 1,
    weaponRequirement: "mainhand-empty",
    replacementGroup: "adaptive_strike",
    source: wikiAbility("Adaptive Strike", "Adaptive_Strike", "2026-08-04"),
  },
  {
    id: "adaptive_strike_dw",
    name: "Adaptive Strike (dual wield)",
    style: "melee",
    category: "basic",
    hits: [
      { band: { ...ADAPTIVE_STRIKE_DW_HIT_BAND } },
      { band: { ...ADAPTIVE_STRIKE_DW_HIT_BAND } },
    ],
    adrenaline: { gain: 12 },
    cooldownSeconds: 5.4,
    bloodlustGain: 1,
    weaponRequirement: "dualwield",
    replacementGroup: "adaptive_strike",
    source: wikiAbility("Adaptive Strike", "Adaptive_Strike", "2026-08-04"),
  },
  {
    id: "rend",
    name: "Rend",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 135, maxPct: 165 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 10.2,
    bloodlustGain: 2,
    source: wikiAbility("Rend", "Rend"),
  },
  {
    // Wiki Fury: 110-130, +25% next crit chance, +1 Bloodlust, +9% adren, 15s CD.
    id: "fury",
    name: "Fury",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 110, maxPct: 130 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 15,
    replacementGroup: "fury",
    bloodlustGain: 1,
    appliesEffect: "fury",
    source: wikiAbility("Fury", "Fury"),
  },
  {
    // Wiki Greater Fury: 120-140, next non-bleed melee guaranteed crit 15s, +1 BL, +9% adren.
    id: "greater_fury",
    name: "Greater Fury",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 120, maxPct: 140 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 15,
    replacementGroup: "fury",
    bloodlustGain: 1,
    appliesEffect: "greater_fury",
    source: wikiAbility("Greater Fury", "Greater_Fury"),
  },
  {
    // Wiki Backhand: 95-105, stun/bind 1.8s, +1 BL, +9% adren, 15s CD; 2 charges at 54 Attack.
    id: "backhand",
    name: "Backhand",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 95, maxPct: 105 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 15,
    charges: { max: 2, secondChargeLevel: 54 },
    bloodlustGain: 1,
    source: wikiAbility("Backhand", "Backhand"),
  },
  {
    // Wiki Punish: 110-130 base; 2.5x when target LP < 50% (target-stage); +1 BL, +9%, 24s CD.
    id: "punish",
    name: "Punish",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 110, maxPct: 130 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 24,
    bloodlustGain: 1,
    source: wikiAbility("Punish", "Punish"),
  },
  {
    // Wiki Barge: 75-95, gap-close 10 tiles, bind 6.6s, +1 BL, +9%, 20.4s CD.
    id: "barge",
    name: "Barge",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 75, maxPct: 95 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 20.4,
    replacementGroup: "barge",
    bloodlustGain: 1,
    source: wikiAbility("Barge", "Barge"),
  },
  {
    // Wiki Greater Barge: same base 75-95; idle add-on and channelled-as-DoT in MELEE_EFFECTS.
    id: "greater_barge",
    name: "Greater Barge",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 75, maxPct: 95 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 20.4,
    replacementGroup: "barge",
    bloodlustGain: 1,
    appliesEffect: "greater_barge",
    source: wikiAbility("Greater Barge", "Greater_Barge"),
  },
  {
    // Wiki Chaos Roar: 100-120 hit, +9% adren, +1 BL, next melee 1.75x for 7.2s, 60s CD.
    id: "chaos_roar",
    name: "Chaos Roar",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 100, maxPct: 120 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 60,
    bloodlustGain: 1,
    appliesEffect: "chaos_roar",
    source: wikiAbility("Chaos Roar", "Chaos_Roar"),
  },
  {
    // Wiki Dismember: enhanced bleed book, 0% adren, 8x 25-35 every 1.2s, 24s CD.
    // Strength cape (99) adds three extra hits of the same band (see withStrengthCape99).
    id: "dismember",
    name: "Dismember",
    style: "melee",
    category: "enhanced",
    hits: Array.from({ length: 8 }, (_, i) => ({
      band: { minPct: 25, maxPct: 35 },
      critEligible: false,
      dot: true,
      dotKind: "bleed",
      bleedId: "dismember",
      tickOffset: (i + 1) * 2,
    })),
    bleedDurationExtension: { equipmentPassive: "masterwork-spear-bleed-extension" },
    cooldownSeconds: 24,
    enables: "slaughter",
    source: wikiAbility("Dismember", "Dismember"),
  },
  {
    id: "slaughter",
    name: "Slaughter",
    style: "melee",
    category: "enhanced",
    hits: Array.from({ length: 6 }, (_, i) => ({
      band: { minPct: 80, maxPct: 100 },
      critEligible: false,
      dot: true,
      dotKind: "bleed",
      bleedId: "slaughter",
      tickOffset: (i + 1) * 3,
    })),
    bleedDurationExtension: { equipmentPassive: "masterwork-spear-bleed-extension" },
    adrenaline: { cost: 25 },
    enables: "massacre",
    recastOf: "dismember",
    source: wikiAbility("Slaughter", "Slaughter"),
  },
  {
    id: "massacre",
    name: "Massacre",
    style: "melee",
    category: "enhanced",
    hits: [
      { band: { minPct: 110, maxPct: 130 } },
      ...Array.from({ length: 6 }, (_, i) => ({
        band: { minPct: 100, maxPct: 100 },
        critEligible: false,
        dot: true,
        dotKind: "bleed" as const,
        bleedId: "massacre" as const,
        tickOffset: (i + 1) * 4,
      })),
    ],
    // Wiki Masterwork Spear: Massacre is eligible (7→10 total; only the 6 bleed ticks extend).
    bleedDurationExtension: { equipmentPassive: "masterwork-spear-bleed-extension" },
    adrenaline: { cost: 25 },
    recastOf: "slaughter",
    source: wikiAbility("Massacre", "Massacre"),
  },
  {
    // Wiki Assault: 4x 130-150 over 4.2s; at 4 Bloodlust 170-190 each; 25% cost; 6s CD.
    id: "assault",
    name: "Assault",
    style: "melee",
    category: "enhanced",
    channelled: true,
    channelTicks: 8,
    hits: Array.from({ length: 4 }, (_, i) => ({
      band: { minPct: 130, maxPct: 150 },
      tickOffset: 1 + i * 2,
    })),
    adrenaline: { cost: 25 },
    cooldownSeconds: 6,
    bloodlustScale: { threshold: 4, band: { minPct: 170, maxPct: 190 } },
    source: wikiAbility("Assault", "Assault"),
  },
  {
    // Wiki Flurry: eight hits on ticks 1 through 8 of the 4.8s channel.
    id: "flurry",
    name: "Flurry",
    style: "melee",
    category: "enhanced",
    channelled: true,
    channelTicks: 8,
    hits: Array.from({ length: 8 }, (_, i) => ({
      band: { minPct: 60, maxPct: 70 },
      tickOffset: i + 1,
    })),
    adrenaline: { cost: 25 },
    cooldownSeconds: 20.4,
    replacementGroup: "flurry",
    weaponRequirement: "dualwield",
    bloodlustMissingHp: { threshold: 4, capPct: 65 },
    source: wikiAbility("Flurry", "Flurry"),
  },
  {
    // Wiki Greater Flurry: same channel as Flurry; each hit extends Berserk 0.6s.
    id: "greater_flurry",
    name: "Greater Flurry",
    style: "melee",
    category: "enhanced",
    channelled: true,
    channelTicks: 8,
    hits: Array.from({ length: 8 }, (_, i) => ({
      band: { minPct: 60, maxPct: 70 },
      tickOffset: i + 1,
    })),
    adrenaline: { cost: 25 },
    cooldownSeconds: 20.4,
    replacementGroup: "flurry",
    weaponRequirement: "dualwield",
    appliesEffect: "greater_flurry",
    bloodlustMissingHp: { threshold: 4, capPct: 65 },
    source: wikiAbility("Greater Flurry", "Greater_Flurry"),
  },
  {
    // Wiki Hurricane: 2h enhanced; hit1 135-165, hit2 155-185 AoE; 25% cost; 20.4s CD.
    // At 4 Bloodlust: third hit 75-95.
    id: "hurricane",
    name: "Hurricane",
    style: "melee",
    category: "enhanced",
    area: "aoe",
    hits: [{ band: { minPct: 135, maxPct: 165 } }, { band: { minPct: 155, maxPct: 185 } }],
    adrenaline: { cost: 25 },
    cooldownSeconds: 20.4,
    weaponRequirement: "twohand",
    bloodlustExtraHits: {
      threshold: 4,
      hits: [{ band: { minPct: 75, maxPct: 95 } }],
    },
    source: wikiAbility("Hurricane", "Hurricane"),
  },
  {
    // Wiki Overpower: lands 3 ticks after cast; Berserk shortens CD to 9s (cooldowns.ts).
    id: "overpower",
    name: "Overpower",
    style: "melee",
    category: "ultimate",
    hits: [{ band: { minPct: 520, maxPct: 570 }, tickOffset: 3 }],
    adrenaline: { cost: 60 },
    cooldownSeconds: 30,
    replacementGroup: "overpower",
    source: wikiAbility("Overpower", "Overpower", "2026-08-04"),
  },
  {
    // Igneous: two simultaneous hits (same land tick as base Overpower).
    id: "overpower_igneous",
    name: "Overpower (Igneous)",
    style: "melee",
    category: "ultimate",
    hits: [
      { band: { minPct: 280, maxPct: 340 }, tickOffset: 3 },
      { band: { minPct: 280, maxPct: 340 }, tickOffset: 3 },
    ],
    adrenaline: { cost: 60 },
    cooldownSeconds: 30,
    replacementGroup: "overpower",
    requiredPassiveAnyOf: ["igneous-overpower"],
    source: wikiAbility("Overpower", "Overpower", "2026-08-04"),
  },
  {
    // Dark Shard of Leng special (wiki 4 Mar 2024). ST model: primary + secondary
    // that also hits the primary. Stacks scale bands and reduce spend at cast time.
    id: "icy_tempest",
    name: "Icy Tempest",
    style: "melee",
    category: "utility",
    // Weapon special attack (not a normal ability). Access: Leng MH specialAttackId
    // or Essence of Finality equipped — never passive-only.
    weaponSpecial: true,
    requiresSpecialAccess: true,
    area: "aoe",
    hits: [{ band: { minPct: 115, maxPct: 135 } }, { band: { minPct: 175, maxPct: 205 } }],
    adrenaline: { cost: 30 },
    cooldownSeconds: 15,
    supportNote:
      "Weapon special. Requires Dark Shard of Leng (or equivalent) or Essence of Finality. ST primary model; multi-target splash unmodeled.",
    source: wikiAbility("Icy Tempest", "Icy_Tempest", "2026-08-02"),
  },
  {
    // Wiki Pulverise: two-handed ultimate, 300-340, 60% cost, 60s CD; Pulverised 30s; on-kill +50% adren.
    id: "pulverise",
    name: "Pulverise",
    style: "melee",
    category: "ultimate",
    hits: [{ band: { minPct: 300, maxPct: 340 } }],
    adrenaline: { cost: 60 },
    cooldownSeconds: 60,
    weaponRequirement: "twohand",
    appliesEffect: "pulverise",
    source: wikiAbility("Pulverise", "Pulverise"),
  },
  {
    // Wiki Berserk: no damage; -100% adren; 60s CD; 19.8s buff (see MELEE_EFFECTS).
    id: "berserk",
    name: "Berserk",
    style: "melee",
    category: "ultimate",
    hits: [],
    adrenaline: { cost: 100 },
    cooldownSeconds: 60,
    stateEffect: "berserk",
    source: wikiAbility("Berserk", "Berserk"),
  },
  {
    // Wiki Meteor Strike: 220-250 AoE, 60% cost, 60s CD; adren-gen buff 30s.
    id: "meteor_strike",
    name: "Meteor Strike",
    style: "melee",
    category: "ultimate",
    area: "aoe",
    hits: [{ band: { minPct: 220, maxPct: 250 } }],
    adrenaline: { cost: 60 },
    cooldownSeconds: 60,
    appliesEffect: "meteor_strike",
    source: wikiAbility("Meteor Strike", "Meteor_Strike"),
  },
];

/** Self/buff records whose effect is state, not a damage band alone. */
export const MELEE_EFFECTS = [
  {
    id: "berserk",
    name: "Berserk",
    category: "ultimate" as const,
    adrenaline: { cost: 100 },
    durationSeconds: 19.8,
    notes:
      "1.75x damage, 1.25x incoming. Bloodlust cap 4 -> 8, +4 stacks on activation, basics generate double. Reduces Overpower cooldown to 9s.",
    source: wikiAbility("Berserk", "Berserk"),
  },
  {
    id: "chaos_roar",
    name: "Chaos Roar",
    category: "basic" as const,
    durationSeconds: CHAOS_ROAR_DURATION_SECONDS,
    notes:
      "Next melee ability within 7.2s deals 1.75x base damage (PvP 1.25x). Channelled: first hit only; multi-hit non-channel (e.g. Hurricane): all hits. Also boosts bleeds.",
    source: wikiAbility("Chaos Roar", "Chaos_Roar"),
  },
  {
    id: "greater_fury",
    name: "Greater Fury",
    category: "basic" as const,
    durationSeconds: GREATER_FURY_CRIT_WINDOW_SECONDS,
    notes:
      "Next non-bleed melee attack within 15s is a guaranteed critical strike (first hit of channelled abilities only). Bleeds do not consume the buff.",
    source: wikiAbility("Greater Fury", "Greater_Fury"),
  },
  {
    id: "meteor_strike",
    name: "Meteor Strike",
    category: "ultimate" as const,
    durationSeconds: METEOR_STRIKE_ADREN_BUFF_SECONDS,
    notes:
      "Melee basics generate 1.5× adrenaline, plus 4.5% each tick for 30 seconds while a melee weapon is equipped.",
    source: wikiAbility("Meteor Strike", "Meteor_Strike"),
  },
  {
    id: "flurry_bloodlust",
    name: "Flurry (Bloodlust empower)",
    category: "enhanced" as const,
    notes:
      "At 4+ Bloodlust consumes 4 stacks: +1% damage per 1% missing LP on the target, cap +65%. Target-stage; not a fixed band.",
    source: wikiAbility("Flurry", "Flurry"),
  },
  {
    id: "greater_flurry",
    name: "Greater Flurry",
    category: "enhanced" as const,
    notes:
      "Each of its eight hits extends active Berserk by 0.6 seconds. At 4+ Bloodlust, it gains up to 65% damage from the target's missing life points.",
    source: wikiAbility("Greater Flurry", "Greater_Flurry"),
  },
  {
    id: "greater_barge",
    name: "Greater Barge",
    category: "basic" as const,
    durationSeconds: 6,
    notes:
      "Each idle tick since the last damaging melee attack adds 5–7% ability damage, capped at 10 ticks. Eight idle ticks also grant Endless Assault for 6 seconds. Off-target movement is not included.",
    source: wikiAbility("Greater Barge", "Greater_Barge"),
  },
  {
    id: "pulverise",
    name: "Pulverise",
    category: "ultimate" as const,
    durationSeconds: 30,
    notes:
      "The 300–340% hit is included. Pulverised reduces the target's damage by 25% for 30 seconds; the defensive effect and killing-blow adrenaline are not included.",
    source: wikiAbility("Pulverise", "Pulverise"),
  },
  {
    id: "fury",
    name: "Fury",
    category: "basic" as const,
    durationSeconds: GREATER_FURY_CRIT_WINDOW_SECONDS,
    notes:
      "The next crit-eligible melee attack gains 25% critical strike chance. Bleeds do not consume it.",
    source: wikiAbility("Fury", "Fury"),
  },
  {
    id: "punish",
    name: "Punish",
    category: "basic" as const,
    notes:
      "Base 110-130%; multiplies by 2.5 when target LP is below 50% (target-stage). Generates 1 Bloodlust.",
    source: wikiAbility("Punish", "Punish"),
  },
];

/** Punish: 2.5x against targets below 50% life points - a target-stage modifier. */
export const PUNISH_TARGET_MULTIPLIER = 2.5;
export const PUNISH_HP_THRESHOLD = 0.5;

/**
 * Strength cape (99) / master cape: Dismember deals three additional hits of
 * the same bleed band (wiki). Idempotent if already extended.
 */
export function withStrengthCape99Dismember<T extends AbilitySpec>(
  abilities: readonly T[],
  extraHits = 3,
): T[] {
  if (!Number.isInteger(extraHits) || extraHits <= 0) return [...abilities];
  return abilities.map((ability) => {
    if (ability.id !== "dismember") return ability;
    const baseHits = ability.hits;
    if (baseHits.length === 0) return ability;
    // Base kit is 8 ticks; skip if already patched.
    if (baseHits.length >= 8 + extraHits) return ability;
    const sample = baseHits[baseHits.length - 1]!;
    const step =
      baseHits.length >= 2
        ? Math.max(1, (sample.tickOffset ?? 0) - (baseHits[baseHits.length - 2]!.tickOffset ?? 0))
        : 2;
    const extra: AbilityHit[] = Array.from({ length: extraHits }, (_, i) => ({
      ...sample,
      tickOffset: (sample.tickOffset ?? 0) + step * (i + 1),
    }));
    return { ...ability, hits: [...baseHits, ...extra] };
  });
}
