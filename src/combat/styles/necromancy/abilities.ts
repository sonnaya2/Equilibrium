import type { SourceReference } from "../../types";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { MODERNISATION_WIKI, NECROSIS_WIKI, RESIDUAL_SOUL_WIKI } from "../../data/sources";
import {
  DEATH_GRASP_DAMAGE_PER_STACK_PCT,
  FINGER_OF_DEATH_COST_REDUCTION_PER_STACK_PCT,
  FINGER_OF_DEATH_MAX_STACKS,
  NECROSIS_CAP,
  TOUCH_OF_DEATH_NECROSIS,
} from "./necrosis";
import { COMMAND_SKELETON_FIRST_HIT_OFFSET, CONJURES_CANNOT_CRIT } from "./conjures";
import { SPECTRAL_SCYTHE_SOUL_CHANCE, VOLLEY_OF_SOULS_BAND } from "./souls";

export {
  CONJURE_UNTIL_OFFSET_TICKS,
  SKELETON_AUTO_BAND,
  SKELETON_AUTO_INTERVAL,
  SKELETON_FIRST_AUTO_TICKS,
  ZOMBIE_AUTO_BAND,
  ZOMBIE_AUTO_INTERVAL,
  GHOST_AUTO_BAND,
  GHOST_AUTO_INTERVAL,
  UNDEAD_ARMY_DEFAULT,
} from "./conjures";

/**
 * Necromancy bands verified against current Wiki ability pages on 2026-07-26.
 * Death Skulls and Living Death use their post-modernisation values.
 */

const VERIFIED = "2026-07-26";

const wiki = (title: string, path: string): SourceReference => ({
  source: "runescape-wiki",
  url: `https://runescape.wiki/w/${path}`,
  title,
  verifiedAt: VERIFIED,
});

export const NECROMANCY_BASIC_WIKI = wiki("Necromancy (ability)", "Necromancy_(ability)");
export const SOUL_SAP_WIKI = wiki("Soul Sap", "Soul_Sap");
export const TOUCH_OF_DEATH_WIKI = wiki("Touch of Death", "Touch_of_Death");
export const FINGER_OF_DEATH_WIKI = wiki("Finger of Death", "Finger_of_Death");
export const DEATH_SKULLS_WIKI = wiki("Death Skulls", "Death_Skulls");
export const SOUL_STRIKE_WIKI = wiki("Soul Strike", "Soul_Strike");
export const SPECTRAL_SCYTHE_WIKI = wiki("Spectral Scythe", "Spectral_Scythe");
export const BLOAT_WIKI = wiki("Bloat", "Bloat");
export const LIVING_DEATH_WIKI = wiki("Living Death", "Living_Death");
export const VOLLEY_OF_SOULS_WIKI = wiki("Volley of Souls", "Volley_of_Souls");
export const BLOOD_SIPHON_WIKI = wiki("Blood Siphon", "Blood_Siphon");
export const COMMAND_SKELETON_WIKI = wiki("Command Skeleton Warrior", "Command_Skeleton_Warrior");
export const COMMAND_PUTRID_WIKI = wiki("Command Putrid Zombie", "Command_Putrid_Zombie");
export const COMMAND_PHANTOM_WIKI = wiki("Command Phantom Guardian", "Command_Phantom_Guardian");
export const COMMAND_GHOST_WIKI = wiki("Command Vengeful Ghost", "Command_Vengeful_Ghost");
export const DEATH_GRASP_WIKI = wiki("Death Grasp", "Death_Grasp");
export const CONJURE_SKELETON_WIKI = wiki("Conjure Skeleton Warrior", "Conjure_Skeleton_Warrior");
export const CONJURE_GHOST_WIKI = wiki("Conjure Vengeful Ghost", "Conjure_Vengeful_Ghost");
export const CONJURE_ZOMBIE_WIKI = wiki("Conjure Putrid Zombie", "Conjure_Putrid_Zombie");
export const CONJURE_PHANTOM_WIKI = wiki("Conjure Phantom Guardian", "Conjure_Phantom_Guardian");
export const CONJURE_ARMY_WIKI = wiki("Conjure Undead Army", "Conjure_Undead_Army");

