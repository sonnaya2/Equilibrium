import type { SourceReference } from "../../types";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import {
  BLOOMING_BURROW_WIKI_2026_03_30,
  MODERNISATION_WIKI,
  REFINEMENTS_WIKI_2026_03_09,
  RUNIC_CHARGE_WIKI,
} from "../../data/sources";

/**
 * Post-modernisation magic abilities. Damage bands and timing are wiki-verified
 * (individual ability pages + Magic abilities table, 2026-07-26). Multi-hit
 * tickOffsets only when the wiki states an interval; unknown timing leaves the
 * offsets unset. Ability-level crit modifiers the pipeline
 * cannot yet express (Wild Magic +10% chance / +20% damage) stay as MAGIC_EFFECTS.
 *
 * Removed by Combat Style Modernisation (do not re-add): Wrack, Wrack and Ruin,
 * Deep Impact, Metamorphosis, Shock, Horror, Detonate. Runic Charge replaces Wrack.
 * Anticipation / Intercept are Defence, not Magic.
 */

const VERIFIED = "2026-07-26";

function wikiAbility(title: string, path?: string): SourceReference {
  return {
    source: "runescape-wiki",
    url: `https://runescape.wiki/w/${(path ?? title).replace(/ /g, "_")}`,
    title,
    verifiedAt: VERIFIED,
  };
}

export interface MagicAbilitySpec extends AbilitySpec {
  style: "magic";
  /** Sourced per-ability crit layers (Wild Magic: +10% chance, +20% crit damage). */
  critChanceBonusPct?: number;
  critDamageBonus?: number;
  source: SourceReference;
}

export function isMagicAbility(ability: AbilitySpec): ability is MagicAbilitySpec {
  return ability.style === "magic";
}

/** 3-tick channel: one hit per tick over 1.8s (wiki: "Attack 3 times over 1.8s (3 ticks)").
 *  Last hit lands at +2, so occupancy fits the 3-tick GCD — no channelTicks. */
function concHits(minPct: number, maxPct: number) {
  return [0, 1, 2].map((tickOffset) => ({ band: { minPct, maxPct }, tickOffset }));
}

/** Asphyxiate: 4 hits, one every 1.2s (2 ticks) over 4.2s. Last hit at +6 → 7-tick occupancy. */
function asphyxiateHits() {
  return [0, 2, 4, 6].map((tickOffset) => ({
    band: { minPct: 120, maxPct: 140 },
    tickOffset,
  }));
}

/**
 * Tumeken's Resplendence 4+: 8 hits of 72-84% over 4.8s (8 ticks).
 * Wiki states channel length + hit count (not a separate "every Xs" cell); one hit
 * per tick fits 8 hits in 8 ticks.
 */
function asphyxiateResplendenceHits() {
  return Array.from({ length: 8 }, (_, i) => ({
    band: { minPct: 72, maxPct: 84 },
    tickOffset: i,
  }));
}

/** Resolve the ordinary Asphyxiate spec through Tumeken's four-piece bonus. */
export function resplendentAsphyxiate(ability: AbilitySpec): AbilitySpec {
  return { ...ability, channelTicks: 8, hits: asphyxiateResplendenceHits() };
}

/**
 * Corruption Blast: first hit 90-110%; each subsequent hit loses 20% of the
 * *initial* hit (wiki example: 1080 -> 864 -> 648 -> 432 -> 216). Modelled as
 * independent bands at 100/80/60/40/20% of the initial range.
 */
function corruptionBlastHits() {
  const scales = [1, 0.8, 0.6, 0.4, 0.2];
  return scales.map((scale, i) => ({
    band: { minPct: 90 * scale, maxPct: 110 * scale },
    critEligible: false,
    dot: true,
    tickOffset: (i + 1) * 2,
  }));
}

/**
 * Smoke Tendrils escalating hits (wiki Usage): 55-65, 65-80, 75-95, 85-110
 * every 1.2s (2 ticks). Guaranteed crit; self-damage is not modelled.
 */
