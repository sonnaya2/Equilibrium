import type { SourceReference } from "../../types";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { MODERNISATION_WIKI } from "../../data/sources";

/**
 * Post-modernisation ranged records, seeded from data/combat/modernisation-2026.json
 * (snapshot 2026-07-24, wiki-confirmed). Records carry only what the corpus pins
 * down — Bombardment's bleed has no band yet, so it stays an effect note rather
 * than a calculable ability.
 */
export interface RangedAbilitySpec extends AbilitySpec {
  style: "ranged";
  /** Casts always crit; callers pass this into the crit layer as guaranteed. */
  guaranteedCrit?: boolean;
  source: SourceReference;
}

export const RANGED_ABILITIES: RangedAbilitySpec[] = [
  {
    id: "ranged_attack",
    name: "Ranged basic attack",
    style: "ranged",
    category: "basic",
    autoAttack: true,
    hits: [{ band: { minPct: 90, maxPct: 110 } }],
    adrenaline: { gain: 9 },
    source: MODERNISATION_WIKI,
  },
  {
    id: "galeshot",
    name: "Galeshot",
    style: "ranged",
    category: "basic",
    hits: [{ band: { minPct: 90, maxPct: 110 } }],
    adrenaline: { gain: 9 },
    appliesBuff: "searing_winds",
    source: MODERNISATION_WIKI,
  },
  {
    id: "shadow_tendrils",
    name: "Shadow Tendrils",
    style: "ranged",
    category: "enhanced",
    hits: [{ band: { minPct: 200, maxPct: 240 } }],
    guaranteedCrit: true,
    source: MODERNISATION_WIKI,
  },
  {
    id: "deaths_swiftness",
    name: "Death's Swiftness",
    style: "ranged",
    category: "ultimate",
    hits: [],
    buff: "deaths_swiftness",
    source: MODERNISATION_WIKI,
  },
  {
    id: "imbue_shadows",
    name: "Imbue: Shadows",
    style: "ranged",
    category: "enhanced",
    hits: [],
    adrenaline: { cost: 40 },
    buff: "shadow_imbued",
    source: MODERNISATION_WIKI,
  },
];

/** Buff/effect records whose mechanics are state or prose, not a damage band. */
export const RANGED_EFFECTS = [
  {
    id: "deaths_swiftness",
    name: "Death's Swiftness",
    category: "ultimate" as const,
    notes:
      "Self buff: 1.5x damage for 30s (37.8s Greater). Was a ground-targeted area before the modernisation.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "bombardment",
    name: "Bombardment",
    category: "enhanced" as const,
    adrenaline: { cost: 20 },
    notes: "Multi-target bleed under the redesign; hit bands not yet in the corpus.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "shadow_tendrils_self_damage",
    name: "Shadow Tendrils recoil",
    notes: "Shadow Tendrils retains self-damage; the amount is not yet sourced.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "snap_shot",
    name: "Snap Shot",
    adrenaline: { cost: 25 },
    notes: "290% AVG, no cooldown. Band range not yet sourced.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "snipe",
    name: "Snipe",
    category: "enhanced" as const,
    cooldownSeconds: 60,
    notes:
      "330% AVG, 1.8s channel; Piercing Shot cuts 2.4s off the cooldown per hit. Band range not yet sourced.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "deadshot",
    name: "Deadshot",
    category: "ultimate" as const,
    adrenaline: { cost: 60 },
    notes:
      "4 hits at 115% AVG, no DoT — can now crit and benefit from Death's Swiftness. Band ranges not yet sourced.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "rapid_fire",
    name: "Rapid Fire",
    adrenaline: { cost: 25 },
    notes: "Can move while channelling; each hit extends Searing Winds by 1 tick.",
    source: MODERNISATION_WIKI,
  },
];