export interface NecromancyAbilitySpec extends AbilitySpec {
  style: "necromancy";
  /** Necrosis stacks granted on cast (Touch of Death = 4). */
  necrosisGain?: number;
  /** Residual Souls granted on a successful hit (Soul Sap = 1). */
  soulGain?: number;
  /** Residual Souls spent on cast (Soul Strike = 1; Volley = all). */
  soulCost?: number;
  /** Chance to generate a Residual Soul per target (Spectral Scythe = 0.25). */
  soulChance?: number;
  /**
   * Hits derived from the resolved FIRST hit at this fraction of it (wiki:
   * Bloat tails = 25% of the initial hit; Death Skulls bounces = 100%).
   * They inherit the source hit's crit-boosted damage, never crit themselves,
   * and are never re-modified.
   */
  derivedHits?: {
    count: number;
    intervalTicks: number;
    firstOffset: number;
    fractionPct: number;
    /** Damage-over-time tails (Bloat) vs direct derived hits (Death Skulls). */
    dot: boolean;
  };
  source: SourceReference;
}

export function isNecromancyAbility(ability: AbilitySpec): ability is NecromancyAbilitySpec {
  return ability.style === "necromancy";
}

/** Residual Soul cap is 3, or 5 with a soulbound lantern. */
export const MAX_SOULS = 5;
/** Volley requires at least 2 Residual Souls to activate (wiki). */
export const VOLLEY_MIN_SOULS = 2;

export const FINGER_OF_DEATH_BASE_COST_PCT = 60;
export const FINGER_OF_DEATH_BAND = { minPct: 270, maxPct: 330 } as const;
/** Living Death multiplies Finger of Death damage by 1.5 (wiki). */
export const FINGER_OF_DEATH_LIVING_DEATH_MULT = 1.5;
export const DEATH_SKULLS_BAND = { minPct: 225, maxPct: 275 } as const;
/** Single-target bounce path: 3 hits on the primary target (wiki Damage section). */
export const DEATH_SKULLS_SINGLE_TARGET_HITS = 3;
/** Igneous single-target: initial hit + 3 derived target hits. */
export const DEATH_SKULLS_IGNEOUS_SINGLE_TARGET_HITS = 4;
export const DEATH_SKULLS_BASE_COST_PCT = 60;
export const DEATH_SKULLS_COOLDOWN_SECONDS = 60;
/** Living Death reduces Death Skulls' cooldown to 17 ticks / 10.2s (2 Mar 2026). */
export const DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS = 17;
export const BLOAT_INITIAL_BAND = { minPct: 135, maxPct: 165 } as const;
export const BLOAT_DOT_HITS = 10;
export const BLOAT_DOT_TICK_INTERVAL = 3;
/** DoT hit = 25% of initial damage; modelled as 0.25 × initial band for EV/min/max. */
export const BLOAT_DOT_FRACTION = 0.25;
export const LIVING_DEATH_DURATION_SECONDS = 30;
export const LIVING_DEATH_COOLDOWN_SECONDS = 90;
/** Under Living Death, Touch of Death gains +6% adrenaline (wiki). */
export const TOUCH_OF_DEATH_LIVING_DEATH_ADRENALINE_BONUS = 6;
/** Under Living Death, basic attack generates 2 Necrosis stacks (wiki). */
export const LIVING_DEATH_BASIC_NECROSIS = 2;

/** Blood Siphon: solo primary model is the finishing hit only (wiki). */
export const BLOOD_SIPHON_FINAL_BAND = { minPct: 117, maxPct: 143 } as const;
/** Channel hits land on non-primary enemies only - 22-28% each, 4 hits over 5.4s. */
export const BLOOD_SIPHON_CHANNEL_BAND = { minPct: 22, maxPct: 28 } as const;
export const BLOOD_SIPHON_CHANNEL_HITS = 4;
export const BLOOD_SIPHON_COOLDOWN_SECONDS = 45;

/**
 * Command Skeleton Warrior: detailed hit table is 10 hits of the spirit band.
 * Tooltip summary says "2 hits" - body + hit-timing table pin 10 attacks.
 */
export const COMMAND_SKELETON_BAND = { minPct: 22, maxPct: 28 } as const;
export const COMMAND_SKELETON_HITS = 10;
export const COMMAND_SKELETON_COOLDOWN_SECONDS = 15;