function smokeTendrilHits() {
  const bands = [
    { minPct: 55, maxPct: 65 },
    { minPct: 65, maxPct: 80 },
    { minPct: 75, maxPct: 95 },
    { minPct: 85, maxPct: 110 },
  ];
  return bands.map((band, i) => ({ band, tickOffset: i * 2 }));
}

/**
 * Magma Tempest: 8 hits of 35-45% every 1.2s (2 ticks); cannot critically
 * strike (Mar 2024, compensated with higher damage). Wiki, verified
 * 2026-08-01: "Damage from this ability is not considered as damage over
 * time" — so despite landing late and never critting, its hits keep prayers
 * and the Sunshine window.
 */
function magmaTempestHits() {
  return Array.from({ length: 8 }, (_, i) => ({
    band: { minPct: 35, maxPct: 45 },
    critEligible: false,
    tickOffset: (i + 1) * 2,
  }));
}

/**
 * Sunshine beam DoT on the cast-time primary target while inside the AoE.
 * Base: 16 hits of 10-20% (wiki average damage 240% = 16 * 15%).
 * Greater: 21 hits of 10-20% (wiki average damage 315% = 21 * 15%).
 * There is no separate initial 315% hit — that figure is the DoT total.
 */
function sunshineDotHits(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    band: { minPct: 10, maxPct: 20 },
    critEligible: false,
    dot: true,
    tickOffset: (i + 1) * 3,
  }));
}

