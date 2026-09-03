import type { SourceReference } from "../../types";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import {
  BLOOMING_BURROW_WIKI_2026_03_30,
  MODERNISATION_WIKI,
  REFINEMENTS_WIKI_2026_03_09,
  RUNIC_CHARGE_WIKI,
} from "../../data/sources";
import { SOULFIRE_ABILITY } from "./songOfDestruction";

/**
 * Post-modernisation magic abilities (wiki bands/timing, 2026-07-26).
 * Multi-hit tickOffsets only when wiki states an interval. Crit layers the pipeline
 * cannot express (e.g. Wild Magic +10% chance / +20% dmg) live in MAGIC_EFFECTS.
 * Removed (do not re-add): Wrack, Wrack and Ruin, Deep Impact, Metamorphosis, Shock,
 * Horror, Detonate; Runic Charge replaces Wrack. Anticipation / Intercept are Defence.
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
 *  Last hit lands at +2, so occupancy fits the 3-tick GCD - no channelTicks. */
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
 * Wiki gives channel length + hit count (not "every Xs"); one hit/tick fits.
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

/** Corruption Blast parent band (wiki initial DoT tick). */
export const CORRUPTION_BLAST_INITIAL_BAND = { minPct: 90, maxPct: 110 } as const;
/** Decaying fractions of the resolved parent (wiki -20% of initial each step). */
export const CORRUPTION_BLAST_TAIL_FRACTIONS_PCT = [80, 60, 40, 20] as const;

/**
 * Smoke Tendrils escalating hits (wiki Usage): 55-65, 65-80, 75-95, 85-110
 * every 1.2s (2 ticks). Guaranteed crit; self-damage only advances Tearing Thorns.
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
 * Magma Tempest: 8 hits of 35-45% every 1.2s (2 ticks); cannot crit (Mar 2024).
 * Wiki (2026-08-01): not DoT, so late non-crit hits still keep prayers / Sunshine.
 */
function magmaTempestHits() {
  return Array.from({ length: 8 }, (_, i) => ({
    band: { minPct: 35, maxPct: 45 },
    critEligible: false,
    tickOffset: (i + 1) * 2,
  }));
}

