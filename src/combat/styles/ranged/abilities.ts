import type { SourceReference } from "../../types";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { MODERNISATION_WIKI } from "../../data/sources";

/**
 * Post-modernisation ranged kit. Bands verified against ability pages on
 * 2026-07-26 (post-CSM + refinements). Multi-hit structure matches wiki hit
 * lists; single-target models assume full ricochet return (no secondary targets).

 * Pre-CSM removals (not modelled): Tight Bindings, Dazing Shot, Demoralise,
 * Rout, Needle Strike, Fragmentation Shot, Salt the Wound, Unload, Incendiary
 * Shot. Escape is pure utility - skipped.
 */
export interface RangedAbilitySpec extends AbilitySpec {
  style: "ranged";
  source: SourceReference;
}

const VERIFIED = "2026-07-26";

const wiki = (title: string, path: string): SourceReference => ({
  source: "runescape-wiki",
  url: `https://runescape.wiki/w/${path}`,
  title,
  verifiedAt: VERIFIED,
});

/** Corruption Shot parent band (wiki initial DoT tick). */
export const CORRUPTION_INITIAL_BAND = { minPct: 90, maxPct: 110 } as const;
/** Decaying fractions of the resolved parent (wiki -20% of initial each step). */
export const CORRUPTION_TAIL_FRACTIONS_PCT = [80, 60, 40, 20] as const;