export const MAGIC_ABILITIES: MagicAbilitySpec[] = [
  {
    id: "magic_attack",
    name: "Magic basic attack",
    style: "magic",
    category: "basic",
    autoAttack: true,
    hits: [{ band: { minPct: 90, maxPct: 110 } }],
    adrenaline: { gain: 9 },
    source: MODERNISATION_WIKI,
  },
  {
    // Wiki: "Sonic Wave strikes the target 2 ticks after being cast"; Flow is
    // gained on a successful hit, so the 9s window runs from that land tick.
    // Wiki Jul 2024 — no longer weapon-type gated.
    id: "sonic_wave",
    name: "Sonic Wave",
    style: "magic",
    category: "basic",
    hits: [{ band: { minPct: 90, maxPct: 110 }, tickOffset: 2 }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 15,
    replacementGroup: "sonic_wave",
    source: wikiAbility("Sonic Wave"),
  },
  {
    // Greater Sonic Wave: same strike timing as Sonic Wave (hits land at +2).
    id: "greater_sonic_wave",
    name: "Greater Sonic Wave",
    style: "magic",
    category: "basic",
    hits: [{ band: { minPct: 115, maxPct: 135 }, tickOffset: 2 }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 15,
    replacementGroup: "sonic_wave",
    source: wikiAbility("Greater Sonic Wave"),
  },
  {
    id: "dragon_breath",
    name: "Dragon Breath",
    style: "magic",
    category: "basic",
    area: "aoe",
    hits: [{ band: { minPct: 110, maxPct: 130 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 7.2,
    source: wikiAbility("Dragon Breath"),
  },
  {
    id: "impact",
    name: "Impact",
    style: "magic",
    category: "basic",
    hits: [{ band: { minPct: 65, maxPct: 75 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 15,
    source: wikiAbility("Impact"),
  },
  {
    // Combust: 10 crit-ineligible burn hits every 3 ticks (1.8s).
    id: "combust",
    name: "Combust",
    style: "magic",
    category: "basic",
    hits: Array.from({ length: 10 }, (_, i) => ({
      band: { minPct: 27, maxPct: 33 },
      critEligible: false,
      dot: true,
      tickOffset: (i + 1) * 3,
    })),
    adrenaline: { gain: 9 },
    cooldownSeconds: 18,
    source: wikiAbility("Combust"),
  },
  {
    id: "chain",
    name: "Chain",
    style: "magic",
    category: "basic",
    area: "multi-target",
    hits: [{ band: { minPct: 70, maxPct: 90 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 10.2,
    source: wikiAbility("Chain"),
  },
  {
    id: "greater_chain",
    name: "Greater Chain",
    style: "magic",
    category: "basic",
    area: "multi-target",
    hits: [{ band: { minPct: 80, maxPct: 100 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 10.2,
    source: wikiAbility("Greater Chain"),
  },
  {
    id: "concentrated_blast",
    name: "Concentrated Blast",
    style: "magic",
    category: "basic",
    hits: concHits(30, 40),
    adrenaline: { gain: 9 },
    cooldownSeconds: 5.4,
    replacementGroup: "concentrated_blast",
    source: wikiAbility("Concentrated Blast"),
  },
  {
    id: "greater_concentrated_blast",
    name: "Greater Concentrated Blast",
    style: "magic",
    category: "basic",
    hits: concHits(40, 50),
    adrenaline: { gain: 9 },
    cooldownSeconds: 5.4,
    replacementGroup: "concentrated_blast",
    source: wikiAbility("Greater Concentrated Blast"),
  },
  {
    // 2 hits; wiki does not give a per-hit tick split. +10% crit chance and
    // +20% crit damage on both hits (wiki Critical strike, verified 2026-07-31).
    id: "wild_magic",
    name: "Wild Magic",
    style: "magic",
    category: "enhanced",
    hits: [{ band: { minPct: 125, maxPct: 155 } }, { band: { minPct: 125, maxPct: 155 } }],
    adrenaline: { cost: 25 },
    cooldownSeconds: 5.4,
    critChanceBonusPct: 10,
    critDamageBonus: 0.2,
    source: wikiAbility("Wild Magic"),
  },
  {
    id: "asphyxiate",
    name: "Asphyxiate",
    style: "magic",
    category: "enhanced",
    channelTicks: 7,
    hits: asphyxiateHits(),
    adrenaline: { cost: 25 },
    cooldownSeconds: 20.4,
    source: wikiAbility("Asphyxiate"),
  },
  {
    id: "corruption_blast",
    name: "Corruption Blast",
    style: "magic",
    category: "enhanced",
    hits: corruptionBlastHits(),
    adrenaline: { cost: 20 },
    cooldownSeconds: 15,
    source: wikiAbility("Corruption Blast"),
  },
  {
    id: "smoke_tendrils",
    name: "Smoke Tendrils",
    style: "magic",
    category: "enhanced",
    hits: smokeTendrilHits(),
    guaranteedCrit: true,
    // Wiki adrenaline cell is 0% (neither gain nor spend).
    cooldownSeconds: 45,
    source: wikiAbility("Smoke Tendrils"),
  },
  {
    id: "magma_tempest",
    name: "Magma Tempest",
    style: "magic",
    category: "enhanced",
    area: "aoe",
    hits: magmaTempestHits(),
    adrenaline: { cost: 20 },
    cooldownSeconds: 21,
    source: wikiAbility("Magma Tempest"),
  },
  {
    id: "omnipower",
    name: "Omnipower",
    style: "magic",
    category: "ultimate",
    hits: [{ band: { minPct: 420, maxPct: 500 } }],
    adrenaline: { cost: 60 },
    cooldownSeconds: 30,
    replacementGroup: "omnipower",
    source: wikiAbility("Omnipower"),
  },
  {
    // Igneous Kal-Mej / Kal-Zuk: 4 hits of 120-150%. Timing: first hit then three
    // on the next tick (wiki) — modelled as tick 0 + three at tick 1.
    id: "omnipower_igneous",
    name: "Omnipower (Igneous)",
    style: "magic",
    category: "ultimate",
    hits: [
      { band: { minPct: 120, maxPct: 150 }, tickOffset: 0 },
      { band: { minPct: 120, maxPct: 150 }, tickOffset: 1 },
      { band: { minPct: 120, maxPct: 150 }, tickOffset: 1 },
      { band: { minPct: 120, maxPct: 150 }, tickOffset: 1 },
    ],
    adrenaline: { cost: 60 },
    cooldownSeconds: 30,
    replacementGroup: "omnipower",
    requiredPassiveAnyOf: ["igneous-omnipower"],
    source: wikiAbility("Omnipower"),
  },
  {
    // Base Sunshine DoT (16 x 10-20%). Zone 1.5x buff via appliesEffect "sunshine"
    // (effects.ts / simulate): 50-tick beam, buff starts cast+1.
    id: "sunshine",
    name: "Sunshine",
    style: "magic",
    category: "ultimate",
    appliesEffect: "sunshine",
    hits: sunshineDotHits(16),
    adrenaline: { cost: 100 },
    cooldownSeconds: 60,
    replacementGroup: "sunshine",
    source: wikiAbility("Sunshine"),
  },
  {
    // Greater Sunshine: DoT 21 x 10-20% (avg 315% total — not a front-loaded hit).
    // Zone buff via appliesEffect; 64 active ticks after 1-tick delay (effects.ts).
    id: "greater_sunshine",
    name: "Greater Sunshine",
    style: "magic",
    category: "ultimate",
    appliesEffect: "greater_sunshine",
    hits: sunshineDotHits(21),
    adrenaline: { cost: 100 },
    cooldownSeconds: 60,
    replacementGroup: "sunshine",
    source: wikiAbility("Greater Sunshine"),
  },
  {
    id: "tsunami",
    name: "Tsunami",
    style: "magic",
    category: "ultimate",
    area: "aoe",
    hits: [{ band: { minPct: 225, maxPct: 275 } }],
    adrenaline: { cost: 100 },
    cooldownSeconds: 60,
    supportStatus: "partially-modeled",
    supportNote: "Crit-adrenaline window (30s, +8% per crit) not modeled.",
    source: wikiAbility("Tsunami"),
  },
  {
    id: "runic_charge",
    name: "Runic Charge",
    style: "magic",
    category: "utility",
    hits: [],
    stateEffect: "runic_charge",
    offGcd: true,
    cooldownSeconds: 30,
    source: RUNIC_CHARGE_WIKI,
  },
  {
    // FSOA special: cast hit 120-140%. Lightning Surge (70-90% on crit, +1 tick)
    // is state via appliesEffect "instability" (effects.ts / simulate).
    id: "instability",
    name: "Instability",
    style: "magic",
    category: "enhanced",
    hits: [{ band: { minPct: 120, maxPct: 140 } }],
    adrenaline: { cost: 50 },
    cooldownSeconds: 60,
    appliesEffect: "instability",
    source: wikiAbility("Instability"),
  },
  {
    // Guthix staff special / common EoF. Affinity + Defence drain are MAGIC_EFFECTS.
    id: "claws_of_guthix",
    name: "Claws of Guthix",
    style: "magic",
    category: "enhanced",
    hits: [{ band: { minPct: 200, maxPct: 240 } }],
    adrenaline: { cost: 25 },
    source: wikiAbility("Claws of Guthix"),
  },
];

/** Sourced mechanics without a full calculable AbilitySpec, or residual notes. */
export const MAGIC_EFFECTS = [
  {
    id: "sonic_wave_flow",
    name: "Sonic Wave / Flow",
    notes:
      "Flow: next Magic ability -10% adrenaline (Greater Flow -20%). Runic-Charged: -35% / Greater -45%. Does not reduce Defence/Constitution/spec costs.",
    source: wikiAbility("Sonic Wave"),
  },
  {
    id: "concentrated_blast_crit_grant",
    name: "Concentrated Blast crit grant",
    notes:
      "Per-hit crit-chance grant 5% (Greater 7%) to the next Magic attack, stacking to 15%/21%. Also applies to later hits of the channel itself. Runic-Charged adds +10% per attack (runicCharge.ts).",
    source: wikiAbility("Concentrated Blast"),
  },
  {
    id: "dragon_breath_combust",
    name: "Dragon Breath vs Combust",
    notes: "Deals 1.25x damage to Combusted enemies. Cone: primary + up to 4 in attack direction.",
    source: wikiAbility("Dragon Breath"),
  },
  {
    id: "wild_magic_crit",
    name: "Wild Magic crit layers",
    notes:
      "Each hit has +10% Critical Strike Chance and +20% Critical Strike Damage (30 Mar 2026). Implemented via the spec's critChanceBonusPct / critDamageBonus.",
    source: wikiAbility("Wild Magic"),
  },
  {
    id: "asphyxiate_channelled_might",
    name: "Asphyxiate Channelled Might",
    notes:
      "Full channel grants Channelled Might 3.6s at +15% Magic crit damage. Resplendence 4+ uses asphyxiate_resplendence (8x72-84%). 5-piece set: longer/stronger Might (effects.ts).",
    source: BLOOMING_BURROW_WIKI_2026_03_30,
  },
  {
    id: "smoke_tendrils_self",
    name: "Smoke Tendrils self-damage",
    notes:
      "4 self hits of 35-40% ability damage; unaffected by damage modifiers and crit. Not modelled as target damage.",
    source: wikiAbility("Smoke Tendrils"),
  },
  {
    id: "tsunami_crit_adrenaline",
    name: "Tsunami crit adrenaline",
    notes:
      "After cast, critical strikes generate an additional 8% Adrenaline for 30s (50 ticks). NOT modeled: per-hit crit rolls over a 50-tick window are state-changing RNG outside exact branching's reasonable cost, and a flat EV refund would be an impossible average state. Tsunami's damage is modeled; the ability is labeled partially modeled.",
    source: wikiAbility("Tsunami"),
  },
  {
    id: "chain_spread",
    name: "Chain / Greater Chain follow-up",
    notes:
      "Next single-target Magic ability within 6s also hits chained targets at 30% (Chain) / 50% (Greater) of that ability's damage range. Caroming extends targets.",
    source: wikiAbility("Greater Chain"),
  },
  {
    id: "sunshine_zone",
    name: "Sunshine zone buff",
    notes:
      "Magic attacks deal 1.5× damage inside the 7×7 beam. The calculator assumes the player stays inside. Greater lasts 64 ticks after a 1-tick delay; Planted Feet extends the base version to 63 ticks.",
    source: wikiAbility("Sunshine"),
  },
  {
    id: "corruption_blast_spread",
    name: "Corruption Blast spread",
    notes: "DoT spreads to enemies within 2 tiles (PvM 5x5 around debuffed target). Not a burn.",
    source: wikiAbility("Corruption Blast"),
  },
  {
    id: "instability_lightning_surge",
    name: "Instability Lightning Surge",
    notes:
      "While Instability buff (30s / 50 ticks): Magic crits on primary target fire Lightning Surge 70-90% ability damage 1 tick later. EV: p·T per crit-eligible hit (wiki formula). Surge crits do not chain. Magic weapons only. PvP: no crit effect and no cooldown — out of scope.",
    source: wikiAbility("Instability"),
  },
  {
    id: "claws_of_guthix_debuff",
    name: "Claws of Guthix debuff",
    notes:
      "Also lowers target Defence by 5% and raises affinity values by 2 for 60s (wiki: base hit chance +5 for 1m). Damage band is the calculable cast only.",
    source: wikiAbility("Claws of Guthix"),
  },
  {
    id: "rune_consumption",
    name: "Rune consumption",
    notes: "Any magic ability can consume runes, 15% per cast (was 20% at release, changed 9 Mar).",
    source: REFINEMENTS_WIKI_2026_03_09,
  },
];