/**
 * Sunshine beam DoT on cast-time primary while inside AoE.
 * Base 16x / Greater 21x of 10-20% (wiki avg 240% / 315% = n * 15%). No separate initial hit.
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
    name: "Magic",
    style: "magic",
    category: "basic",
    basicAttack: true,
    hits: [{ band: { minPct: 90, maxPct: 110 } }],
    adrenaline: { gain: 9 },
    supportNote:
      "Selected-spell animation, rune consumption, and spell proc effects are outside this damage-only model.",
    source: MODERNISATION_WIKI,
  },
  {
    // Wiki: "Sonic Wave strikes the target 2 ticks after being cast"; Flow is
    // gained on a successful hit, so the 9s window runs from that land tick.
    // Wiki Jul 2024 - no longer weapon-type gated.
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
    // Wiki Impact: stun/bind utility; 15s CD; 2 charges at 54 Magic.
    id: "impact",
    name: "Impact",
    style: "magic",
    category: "basic",
    hits: [{ band: { minPct: 65, maxPct: 75 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 15,
    charges: { max: 2, secondChargeLevel: 54 },
    source: wikiAbility("Impact"),
  },
  {
    // Combust: 10 crit-ineligible burn hits every 3 ticks (1.8s).
    id: "combust",
    name: "Combust",
    tearingThornsEligible: true,
    style: "magic",
    category: "basic",
    essenceCorruptionEligible: true,
    songAffectedDot: true,
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
    supportStatus: "partially-modeled",
    supportNote:
      "Primary hit only. Next-ability copy to chained targets needs multi-target identity (HP, debuffs, DP, caps, death, events). Caroming Chain secondary bonus unmodeled.",
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
    supportStatus: "partially-modeled",
    supportNote:
      "Primary hit only. Next-ability copy to chained targets needs multi-target identity (HP, debuffs, DP, caps, death, events). Caroming Chain secondary bonus unmodeled.",
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
    // Wiki DoT: parent 90-110 at +2; 4 derived tails every 2 ticks at 80/60/40/20% of resolved parent.
    id: "corruption_blast",
    name: "Corruption Blast",
    tearingThornsEligible: true,
    style: "magic",
    category: "enhanced",
    essenceCorruptionEligible: true,
    songAffectedDot: true,
    hits: [
      {
        band: { ...CORRUPTION_BLAST_INITIAL_BAND },
        critEligible: false,
        dot: true,
        tickOffset: 2,
      },
    ],
    derivedHits: {
      count: 4,
      intervalTicks: 2,
      firstOffset: 4,
      fractionPct: 80,
      fractionPcts: [...CORRUPTION_BLAST_TAIL_FRACTIONS_PCT],
      dot: true,
    },
    adrenaline: { cost: 20 },
    cooldownSeconds: 15,
    source: wikiAbility("Corruption Blast"),
  },
  {
    id: "smoke_tendrils",
    name: "Smoke Tendrils",
    style: "magic",
    category: "enhanced",
    tearingThornsSelfDamagePerHit: true,
    // Wiki: 4 hits over 4.2s (7 ticks occupancy); free after last hit offset + 1.
    channelTicks: 7,
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
    // on the next tick (wiki) - modelled as tick 0 + three at tick 1.
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
    // Greater Sunshine: DoT 21 x 10-20% (avg 315% total - not a front-loaded hit).
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
    supportNote:
      "ST primary, Glacial Embrace cost, and crit-adren window modeled. AoE secondaries and Lightning Surge nested crit-adren are not modeled.",
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
    weaponSpecial: true,
    requiresSpecialAccess: true,
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
    weaponSpecial: true,
    requiresSpecialAccess: true,
    hits: [{ band: { minPct: 200, maxPct: 240 } }],
    adrenaline: { cost: 25 },
    supportStatus: "partially-modeled",
    supportNote:
      "Cast band modeled. Defence -5% / affinity +2 for 60s not modeled (no dynamic DP recompute).",
    source: wikiAbility("Claws of Guthix"),
  },
  SOULFIRE_ABILITY,
];

/** Internal proc identity; excluded from the selectable Magic catalogue. */
export const LIGHTNING_SURGE_ABILITY: MagicAbilitySpec = {
  id: "instability_lightning_surge",
  name: "Lightning Surge",
  style: "magic",
  category: "enhanced",
  hits: [{ band: { minPct: 70, maxPct: 90 } }],
  essenceCorruptionMagicHitEligible: true,
  supportNote:
    "Instability proc hit; uses its own crit context and cannot recurse. Song Essence on Lightning Surge is an inferred capability exception, not directly sourced.",
  source: wikiAbility("Fractured Staff of Armadyl"),
};

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
      "4 self hits of 35-40% ability damage; unaffected by damage modifiers and crit. Not modelled as target damage; each advances Tearing Thorns.",
    source: wikiAbility("Smoke Tendrils"),
  },
  {
    id: "tsunami_crit_adrenaline",
    name: "Tsunami crit adrenaline",
    notes:
      "After Tsunami deals damage: Magic crits grant +8% adren for 50 ticks (Natural Instinct 16%). Modeled as sampled land-time Bernoulli adrenaline state (not critChance*8 EV). Own hit eligible. Crit-ineligible DoTs grant nothing. Residual: AoE secondaries, Glacial Embrace cost, Lightning Surge nested crit-adren.",
    source: wikiAbility("Tsunami"),
  },
  {
    id: "chain_spread",
    name: "Chain / Greater Chain follow-up",
    notes:
      "Next single-target Magic ability within 6s also hits chained targets at 30% (Chain) / 50% (Greater) of that ability's damage range. Caroming target count + secondary damage unmodeled: engine lacks multi-target identity (separate HP, debuffs, DP, caps, death, events). Primary hit bands only; do not inflate primary damage.",
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
    name: "Lightning Surge",
    notes:
      "While Instability buff (30s / 50 ticks): Magic crits on primary target fire Lightning Surge 70-90% ability damage 1 tick later. EV: p·T per crit-eligible hit (wiki formula). Surge crits do not chain. Magic weapons only. PvP: no crit effect and no cooldown - out of scope.",
    source: wikiAbility("Instability"),
  },
  {
    id: "claws_of_guthix_debuff",
    name: "Claws of Guthix debuff",
    notes:
      "Lowers target Defence by 5% and raises affinity by 2 for 60s. Not modeled: sim accuracy/DP is static (no live Defence/affinity recompute). Do not invent a direct damage mult. Cast band 200-240% only.",
    source: wikiAbility("Claws of Guthix"),
  },
  {
    id: "blast_infused",
    name: "Blast Infused (Inner Wrath)",
    notes:
      "Blast diffusion boots: Wild Magic arms Blast Infused for 10 ticks; magic basics (incl. auto + Combust) +8% base damage. Modeled via blast-diffusion-inner-wrath passive + runtime window.",
    source: wikiAbility("Blast diffusion boots", "Blast_diffusion_boots"),
  },
  {
    id: "rune_consumption",
    name: "Rune consumption",
    notes: "Any magic ability can consume runes, 15% per cast (was 20% at release, changed 9 Mar).",
    source: REFINEMENTS_WIKI_2026_03_09,
  },
];