export const RANGED_ABILITIES: RangedAbilitySpec[] = [
  {
    id: "balance_by_force",
    name: "Balance by Force",
    style: "ranged",
    category: "enhanced",
    weaponSpecial: true,
    requiresSpecialAccess: true,
    minimumAutomaticRecastTicks: 50,
    hits: [{ band: { minPct: 235, maxPct: 255 } }],
    adrenaline: { cost: 30 },
    stateEffect: "balance_by_force",
    source: wiki("Balance by Force", "Balance_by_Force"),
  },
  {
    id: "ranged_attack",
    name: "Ranged",
    style: "ranged",
    category: "basic",
    basicAttack: true,
    hits: [{ band: { minPct: 90, maxPct: 110 } }],
    adrenaline: { gain: 9 },
    source: MODERNISATION_WIKI,
  },
  {
    // Wiki: 2 hits 45-55% each; each hit -2.4s Snipe CD (Fleeting boots 3.6s).
    id: "piercing_shot",
    name: "Piercing Shot",
    style: "ranged",
    category: "basic",
    hits: [{ band: { minPct: 45, maxPct: 55 } }, { band: { minPct: 45, maxPct: 55 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 3,
    source: wiki("Piercing Shot", "Piercing_Shot"),
  },
  {
    // Wiki: 65-75% + stun 1.2s / bind 9.6s. Damage below a basic - CC utility.
    // 2 charges at 70 Ranged; independent 15s recovery per charge.
    id: "binding_shot",
    name: "Binding Shot",
    style: "ranged",
    category: "basic",
    hits: [{ band: { minPct: 65, maxPct: 75 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 15,
    // Ability page: second charge at 54 Ranged (peers Backhand/Impact).
    charges: { max: 2, secondChargeLevel: 54 },
    source: wiki("Binding Shot", "Binding_Shot"),
  },
  {
    // Wiki: 90-110% + Searing Winds 6s (10 ticks).
    id: "galeshot",
    name: "Galeshot",
    style: "ranged",
    category: "basic",
    hits: [{ band: { minPct: 90, maxPct: 110 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 20.4,
    appliesEffect: "searing_winds",
    source: wiki("Galeshot", "Galeshot"),
  },
  {
    // Solo primary: initial 75-85 + two return hits 15-20 at +1 tick.
    id: "ricochet",
    name: "Ricochet",
    style: "ranged",
    category: "basic",
    area: "multi-target",
    hits: [
      { band: { minPct: 75, maxPct: 85 } },
      { band: { minPct: 15, maxPct: 20 }, tickOffset: 1 },
      { band: { minPct: 15, maxPct: 20 }, tickOffset: 1 },
    ],
    adrenaline: { gain: 9 },
    cooldownSeconds: 10.2,
    replacementGroup: "ricochet",
    source: wiki("Ricochet", "Ricochet"),
  },
  {
    // Solo primary: Ricochet + four more returns at 4-6% each (after the first two).
    id: "greater_ricochet",
    name: "Greater Ricochet",
    style: "ranged",
    category: "basic",
    area: "multi-target",
    hits: [
      { band: { minPct: 75, maxPct: 85 } },
      { band: { minPct: 15, maxPct: 20 }, tickOffset: 1 },
      { band: { minPct: 15, maxPct: 20 }, tickOffset: 1 },
      { band: { minPct: 4, maxPct: 6 }, tickOffset: 1 },
      { band: { minPct: 4, maxPct: 6 }, tickOffset: 1 },
      { band: { minPct: 4, maxPct: 6 }, tickOffset: 1 },
      { band: { minPct: 4, maxPct: 6 }, tickOffset: 1 },
    ],
    adrenaline: { gain: 9 },
    cooldownSeconds: 10.2,
    replacementGroup: "ricochet",
    source: wiki("Greater Ricochet", "Greater_Ricochet"),
  },
  {
    // Wiki: 2 hits 135-155% each; GCD only (2 Mar 2026 removed dedicated CD).
    id: "snap_shot",
    name: "Snap Shot",
    style: "ranged",
    category: "enhanced",
    hits: [{ band: { minPct: 135, maxPct: 155 } }, { band: { minPct: 135, maxPct: 155 } }],
    adrenaline: { cost: 25 },
    source: wiki("Snap Shot", "Snap_Shot"),
  },
  {
    // Wiki: channelled 1.8s then 300-360%; adrenaline 0; 60s CD.
    id: "snipe",
    name: "Snipe",
    style: "ranged",
    category: "enhanced",
    hits: [{ band: { minPct: 300, maxPct: 360 }, tickOffset: 3 }],
    adrenaline: { cost: 0 },
    cooldownSeconds: 60,
    source: wiki("Snipe", "Snipe"),
  },
  {
    // Wiki: single 220-260% hit to target + up to 9 in 2 tiles; GCD only (9 Mar 2026).
    id: "bombardment",
    name: "Bombardment",
    style: "ranged",
    category: "enhanced",
    area: "aoe",
    hits: [{ band: { minPct: 220, maxPct: 260 } }],
    adrenaline: { cost: 25 },
    source: wiki("Bombardment", "Bombardment"),
  },
  {
    // Wiki: 8 channel hits 75-85% every tick over 8 ticks; mobile; extends Searing Winds 1 tick/hit.
    id: "rapid_fire",
    name: "Rapid Fire",
    style: "ranged",
    category: "enhanced",
    channelTicks: 8,
    hits: Array.from({ length: 8 }, (_, i) => ({
      band: { minPct: 75, maxPct: 85 },
      tickOffset: i,
    })),
    adrenaline: { cost: 25 },
    cooldownSeconds: 20.4,
    source: wiki("Rapid Fire", "Rapid_Fire"),
  },
  {
    // Wiki DoT: parent 90-110 at cast; 4 derived tails every 2 ticks at 80/60/40/20% of resolved parent.
    id: "corruption_shot",
    name: "Corruption Shot",
    tearingThornsEligible: true,
    style: "ranged",
    category: "enhanced",
    hits: [
      {
        band: { ...CORRUPTION_INITIAL_BAND },
        critEligible: false,
        dot: true,
        tickOffset: 0,
      },
    ],
    derivedHits: {
      count: 4,
      intervalTicks: 2,
      firstOffset: 2,
      fractionPct: 80,
      fractionPcts: [...CORRUPTION_TAIL_FRACTIONS_PCT],
      dot: true,
    },
    adrenaline: { cost: 20 },
    cooldownSeconds: 15,
    source: wiki("Corruption Shot", "Corruption_Shot"),
  },
  {
    // Wiki: 200-240% guaranteed crit; 0% adren; extends Shadow Imbued 3.6s; self-damage separate.
    id: "shadow_tendrils",
    name: "Shadow Tendrils",
    style: "ranged",
    category: "enhanced",
    hits: [{ band: { minPct: 200, maxPct: 240 } }],
    guaranteedCrit: true,
    adrenaline: { cost: 0 },
    cooldownSeconds: 45,
    source: wiki("Shadow Tendrils", "Shadow_Tendrils"),
  },
  {
    // Wiki: no direct damage; applies Shadow Imbued (hits generate +5% adren).
    id: "imbue_shadows",
    name: "Imbue: Shadows",
    style: "ranged",
    category: "enhanced",
    hits: [],
    adrenaline: { cost: 40 },
    cooldownSeconds: 60,
    stateEffect: "shadow_imbued",
    source: wiki("Imbue: Shadows", "Imbue:_Shadows"),
  },
  {
    // Wiki base: 4 hits 105-125% each (was DoT pre-CSM).
    id: "deadshot",
    name: "Deadshot",
    style: "ranged",
    category: "ultimate",
    hits: Array.from({ length: 4 }, () => ({ band: { minPct: 105, maxPct: 125 } })),
    adrenaline: { cost: 60 },
    cooldownSeconds: 30,
    replacementGroup: "deadshot",
    source: wiki("Deadshot", "Deadshot"),
  },
  {
    // Wiki igneous cape: 8 hits 55-75% each.
    id: "deadshot_igneous",
    name: "Deadshot (Igneous)",
    style: "ranged",
    category: "ultimate",
    hits: Array.from({ length: 8 }, () => ({ band: { minPct: 55, maxPct: 75 } })),
    adrenaline: { cost: 60 },
    cooldownSeconds: 30,
    replacementGroup: "deadshot",
    requiredPassiveAnyOf: ["igneous-deadshot"],
    source: wiki("Deadshot", "Deadshot"),
  },
  {
    id: "deaths_swiftness",
    name: "Death's Swiftness",
    style: "ranged",
    category: "ultimate",
    hits: [],
    stateEffect: "deaths_swiftness",
    adrenaline: { cost: 100 },
    cooldownSeconds: 60,
    replacementGroup: "deaths_swiftness",
    source: wiki("Death's Swiftness", "Death%27s_Swiftness"),
  },
  {
    // Greater Death's Swiftness: same 1.5x self-buff, 63 active ticks after cast+1.
    id: "greater_deaths_swiftness",
    name: "Greater Death's Swiftness",
    style: "ranged",
    category: "ultimate",
    hits: [],
    stateEffect: "greater_deaths_swiftness",
    adrenaline: { cost: 100 },
    cooldownSeconds: 60,
    replacementGroup: "deaths_swiftness",
    source: wiki("Greater Death's Swiftness", "Greater_Death%27s_Swiftness"),
  },
];

/** Buff/effect records whose mechanics are state or prose, not a damage band. */
export const RANGED_EFFECTS = [
  {
    id: "deaths_swiftness_buff_notes",
    name: "Death's Swiftness buff window",
    notes:
      "Self buff: 1.5x damage for 50 active ticks base / 63 Greater (half-open, begins cast+1). Was ground-targeted area before 16 Mar 2026. Planted Feet extends base only - see effects.ts.",
    source: wiki("Death's Swiftness", "Death%27s_Swiftness"),
  },
  {
    id: "shadow_tendrils_self_damage",
    name: "Shadow Tendrils recoil",
    notes: "Self-damage 100-135% ability damage (wiki 2026-07-26). Not rolled as an outgoing hit.",
    source: wiki("Shadow Tendrils", "Shadow_Tendrils"),
  },
  {
    id: "ricochet_aoe",
    name: "Ricochet secondary targets",
    notes:
      "Engine models solo-target full return (2 bounce hits 15-20%). Live AoE hits up to 2 secondaries within 5 tiles instead of returning. Caroming: +4% ability damage per rank per hit (band construction in prepare).",
    source: wiki("Ricochet", "Ricochet"),
  },
  {
    id: "greater_ricochet_aoe",
    name: "Greater Ricochet secondary targets",
    notes:
      "Engine models solo-target full return (2x15-20% + 4x4-6%). Live AoE hits up to 6 secondaries; late returns only deal 4-6% when no secondary is found. Caroming scales each hit band.",
    source: wiki("Greater Ricochet", "Greater_Ricochet"),
  },
  {
    id: "snipe_piercing_interaction",
    name: "Snipe cooldown reduction",
    notes:
      "Each Piercing Shot hit reduces Snipe CD by 2.4s (3.6s with Fleeting boots). Nightmare gauntlets: +25% hit chance and mobile channel; enchanted dread adds a half-damage flanking shot (150-180%).",
    source: wiki("Snipe", "Snipe"),
  },
  {
    id: "rapid_fire_bind",
    name: "Rapid Fire bind",
    notes: "Binds the target for 6s (10 ticks). Each hit extends Searing Winds by 1 tick.",
    source: wiki("Rapid Fire", "Rapid_Fire"),
  },
  {
    id: "csm_removals",
    name: "Pre-CSM ranged removals",
    notes:
      "Removed 2 Mar 2026 (wiki historical pages; not calculable AbilitySpecs): Tight Bindings, Dazing Shot, Greater Dazing Shot, Demoralise, Rout, Needle Strike, Fragmentation Shot, Salt the Wound, Unload, Incendiary Shot, and all lesser variants. Escape remains live utility-only (no damage band).",
    source: MODERNISATION_WIKI,
  },
  {
    id: "darkfang_basic",
    name: "Ranged basic (Dark bow / Gloomfire)",
    notes:
      "Wiki Ranged (ability) Darkfang row: two hits of 45-55% instead of one 90-110%. Selected in prepare via equipmentIds (item:dark-bow / item:gloomfire-bow); not a separate bar ability.",
    source: wiki("Ranged (ability)", "Ranged_(ability)"),
  },
];
