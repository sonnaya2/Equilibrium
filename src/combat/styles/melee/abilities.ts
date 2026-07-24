import type { SourceReference } from "../../types";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { MODERNISATION_PATCH_1, MODERNISATION_PATCH_2, MODERNISATION_WIKI } from "../../data/sources";

/**
 * Post-modernisation melee kit, seeded from data/combat/modernisation-2026.json
 * (snapshot 2026-07-24, wiki-confirmed). Bleed tails are crit-ineligible by default.
 * Fields absent from the corpus (e.g. adrenaline gain on Rend) stay absent — never
 * back-filled with legacy assumptions.
 */
export interface MeleeAbilitySpec extends AbilitySpec {
  style: "melee";
  bloodlustGain?: number;
  /** Higher band once a Bloodlust threshold is met (Assault at 4). */
  bloodlustScale?: { threshold: number; band: { minPct: number; maxPct: number } };
  /** Bleed-chain enabler: Dismember -> Slaughter -> Massacre. */
  enables?: string;
  source: SourceReference;
}

export const MELEE_ABILITIES: MeleeAbilitySpec[] = [
  {
    id: "attack",
    name: "Attack",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 110, maxPct: 130 } }],
    adrenaline: { gain: 9 },
    bloodlustGain: 1,
    source: MODERNISATION_PATCH_1,
  },
  {
    id: "adaptive_strike_2h",
    name: "Adaptive Strike (two-handed)",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 120, maxPct: 140 } }],
    bloodlustGain: 1,
    source: MODERNISATION_WIKI,
  },
  {
    id: "adaptive_strike_dw",
    name: "Adaptive Strike (dual wield)",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 60, maxPct: 75 } }, { band: { minPct: 60, maxPct: 75 } }],
    bloodlustGain: 1,
    source: MODERNISATION_WIKI,
  },
  {
    id: "rend",
    name: "Rend",
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 135, maxPct: 165 } }],
    bloodlustGain: 2,
    source: MODERNISATION_WIKI,
  },
  {
    id: "dismember",
    name: "Dismember",
    style: "melee",
    category: "basic",
    hits: Array.from({ length: 8 }, () => ({ band: { minPct: 25, maxPct: 35 }, critEligible: false })),
    enables: "slaughter",
    source: MODERNISATION_WIKI,
  },
  {
    id: "slaughter",
    name: "Slaughter",
    style: "melee",
    category: "enhanced",
    hits: Array.from({ length: 6 }, () => ({ band: { minPct: 80, maxPct: 100 }, critEligible: false })),
    adrenaline: { cost: 25 },
    enables: "massacre",
    source: MODERNISATION_WIKI,
  },
  {
    id: "massacre",
    name: "Massacre",
    style: "melee",
    category: "enhanced",
    hits: [
      { band: { minPct: 110, maxPct: 130 } },
      ...Array.from({ length: 6 }, () => ({ band: { minPct: 100, maxPct: 100 }, critEligible: false })),
    ],
    adrenaline: { cost: 25 },
    source: MODERNISATION_WIKI,
  },
  {
    id: "assault",
    name: "Assault",
    style: "melee",
    category: "enhanced",
    hits: Array.from({ length: 4 }, () => ({ band: { minPct: 130, maxPct: 150 } })),
    adrenaline: { cost: 25 },
    cooldownSeconds: 6,
    bloodlustScale: { threshold: 4, band: { minPct: 170, maxPct: 190 } },
    source: MODERNISATION_PATCH_1,
  },
  {
    id: "overpower",
    name: "Overpower",
    style: "melee",
    category: "ultimate",
    hits: [{ band: { minPct: 520, maxPct: 570 } }],
    adrenaline: { cost: 60 },
    source: MODERNISATION_WIKI,
  },
  {
    id: "overpower_igneous",
    name: "Overpower (Igneous)",
    style: "melee",
    category: "ultimate",
    hits: [{ band: { minPct: 280, maxPct: 340 } }, { band: { minPct: 280, maxPct: 340 } }],
    adrenaline: { cost: 60 },
    source: MODERNISATION_WIKI,
  },
];

/** Self/buff records whose effect is state, not a damage band. */
export const MELEE_EFFECTS = [
  {
    id: "berserk",
    name: "Berserk",
    category: "ultimate" as const,
    adrenaline: { cost: 100 },
    durationSeconds: 19.8,
    notes:
      "1.75x damage, 1.25x incoming. Bloodlust cap 4 -> 8, +4 stacks on activation, basics generate double. Reduces Overpower cooldown.",
    source: MODERNISATION_PATCH_2,
  },
  {
    id: "chaos_roar",
    name: "Chaos Roar",
    category: "enhanced" as const,
    notes: "Empowers the next melee ability to 1.75x base damage and grants 1 Bloodlust.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "meteor_strike",
    name: "Meteor Strike",
    category: "ultimate" as const,
    adrenaline: { cost: 60 },
    notes: "Area attack granting an adrenaline-generation buff. Damage band not yet in the corpus.",
    source: MODERNISATION_WIKI,
  },
];

/** Punish: 2.5x against targets below 50% life points — a target-stage modifier. */
export const PUNISH_TARGET_MULTIPLIER = 2.5;
export const PUNISH_HP_THRESHOLD = 0.5;