export const COMMAND_PUTRID_ZOMBIE_BAND = { minPct: 360, maxPct: 440 } as const;
/** Explosion lands 4 ticks after cast (wiki hit timings). */
export const COMMAND_PUTRID_ZOMBIE_TICK_OFFSET = 4;

export const COMMAND_PHANTOM_GUARDIAN_BAND = { minPct: 45, maxPct: 55 } as const;
export const COMMAND_PHANTOM_MAX_VALOUR = 25;
/** +20% of the hit per Valour stack (wiki) → ×(1 + 0.2 × stacks). */
export const COMMAND_PHANTOM_VALOUR_MULT_PER_STACK = 0.2;
export const COMMAND_PHANTOM_COOLDOWN_SECONDS = 9;
export const COMMAND_PHANTOM_HIT_TICK_OFFSET = 4;

/** Death Grasp (Death guard special): base 405-495% + 40% AD per Necrosis stack. */
export const DEATH_GRASP_BAND = { minPct: 405, maxPct: 495 } as const;
export const DEATH_GRASP_ADRENALINE_COST = 25;
export const DEATH_GRASP_COOLDOWN_SECONDS = 30;

const spiritCrit = (): boolean => !CONJURES_CANNOT_CRIT;

export const NECROMANCY_ABILITIES: NecromancyAbilitySpec[] = [
  {
    id: "necromancy_basic",
    name: "Necromancy",
    style: "necromancy",
    category: "basic",
    autoAttack: true,
    hits: [{ band: { minPct: 90, maxPct: 110 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 1.8,
    source: NECROMANCY_BASIC_WIKI,
  },
  {
    id: "soul_sap",
    name: "Soul Sap",
    style: "necromancy",
    category: "basic",
    hits: [{ band: { minPct: 90, maxPct: 110 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 5.4,
    soulGain: 1,
    source: SOUL_SAP_WIKI,
  },
  {
    id: "touch_of_death",
    name: "Touch of Death",
    style: "necromancy",
    category: "basic",
    hits: [{ band: { minPct: 90, maxPct: 110 } }],
    adrenaline: { gain: 9 },
    cooldownSeconds: 14.4,
    necrosisGain: TOUCH_OF_DEATH_NECROSIS,
    source: TOUCH_OF_DEATH_WIKI,
  },
  {
    id: "finger_of_death",
    name: "Finger of Death",
    style: "necromancy",
    category: "enhanced",
    hits: [{ band: { ...FINGER_OF_DEATH_BAND } }],
    adrenaline: { cost: FINGER_OF_DEATH_BASE_COST_PCT },
    source: FINGER_OF_DEATH_WIKI,
  },
  {
    // Single-target: initial hit + 2 damaging bounces at 2-tick intervals
    // (monster → player → monster → player → monster; player hops deal nothing).
    // Each bounce deals 100% of the resolved initial hit - crit inheritance
    // (wiki: "if the initial hit was a critical hit, the remaining hits will
    // also be critical hits"). Igneous variant is death_skulls_igneous.
    id: "death_skulls",
    name: "Death Skulls",
    style: "necromancy",
    category: "ultimate",
    area: "multi-target",
    hits: [{ band: { ...DEATH_SKULLS_BAND } }],
    derivedHits: {
      count: DEATH_SKULLS_SINGLE_TARGET_HITS - 1,
      intervalTicks: 2,
      firstOffset: 2,
      fractionPct: 100,
      dot: false,
    },
    adrenaline: { cost: DEATH_SKULLS_BASE_COST_PCT },
    cooldownSeconds: DEATH_SKULLS_COOLDOWN_SECONDS,
    replacementGroup: "death_skulls",
    supportStatus: "partially-modeled",
    supportNote: "Single-target only (bounce path via the player).",
    source: DEATH_SKULLS_WIKI,
  },
  {
    // Igneous Kal-Mor / Kal-Zuk: one extra primary-target bounce in the ST model
    // (initial + 3 derived = 4 damaging hits). Same bands, intervals, crit inheritance.
    id: "death_skulls_igneous",
    name: "Death Skulls (Igneous)",
    style: "necromancy",
    category: "ultimate",
    area: "multi-target",
    hits: [{ band: { ...DEATH_SKULLS_BAND } }],
    derivedHits: {
      count: DEATH_SKULLS_IGNEOUS_SINGLE_TARGET_HITS - 1,
      intervalTicks: 2,
      firstOffset: 2,
      fractionPct: 100,
      dot: false,
    },
    adrenaline: { cost: DEATH_SKULLS_BASE_COST_PCT },
    cooldownSeconds: DEATH_SKULLS_COOLDOWN_SECONDS,
    replacementGroup: "death_skulls",
    requiredPassiveAnyOf: ["igneous-death-skulls"],
    source: DEATH_SKULLS_WIKI,
  },
  {
    // Primary target only. Splash 90-110% to nearby enemies is multi-target sim territory.
    id: "soul_strike",
    name: "Soul Strike",
    style: "necromancy",
    category: "enhanced",
    area: "multi-target",
    hits: [{ band: { minPct: 135, maxPct: 165 } }],
    adrenaline: { cost: 0 },
    soulCost: 1,
    source: SOUL_STRIKE_WIKI,
  },
  {
    id: "spectral_scythe",
    name: "Spectral Scythe",
    style: "necromancy",
    category: "enhanced",
    area: "aoe",
    hits: [{ band: { minPct: 72, maxPct: 88 } }],
    adrenaline: { cost: 10 },
    cooldownSeconds: 15,
    soulChance: SPECTRAL_SCYTHE_SOUL_CHANCE,
    source: SPECTRAL_SCYTHE_WIKI,
  },
  {
    id: "spectral_scythe_2",
    name: "Spectral Scythe (cast 2)",
    style: "necromancy",
    category: "enhanced",
    area: "aoe",
    hits: [{ band: { minPct: 180, maxPct: 220 } }],
    adrenaline: { cost: 20 },
    soulChance: SPECTRAL_SCYTHE_SOUL_CHANCE,
    source: SPECTRAL_SCYTHE_WIKI,
  },
  {
    // Base band only. Missing-HP multiplier (1% per 1% missing, up to +100%) is a
    // target-stage modifier - applied when targetHpPercent is provided.
    id: "spectral_scythe_3",
    name: "Spectral Scythe (cast 3)",
    style: "necromancy",
    category: "enhanced",
    area: "aoe",
    hits: [{ band: { minPct: 225, maxPct: 275 } }],
    adrenaline: { cost: 30 },
    supportStatus: "partially-modeled",
    supportNote: "Missing-HP multiplier applies only when target HP% is set.",
    source: SPECTRAL_SCYTHE_WIKI,
  },
  {
    // Initial hit + 10 DoT tails every 3 ticks, each 25% of the RESOLVED initial
    // hit (crit boost included; the tails themselves never crit and are never
    // re-modified - wiki Bloat, verified 2026-07-31).
    id: "bloat",
    name: "Bloat",
    style: "necromancy",
    category: "enhanced",
    hits: [{ band: { ...BLOAT_INITIAL_BAND } }],
    derivedHits: {
      count: BLOAT_DOT_HITS,
      intervalTicks: BLOAT_DOT_TICK_INTERVAL,
      firstOffset: BLOAT_DOT_TICK_INTERVAL,
      fractionPct: BLOAT_DOT_FRACTION * 100,
      dot: true,
    },
    adrenaline: { cost: 20 },
    supportStatus: "partially-modeled",
    supportNote:
      "On-death spread and dynamic on-npc retargeting not modeled (single static target).",
    source: BLOAT_WIKI,
  },
  {
    id: "living_death",
    name: "Living Death",
    style: "necromancy",
    category: "ultimate",
    hits: [],
    adrenaline: { cost: 100 },
    cooldownSeconds: LIVING_DEATH_COOLDOWN_SECONDS,
    stateEffect: "living_death",
    source: LIVING_DEATH_WIKI,
  },
  {
    // Solo primary: finishing hit only. Channel 4×22-28% hits non-primaries only
    // (heal + 100% of heal on the finisher is multi-target sim territory).
    // Wiki Blood Siphon: "Attack 5 times over 5.4s (9 ticks). Channelled." The
    // single-target model keeps the 117-143% finisher only (at +9, the release
    // tick, where the canonical clock lands it before the next cast); the 9-tick
    // channel occupies the actor for its full duration either way.
    id: "blood_siphon",
    name: "Blood Siphon",
    style: "necromancy",
    category: "enhanced",
    channelTicks: 9,
    hits: [{ band: { ...BLOOD_SIPHON_FINAL_BAND }, tickOffset: 9 }],
    adrenaline: { cost: 0 },
    cooldownSeconds: BLOOD_SIPHON_COOLDOWN_SECONDS,
    supportStatus: "partially-modeled",
    supportNote: "5.4s channel simplified to the finishing hit only.",
    source: BLOOD_SIPHON_WIKI,
  },
  {
    // Spirit damage - conjures cannot crit. Rage scales each hit at land time.
    // Wiki tick table: RAAAR at +1, the 10 hits land at +2..+11.
    id: "command_skeleton_warrior",
    name: "Command Skeleton Warrior",
    style: "necromancy",
    category: "enhanced",
    hits: Array.from({ length: COMMAND_SKELETON_HITS }, (_, i) => ({
      band: { ...COMMAND_SKELETON_BAND },
      critEligible: spiritCrit(),
      tickOffset: i + COMMAND_SKELETON_FIRST_HIT_OFFSET,
    })),
    adrenaline: { cost: 0 },
    cooldownSeconds: COMMAND_SKELETON_COOLDOWN_SECONDS,
    source: COMMAND_SKELETON_WIKI,
  },
  {
    id: "command_putrid_zombie",
    name: "Command Putrid Zombie",
    style: "necromancy",
    category: "enhanced",
    hits: [
      {
        band: { ...COMMAND_PUTRID_ZOMBIE_BAND },
        critEligible: spiritCrit(),
        tickOffset: COMMAND_PUTRID_ZOMBIE_TICK_OFFSET,
      },
    ],
    adrenaline: { cost: 0 },
    source: COMMAND_PUTRID_WIKI,
  },
  {
    // Base 0 Valour. Use commandPhantomGuardian({ valour }) for stack scale.
    id: "command_phantom_guardian",
    name: "Command Phantom Guardian",
    style: "necromancy",
    category: "enhanced",
    hits: [
      {
        band: { ...COMMAND_PHANTOM_GUARDIAN_BAND },
        critEligible: spiritCrit(),
        tickOffset: COMMAND_PHANTOM_HIT_TICK_OFFSET,
      },
    ],
    adrenaline: { cost: 0 },
    cooldownSeconds: COMMAND_PHANTOM_COOLDOWN_SECONDS,
    source: COMMAND_PHANTOM_WIKI,
  },
  {
    // No direct damage. Empowers remaining ghost autos to apply Haunted (applyGhostCommand).
    id: "command_vengeful_ghost",
    name: "Command Vengeful Ghost",
    style: "necromancy",
    category: "enhanced",
    hits: [],
    adrenaline: { cost: 0 },
    stateEffect: "command_vengeful_ghost",
    source: COMMAND_GHOST_WIKI,
  },
  {
    // Death guard special (not a bar ability). Base 0 Necrosis - see deathGrasp().
    id: "death_grasp",
    name: "Death Grasp",
    style: "necromancy",
    category: "enhanced",
    weaponSpecial: true,
    hits: [{ band: { ...DEATH_GRASP_BAND } }],
    adrenaline: { cost: DEATH_GRASP_ADRENALINE_COST },
    cooldownSeconds: DEATH_GRASP_COOLDOWN_SECONDS,
    source: DEATH_GRASP_WIKI,
  },
  {
    id: "conjure_skeleton_warrior",
    name: "Conjure Skeleton Warrior",
    style: "necromancy",
    category: "enhanced",
    hits: [],
    adrenaline: { cost: 0 },
    stateEffect: "conjure_skeleton_warrior",
    // Wiki Conjuration: equipment Conduit (off-hand). Siphon alone is not enough.
    weaponRequirement: "conduit",
    supportStatus: "partially-modeled",
    supportNote: "Spirit Pact III duration assumed; duration-extending effects not modeled.",
    source: CONJURE_SKELETON_WIKI,
  },
  {
    id: "conjure_vengeful_ghost",
    name: "Conjure Vengeful Ghost",
    style: "necromancy",
    category: "enhanced",
    hits: [],
    adrenaline: { cost: 0 },
    stateEffect: "conjure_vengeful_ghost",
    weaponRequirement: "conduit",
    supportStatus: "partially-modeled",
    supportNote: "Ghost healing and Spirit Pact duration variants are not modeled.",
    source: CONJURE_GHOST_WIKI,
  },
  {
    id: "conjure_putrid_zombie",
    name: "Conjure Putrid Zombie",
    style: "necromancy",
    category: "enhanced",
    hits: [],
    adrenaline: { cost: 0 },
    stateEffect: "conjure_putrid_zombie",
    cooldownSeconds: 30,
    weaponRequirement: "conduit",
    supportStatus: "partially-modeled",
    supportNote: "Spirit Pact III duration assumed; duration-extending effects not modeled.",
    source: CONJURE_ZOMBIE_WIKI,
  },
  {
    id: "conjure_phantom_guardian",
    name: "Conjure Phantom Guardian",
    style: "necromancy",
    category: "enhanced",
    hits: [],
    adrenaline: { cost: 0 },
    stateEffect: "conjure_phantom_guardian",
    weaponRequirement: "conduit",
    supportStatus: "partially-modeled",
    supportNote: "Phantom Guardian's taunt / damage-sharing role is not modeled (damage only).",
    source: CONJURE_PHANTOM_WIKI,
  },
  {
    // Default army = skeleton + ghost + zombie (phantom opt-in via customisation - unmodelled).
    id: "conjure_undead_army",
    name: "Conjure Undead Army",
    style: "necromancy",
    category: "enhanced",
    hits: [],
    adrenaline: { cost: 0 },
    stateEffect: "conjure_undead_army",
    weaponRequirement: "conduit",
    supportStatus: "partially-modeled",
    supportNote:
      "Army conjures the default three spirits at Spirit Pact III; customisation not modeled.",
    source: CONJURE_ARMY_WIKI,
  },
];

/**
 * Volley of Souls: spends all Residual Souls, one 135-165% hit per soul.
 * Requires 2-5 souls (lantern cap). Adrenaline cost is 0% (wiki).
 */
export function volleyOfSouls(soulCount: number): NecromancyAbilitySpec {
  if (!Number.isInteger(soulCount) || soulCount < VOLLEY_MIN_SOULS || soulCount > MAX_SOULS) {
    throw new RangeError(
      `volleyOfSouls: soul count ${soulCount} outside ${VOLLEY_MIN_SOULS}-${MAX_SOULS}`,
    );
  }
  return {
    id: "volley_of_souls",
    name: "Volley of Souls",
    style: "necromancy",
    category: "enhanced",
    hits: Array.from({ length: soulCount }, () => ({ band: { ...VOLLEY_OF_SOULS_BAND } })),
    adrenaline: { cost: 0 },
    soulCost: soulCount,
    source: VOLLEY_OF_SOULS_WIKI,
  };
}

/**
 * Finger of Death with Necrosis discount and optional Living Death 1.5× band.
 * Consumes up to 6 Necrosis stacks (−10% adrenaline each from a 60% base).
 */
export function fingerOfDeath(
  opts: {
    necrosisStacks?: number;
    livingDeath?: boolean;
  } = {},
): NecromancyAbilitySpec {
  const stacks = Math.max(0, Math.min(opts.necrosisStacks ?? 0, FINGER_OF_DEATH_MAX_STACKS));
  const cost = Math.max(
    0,
    FINGER_OF_DEATH_BASE_COST_PCT - stacks * FINGER_OF_DEATH_COST_REDUCTION_PER_STACK_PCT,
  );
  const mult = opts.livingDeath ? FINGER_OF_DEATH_LIVING_DEATH_MULT : 1;
  return {
    id: "finger_of_death",
    name: opts.livingDeath ? "Finger of Death (Living Death)" : "Finger of Death",
    style: "necromancy",
    category: "enhanced",
    hits: [
      {
        band: {
          minPct: FINGER_OF_DEATH_BAND.minPct * mult,
          maxPct: FINGER_OF_DEATH_BAND.maxPct * mult,
        },
      },
    ],
    adrenaline: { cost },
    source: FINGER_OF_DEATH_WIKI,
  };
}

/**
 * Spectral Scythe cast 3 with missing-HP multiplier.
 * `hpFractionRemaining` is 0-1 of max LP; damage multiplies by (2 − remaining).
 * Example: 50% remaining → 1.5× base band (wiki).
 */
export function spectralScythe3(hpFractionRemaining: number): NecromancyAbilitySpec {
  if (!Number.isFinite(hpFractionRemaining) || hpFractionRemaining < 0 || hpFractionRemaining > 1) {
    throw new RangeError(`spectralScythe3: bad hp fraction ${hpFractionRemaining}`);
  }
  const mult = 2 - hpFractionRemaining;
  const base = NECROMANCY_ABILITIES.find((a) => a.id === "spectral_scythe_3")!;
  return {
    ...base,
    hits: [
      {
        band: {
          minPct: base.hits[0]!.band.minPct * mult,
          maxPct: base.hits[0]!.band.maxPct * mult,
        },
      },
    ],
  };
}

/**
 * Command Phantom Guardian with Valour stacks.
 * Damage × (1 + 0.2 × stacks); max 25 stacks → 270-330%.
 */
export function commandPhantomGuardian(opts: { valour?: number } = {}): NecromancyAbilitySpec {
  const stacks = Math.max(0, Math.min(opts.valour ?? 0, COMMAND_PHANTOM_MAX_VALOUR));
  const mult = 1 + COMMAND_PHANTOM_VALOUR_MULT_PER_STACK * stacks;
  return {
    id: "command_phantom_guardian",
    name: stacks > 0 ? `Command Phantom Guardian (${stacks} Valour)` : "Command Phantom Guardian",
    style: "necromancy",
    category: "enhanced",
    hits: [
      {
        band: {
          minPct: COMMAND_PHANTOM_GUARDIAN_BAND.minPct * mult,
          maxPct: COMMAND_PHANTOM_GUARDIAN_BAND.maxPct * mult,
        },
        critEligible: spiritCrit(),
        tickOffset: COMMAND_PHANTOM_HIT_TICK_OFFSET,
      },
    ],
    adrenaline: { cost: 0 },
    cooldownSeconds: COMMAND_PHANTOM_COOLDOWN_SECONDS,
    source: COMMAND_PHANTOM_WIKI,
  };
}

/**
 * Death Grasp special with Necrosis stacks.
 * Band = (405-495) + 40 × stacks (flat ability-damage percent per stack).
 */
export function deathGrasp(opts: { necrosisStacks?: number } = {}): NecromancyAbilitySpec {
  const stacks = Math.max(0, Math.min(opts.necrosisStacks ?? 0, NECROSIS_CAP));
  const bonus = stacks * DEATH_GRASP_DAMAGE_PER_STACK_PCT;
  return {
    id: "death_grasp",
    name: stacks > 0 ? `Death Grasp (${stacks} Necrosis)` : "Death Grasp",
    style: "necromancy",
    category: "enhanced",
    weaponSpecial: true,
    hits: [
      {
        band: {
          minPct: DEATH_GRASP_BAND.minPct + bonus,
          maxPct: DEATH_GRASP_BAND.maxPct + bonus,
        },
      },
    ],
    adrenaline: { cost: DEATH_GRASP_ADRENALINE_COST },
    cooldownSeconds: DEATH_GRASP_COOLDOWN_SECONDS,
    source: DEATH_GRASP_WIKI,
  };
}

/** Sourced notes that are not calculable damage specs (conjures, Living Death interactions). */
export const NECROMANCY_EFFECTS = [
  {
    id: "living_death",
    name: "Living Death",
    category: "ultimate" as const,
    adrenaline: { cost: 100 },
    durationSeconds: LIVING_DEATH_DURATION_SECONDS,
    notes:
      "30s form. Basic attack +2 Necrosis; Touch of Death +6% adrenaline; Finger of Death 1.5× damage; Death Skulls CD → 17 ticks and CD reset on cast (with Touch of Death). No direct damage band.",
    source: LIVING_DEATH_WIKI,
  },
  {
    id: "death_skulls_living_death",
    name: "Death Skulls under Living Death",
    notes: `Cooldown reduced to ${DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS} ticks (10.2s); CD reset on Living Death cast. Enables triple Death Skulls without aura/potion.`,
    source: DEATH_SKULLS_WIKI,
  },
  {
    id: "death_skulls_igneous_multi",
    name: "Death Skulls multi-target with Igneous cape",
    notes:
      "Multi-target bounce count rises with the cape (wiki). The engine models the single-target path via death_skulls / death_skulls_igneous.",
    source: DEATH_SKULLS_WIKI,
  },
  {
    id: "volley_of_souls",
    name: "Volley of Souls",
    notes: "Spends all Residual Souls (min 2); one 135–165% hit per soul; 0% adrenaline.",
    source: RESIDUAL_SOUL_WIKI,
  },
  {
    id: "touch_of_death",
    name: "Touch of Death",
    notes: `+${TOUCH_OF_DEATH_NECROSIS} Necrosis stacks. Living Death: +${TOUCH_OF_DEATH_LIVING_DEATH_ADRENALINE_BONUS}% adrenaline.`,
    source: NECROSIS_WIKI,
  },
  {
    id: "finger_of_death",
    name: "Finger of Death",
    notes:
      "Base 60% adrenaline; −10% per Necrosis stack up to 6 (free at 6). Living Death: 1.5× damage (405–495%).",
    source: NECROSIS_WIKI,
  },
  {
    id: "soul_sap",
    name: "Soul Sap",
    notes: "Generates 1 Residual Soul per target hit (needs a health bar).",
    source: RESIDUAL_SOUL_WIKI,
  },
  {
    id: "spectral_scythe",
    name: "Spectral Scythe",
    notes:
      "25% chance to generate a Residual Soul per target hit on casts 1–2. Cast 3 scales with missing HP.",
    source: RESIDUAL_SOUL_WIKI,
  },
  {
    id: "soul_strike",
    name: "Soul Strike",
    notes:
      "Spends 1 Residual Soul; primary 135–165% + stun/bind; splash 90–110% (splash unmodelled).",
    source: RESIDUAL_SOUL_WIKI,
  },
  {
    id: "blood_siphon_aoe",
    name: "Blood Siphon multi-target",
    notes:
      "Solo model is the 117–143% finisher only. Channel: 4 hits of 22–28% to non-primary enemies within 2 tiles; heal 70% of channel damage; finisher adds +100% of total heal. Unmodelled multi-target.",
    source: BLOOD_SIPHON_WIKI,
  },
  {
    id: "command_skeleton_rage",
    name: "Command Skeleton Warrior rage",
    notes:
      "10 hits of 22–28% spirit damage (cannot crit). Rage (+3% damage per stack, up to 25) scales hits further; wiki marginal benefit ≈ 350% AD once fully enraged.",
    source: COMMAND_SKELETON_WIKI,
  },
  {
    id: "command_vengeful_ghost",
    name: "Command Vengeful Ghost",
    notes:
      "No direct damage band. Empowers remaining Vengeful Ghost autos to apply Haunted (+10% of hit, capped at 20% Necromancy ability damage).",
    source: COMMAND_GHOST_WIKI,
  },
  {
    id: "conjures",
    name: "Conjures",
    notes:
      "Undead Army summons Skeleton Warrior, Vengeful Ghost, and Putrid Zombie for 63 seconds. Their attacks use sourced timings and cannot crit. Ghost healing and Phantom customisation are not included.",
    source: MODERNISATION_WIKI,
  },
  {
    id: "darkness",
    name: "Darkness",
    notes:
      "Incantation / Aspect of Evasion: 20% dodge for 12 minutes. No damage band — not modelled as an ability.",
    source: wiki("Darkness", "Darkness"),
  },
  {
    id: "invoke_death",
    name: "Invoke Death",
    notes:
      "Incantation: next Necromancy attack applies Death Mark (execute below 20% LP or 30k, whichever lower). No direct damage band.",
    source: wiki("Invoke Death", "Invoke_Death"),
  },
  {
    id: "necromancy_basic",
    name: "Necromancy basic attack",
    notes:
      "Counts as a basic ability for Impatient and Fury of the Small since modernisation. Living Death: +2 Necrosis per cast.",
    source: MODERNISATION_WIKI,
  },
];
