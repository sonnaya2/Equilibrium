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
  /** Channelled cast: Chaos Roar empowers first hit only (wiki). */
  channelled?: boolean;
  /** Bleed-chain enabler: Dismember -> Slaughter -> Massacre. */
  enables?: string;
  source: SourceReference;
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
    // Wiki Adaptive Strike: +12% adrenaline, 5.4s CD, 2h 120-140 / DW 2x 60-75.
    id: "adaptive_strike_2h",
    name: "Adaptive Strike (two-handed)",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 120, maxPct: 140 } }],
    adrenaline: { gain: 12 },
    cooldownSeconds: 5.4,
    bloodlustGain: 1,
    source: wikiAbility("Adaptive Strike", "Adaptive_Strike"),
  },
  {
    id: "adaptive_strike_dw",
    name: "Adaptive Strike (dual wield)",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 60, maxPct: 75 } }, { band: { minPct: 60, maxPct: 75 } }],
    adrenaline: { gain: 12 },
    cooldownSeconds: 5.4,
    bloodlustGain: 1,
    source: wikiAbility("Adaptive Strike", "Adaptive_Strike"),
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
    bloodlustGain: 1,
    appliesBuff: "fury",
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
    bloodlustGain: 1,
    appliesBuff: "greater_fury",
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
    bloodlustGain: 1,
    appliesBuff: "greater_barge",
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
    appliesBuff: "chaos_roar",
    source: wikiAbility("Chaos Roar", "Chaos_Roar"),
  },
  {
    // Wiki Dismember: enhanced bleed book, 0% adren, 8x 25-35 every 1.2s, 24s CD.
    id: "dismember",
    name: "Dismember",
    style: "melee",
    category: "enhanced",
    hits: Array.from({ length: 8 }, (_, i) => ({
      band: { minPct: 25, maxPct: 35 },
      critEligible: false,
      tickOffset: (i + 1) * 2,
    })),
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
      tickOffset: (i + 1) * 3,
    })),
    adrenaline: { cost: 25 },
    enables: "massacre",
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
        tickOffset: (i + 1) * 4,
      })),
    ],
    adrenaline: { cost: 25 },
    source: wikiAbility("Massacre", "Massacre"),
  },
  {
    // Wiki Assault: 4x 130-150 over 4.2s; at 4 Bloodlust 170-190 each; 25% cost; 6s CD.
    id: "assault",
    name: "Assault",
    style: "melee",
    category: "enhanced",
    channelled: true,
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
    // Wiki Flurry: "Attack 8 times over 4.8s (8 ticks)" every 0.6s — same as Rapid Fire (0..7).
    id: "flurry",
    name: "Flurry",
    style: "melee",
    category: "enhanced",
    channelled: true,
    hits: Array.from({ length: 8 }, (_, i) => ({
      band: { minPct: 60, maxPct: 70 },
      tickOffset: i,
    })),
    adrenaline: { cost: 25 },
    cooldownSeconds: 20.4,
    source: wikiAbility("Flurry", "Flurry"),
  },
  {
    // Wiki Greater Flurry: same channel as Flurry; each hit extends Berserk 0.6s.
    id: "greater_flurry",
    name: "Greater Flurry",
    style: "melee",
    category: "enhanced",
    channelled: true,
    hits: Array.from({ length: 8 }, (_, i) => ({
      band: { minPct: 60, maxPct: 70 },
      tickOffset: i,
    })),
    adrenaline: { cost: 25 },
    cooldownSeconds: 20.4,
    appliesBuff: "greater_flurry",
    source: wikiAbility("Greater Flurry", "Greater_Flurry"),
  },
  {
    // Wiki Hurricane: 2h enhanced; hit1 135-165, hit2 155-185 AoE; 25% cost; 20.4s CD.
    // At 4 Bloodlust: third hit 75-95.
    id: "hurricane",
    name: "Hurricane",
    style: "melee",
    category: "enhanced",
    hits: [
      { band: { minPct: 135, maxPct: 165 } },
      { band: { minPct: 155, maxPct: 185 } },
    ],
    adrenaline: { cost: 25 },
    cooldownSeconds: 20.4,
    bloodlustExtraHits: {
      threshold: 4,
      hits: [{ band: { minPct: 75, maxPct: 95 } }],
    },
    source: wikiAbility("Hurricane", "Hurricane"),
  },
  {
    id: "overpower",
    name: "Overpower",
    style: "melee",
    category: "ultimate",
    hits: [{ band: { minPct: 520, maxPct: 570 } }],
    adrenaline: { cost: 60 },
    cooldownSeconds: 30,
    source: wikiAbility("Overpower", "Overpower"),
  },
  {
    id: "overpower_igneous",
    name: "Overpower (Igneous)",
    style: "melee",
    category: "ultimate",
    hits: [{ band: { minPct: 280, maxPct: 340 } }, { band: { minPct: 280, maxPct: 340 } }],
    adrenaline: { cost: 60 },
    cooldownSeconds: 30,
    source: wikiAbility("Overpower", "Overpower"),
  },
  {
    // Wiki Pulverise: 2h ultimate, 300-340, 60% cost, 60s CD; Pulverised 30s; on-kill +50% adren.
    id: "pulverise",
    name: "Pulverise",
    style: "melee",
    category: "ultimate",
    hits: [{ band: { minPct: 300, maxPct: 340 } }],
    adrenaline: { cost: 60 },
    cooldownSeconds: 60,
    appliesBuff: "pulverise",
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
    buff: "berserk",
    source: wikiAbility("Berserk", "Berserk"),
  },
  {
    // Wiki Meteor Strike: 220-250 AoE, 60% cost, 60s CD; adren-gen buff 30s.
    id: "meteor_strike",
    name: "Meteor Strike",
    style: "melee",
    category: "ultimate",
    hits: [{ band: { minPct: 220, maxPct: 250 } }],
    adrenaline: { cost: 60 },
    cooldownSeconds: 60,
    appliesBuff: "meteor_strike",
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
      "SIM: melee basics generate 1.5x adren; +4.5% adren every tick for 30s (wired in rotation/simulate). Wiki: while a melee weapon is equipped.",
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
      "SIM: each of 8 hits extends active Berserk by 0.6s (wired). Bloodlust empower (missing-LP scale, cap +65%) is target-stage — not a fixed band.",
    source: wikiAbility("Greater Flurry", "Greater_Flurry"),
  },
  {
    id: "greater_barge",
    name: "Greater Barge",
    category: "basic" as const,
    durationSeconds: 6,
    notes:
      "SIM: last-attack idle (readyTick - lastMeleeCastTick) scales this cast's band +5 min / +7 max AD% per idle tick, cap 10. After >= 8 idle ticks grants Endless Assault for 6s — next channelled melee (Assault / Flurry / Greater Flurry) consumes the window; multi-hit offsets already model channel timings as DoT-style. Off-target movement idle (Surge / Escape / Bladed Dive) is unmodelled on generic target.",
    source: wikiAbility("Greater Barge", "Greater_Barge"),
  },
  {
    id: "pulverise",
    name: "Pulverise",
    category: "ultimate" as const,
    durationSeconds: 30,
    notes:
      "NOT modelled in outgoing DPS sim: applies Pulverised 30s (target deals 25% less damage — defensive). On killing blow +50% adren (kill-gated; generic target has no kill). Two-handed only. Hit band 300-340 is modelled.",
    source: wikiAbility("Pulverise", "Pulverise"),
  },
  {
    id: "fury",
    name: "Fury",
    category: "basic" as const,
    durationSeconds: GREATER_FURY_CRIT_WINDOW_SECONDS,
    notes:
      "SIM: next crit-eligible melee gains +25% critical strike chance (wired; bleeds do not consume). Wiki: next Melee attack.",
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

/** Punish: 2.5x against targets below 50% life points — a target-stage modifier. */
export const PUNISH_TARGET_MULTIPLIER = 2.5;
export const PUNISH_HP_THRESHOLD = 0.5;
