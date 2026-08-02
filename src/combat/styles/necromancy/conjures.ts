import type { DamageBand } from "../../core/abilityDamage";
import type { SourceReference } from "../../types";
import { NECROSIS_WIKI } from "../../data/sources";

/**
 * Spirit Pact III timing:
 *   5-tick conjure anim + 100-tick lifetime → exclusive end at cast+105.
 * Skeleton attacks from +7 every 5 ticks, Zombie from +7 every 6, and Ghost
 * from +6 every 7. Skeleton rage adds 3% per attack up to 25 stacks.
 * Phantom has no auto; the default army is Skeleton, Ghost, and Zombie.
 * Spirit attacks cannot crit.
 */

export const CONJURE_IDS = [
  "skeleton_warrior",
  "vengeful_ghost",
  "putrid_zombie",
  "phantom_guardian",
] as const;

export type ConjureId = (typeof CONJURE_IDS)[number];

export const CONJURES_CANNOT_CRIT = true;

/** 5-tick conjure animation before the 100-tick SP3 lifetime starts. */
export const CONJURE_ANIM_TICKS = 5;
/** Spirit Pact III lifetime after anim (60s). Exclusive end = ready + anim + this. */
export const SPIRIT_PACT_III_DURATION_TICKS = 100;
/** Exclusive untilTick = readyTick + this (anim + SP3). */
export const CONJURE_UNTIL_OFFSET_TICKS = CONJURE_ANIM_TICKS + SPIRIT_PACT_III_DURATION_TICKS; // 105

export const SKELETON_FIRST_AUTO_TICKS = 7;
export const SKELETON_AUTO_INTERVAL = 5;
export const SKELETON_AUTO_BAND = { minPct: 22, maxPct: 28 } as const;
export const SKELETON_RAGE_PER_STACK = 0.03;
export const SKELETON_RAGE_MAX_STACKS = 25;
/** Wiki SP3 average mult over progressive rage (642.5 / 500). */
export const SKELETON_RAGE_AVG_MULT = 1.285;

export const ZOMBIE_FIRST_AUTO_TICKS = 7;
export const ZOMBIE_AUTO_INTERVAL = 6;
export const ZOMBIE_AUTO_BAND = { minPct: 18, maxPct: 22 } as const;
/** Poison aura — wiki first hit cast+9, every 3 ticks (poison uncrit). */
export const ZOMBIE_POISON_FIRST_TICKS = 9;
export const ZOMBIE_POISON_INTERVAL = 3;
export const ZOMBIE_POISON_BAND = { minPct: 8, maxPct: 12 } as const;
/** Poison can land a few ticks after the duration bar vanishes (wiki: +3 past until). */
export const ZOMBIE_POISON_TAIL_TICKS = 3;

export const GHOST_FIRST_AUTO_TICKS = 6;
export const GHOST_AUTO_INTERVAL = 7;
export const GHOST_AUTO_BAND = { minPct: 18, maxPct: 22 } as const;

/** Default Undead Army selection when customisation is not modelled. */
export const UNDEAD_ARMY_DEFAULT: readonly ConjureId[] = [
  "skeleton_warrior",
  "vengeful_ghost",
  "putrid_zombie",
];

/** Ability id → spirits summoned. */
export const CONJURE_ABILITY_SUMMONS: Readonly<Record<string, readonly ConjureId[]>> = {
  conjure_skeleton_warrior: ["skeleton_warrior"],
  conjure_vengeful_ghost: ["vengeful_ghost"],
  conjure_putrid_zombie: ["putrid_zombie"],
  conjure_phantom_guardian: ["phantom_guardian"],
  conjure_undead_army: UNDEAD_ARMY_DEFAULT,
};

/** Command ability → required active spirit. */
export const COMMAND_REQUIRES_CONJURE: Readonly<Record<string, ConjureId>> = {
  command_skeleton_warrior: "skeleton_warrior",
  command_putrid_zombie: "putrid_zombie",
  command_phantom_guardian: "phantom_guardian",
};

/** PerAbility / damage ledger ids for spirit autos (not bar abilities). */
export const SPIRIT_AUTO_ABILITY_ID: Readonly<Record<ConjureId, string>> = {
  skeleton_warrior: "spirit_skeleton_warrior",
  vengeful_ghost: "spirit_vengeful_ghost",
  putrid_zombie: "spirit_putrid_zombie",
  phantom_guardian: "spirit_phantom_guardian",
};

export const SPIRIT_POISON_ABILITY_ID = "spirit_putrid_zombie_poison";

/**
 * Wiki (verified 2026-07-31): "Conjured spirits and their command abilities
 * always deal 100% of their damage potential, even when the player does not
 * have 100% hit chance against the target." Conjure damage therefore never
 * uses the player's Damage Potential fraction.
 */
export const CONJURE_DAMAGE_POTENTIAL = 1;

/**
 * Conjure-eligible global modifiers. Wiki (verified 2026-07-31): conjure damage
 * is increased by Eruptive and Equilibrium (via base ability damage),
 * Vulnerability, and set effects, but is NOT boosted by the player's prayers.
 * Command abilities and Putrid poison follow the same rule (poison also takes
 * Vulnerability).
 */
export function conjureEligibleModifiers<T extends { id: string }>(mods: readonly T[]): T[] {
  return mods.filter((m) => !m.id.startsWith("prayer:"));
}

/** Command Skeleton Warrior scheduling (wiki tick table, verified 2026-07-31). */
/** RAAAR lands 1 tick after activation; a normal auto due on that tick still fires. */
export const COMMAND_SKELETON_RAAAR_DELAY_TICKS = 1;
/** Command hits land at activation+2 .. activation+11; normal autos resume 2 ticks later. */
export const COMMAND_SKELETON_FIRST_HIT_OFFSET = 2;
export const COMMAND_SKELETON_LAST_HIT_OFFSET = 11;
export const COMMAND_SKELETON_RESUME_DELAY_TICKS = 2;
/** Initial lockout after conjuring (wiki: "initial 3.6 second cooldown"). */
export const COMMAND_SKELETON_INITIAL_COOLDOWN_TICKS = 6;
/** Command hits keep landing up to 2 ticks past the skeleton's expiry. */
export const COMMAND_SKELETON_EXPIRY_TAIL_TICKS = 2;

/**
 * One scheduled track: the tick its next event lands on. A spirit only carries
 * the tracks it actually has, so a phantom cannot hold an auto tick and nothing
 * but the zombie can hold a poison tick.
 */
export interface SpiritTrack {
  readonly nextTick: number;
}

interface ActiveConjureBase {
  /** Exclusive end tick (active while tick < untilTick). SP3 → ready + 105. */
  readonly untilTick: number;
}

export interface ActiveSkeletonWarrior extends ActiveConjureBase {
  readonly id: "skeleton_warrior";
  readonly auto: SpiritTrack;
  /** Rage: +3% per landed attack, capped at 25 stacks; 0 on summon. */
  readonly rageStacks: number;
  /**
   * Set when a command let a pending auto fire on/before its RAAAR tick: that
   * auto's successor lands here (command end + 2) instead of on the plain
   * cadence. Cleared when consumed.
   */
  readonly commandResumeTick?: number;
}

export interface ActiveVengefulGhost extends ActiveConjureBase {
  readonly id: "vengeful_ghost";
  readonly auto: SpiritTrack;
}

export interface ActivePutridZombie extends ActiveConjureBase {
  readonly id: "putrid_zombie";
  readonly auto: SpiritTrack;
  /** The poison aura. No other spirit has one. */
  readonly poison: SpiritTrack;
}

export interface ActivePhantomGuardian extends ActiveConjureBase {
  readonly id: "phantom_guardian";
  // No auto and no poison: the phantom only acts when commanded, and its Valour
  // scale is ability data rather than simulated state.
}

/**
 * An active conjured spirit, modelled by what it can actually do. Adding a
 * capability to one spirit cannot silently give it to the others.
 */
export type ActiveConjure =
  ActiveSkeletonWarrior | ActiveVengefulGhost | ActivePutridZombie | ActivePhantomGuardian;

/** Narrowed to the one variant that id names. */
export type ConjureOf<Id extends ConjureId> = Extract<ActiveConjure, { id: Id }>;

export interface ConjureState {
  readonly spirits: readonly ActiveConjure[];
}

export const newConjures = (): ConjureState => ({ spirits: [] });

export function conjureActive(state: ConjureState, id: ConjureId, tick = 0): boolean {
  return state.spirits.some((s) => s.id === id && tick < s.untilTick);
}

/** The active spirit with this id, narrowed to its own variant. */
export function findConjure<Id extends ConjureId>(
  state: ConjureState,
  id: Id,
): ConjureOf<Id> | undefined {
  return state.spirits.find((s): s is ConjureOf<Id> => s.id === id);
}

/** Spirits that attack on their own. The phantom is absent by construction. */
export type AutoAttackingConjure = ActiveSkeletonWarrior | ActiveVengefulGhost | ActivePutridZombie;

export function hasAutoTrack(s: ActiveConjure): s is AutoAttackingConjure {
  return s.id !== "phantom_guardian";
}

export interface SpiritAutoProfile {
  first: number;
  interval: number;
  band: DamageBand;
}

/** Auto cadence and band, or null for a spirit that never attacks unprompted. */
export function spiritAutoProfile(id: ConjureId): SpiritAutoProfile | null {
  switch (id) {
    case "skeleton_warrior":
      return {
        first: SKELETON_FIRST_AUTO_TICKS,
        interval: SKELETON_AUTO_INTERVAL,
        band: SKELETON_AUTO_BAND,
      };
    case "putrid_zombie":
      return {
        first: ZOMBIE_FIRST_AUTO_TICKS,
        interval: ZOMBIE_AUTO_INTERVAL,
        band: ZOMBIE_AUTO_BAND,
      };
    case "vengeful_ghost":
      return {
        first: GHOST_FIRST_AUTO_TICKS,
        interval: GHOST_AUTO_INTERVAL,
        band: GHOST_AUTO_BAND,
      };
    case "phantom_guardian":
      return null;
  }
}

/** Build the summoned spirit with exactly the tracks its kind has. */
function newActiveConjure(id: ConjureId, readyTick: number, durationMult = 1): ActiveConjure {
  const untilTick =
    readyTick + CONJURE_ANIM_TICKS + Math.floor(SPIRIT_PACT_III_DURATION_TICKS * durationMult);
  switch (id) {
    case "skeleton_warrior":
      return {
        id,
        untilTick,
        auto: { nextTick: readyTick + SKELETON_FIRST_AUTO_TICKS },
        rageStacks: 0,
      };
    case "vengeful_ghost":
      return { id, untilTick, auto: { nextTick: readyTick + GHOST_FIRST_AUTO_TICKS } };
    case "putrid_zombie":
      return {
        id,
        untilTick,
        auto: { nextTick: readyTick + ZOMBIE_FIRST_AUTO_TICKS },
        poison: { nextTick: readyTick + ZOMBIE_POISON_FIRST_TICKS },
      };
    case "phantom_guardian":
      return { id, untilTick };
  }
}

export function summonConjure(
  state: ConjureState,
  id: ConjureId,
  readyTick: number,
  durationMult = 1,
): ConjureState {
  const others = state.spirits.filter((s) => s.id !== id);
  return { spirits: [...others, newActiveConjure(id, readyTick, durationMult)] };
}

/** Summon every id not already active (army partial-cast behaviour). */
export function summonConjures(
  state: ConjureState,
  ids: readonly ConjureId[],
  readyTick: number,
  durationMult = 1,
): ConjureState {
  let next = state;
  for (const id of ids) {
    if (!conjureActive(next, id, readyTick)) {
      next = summonConjure(next, id, readyTick, durationMult);
    }
  }
  return next;
}

export function dismissConjure(state: ConjureState, id: ConjureId): ConjureState {
  return { spirits: state.spirits.filter((s) => s.id !== id) };
}

export function skeletonRageMult(stacks: number): number {
  const s = Math.max(0, Math.min(stacks, SKELETON_RAGE_MAX_STACKS));
  return 1 + SKELETON_RAGE_PER_STACK * s;
}

/**
 * Track state lives on the spirit; the rotation event queue holds one scheduled
 * event per track and these helpers advance to the next. Autos never schedule
 * past untilTick; zombie poison lands a short sourced tail past it.
 */

/** The auto track has another attack to schedule. A phantom never does. */
export function spiritAutoPending(s: ActiveConjure): boolean {
  return hasAutoTrack(s) && s.auto.nextTick < s.untilTick;
}

/** The zombie poison track has another hit to schedule (tail may pass untilTick). */
export function spiritPoisonPending(s: ActiveConjure): s is ActivePutridZombie {
  return s.id === "putrid_zombie" && s.poison.nextTick <= s.untilTick + ZOMBIE_POISON_TAIL_TICKS;
}

/** Next scheduled tick of a track, for the scheduler's horizon check. */
export function spiritAutoTick(s: AutoAttackingConjure): number {
  return s.auto.nextTick;
}

/** Advance the auto track after a landed auto: next tick, plus skeleton rage. */
export function spiritAutoFired(s: ActiveConjure): ActiveConjure {
  if (!hasAutoTrack(s)) return s;
  const profile = spiritAutoProfile(s.id)!;
  if (s.id === "skeleton_warrior") {
    // A command that let a pending auto fire redirects only that auto's
    // successor; the redirect is consumed here.
    const { commandResumeTick, ...base } = s;
    return {
      ...base,
      auto: { nextTick: commandResumeTick ?? s.auto.nextTick + profile.interval },
      rageStacks: Math.min(SKELETON_RAGE_MAX_STACKS, s.rageStacks + 1),
    };
  }
  return { ...s, auto: { nextTick: s.auto.nextTick + profile.interval } };
}

/** Advance the poison track after a landed poison hit. Zombie only, by type. */
export function spiritPoisonFired(s: ActivePutridZombie): ActivePutridZombie {
  return { ...s, poison: { nextTick: s.poison.nextTick + ZOMBIE_POISON_INTERVAL } };
}

/** One landed command hit builds one rage stack (its damage resolved first). */
export function skeletonCommandHitLanded(s: ActiveSkeletonWarrior): ActiveSkeletonWarrior {
  return { ...s, rageStacks: Math.min(SKELETON_RAGE_MAX_STACKS, s.rageStacks + 1) };
}

/** Summon from a conjure_* ability id; army uses UNDEAD_ARMY_DEFAULT. */
export function applyConjureCast(
  state: ConjureState,
  abilityId: string,
  readyTick: number,
  durationMult = 1,
): ConjureState {
  const ids = CONJURE_ABILITY_SUMMONS[abilityId];
  if (!ids) return state;
  return summonConjures(state, ids, readyTick, durationMult);
}

/**
 * Whether a necro ability can cast given conjure presence.
 * Commands need the spirit; conjure_* needs the spirit absent (army: any missing).
 */
export function conjureCanCast(abilityId: string, state: ConjureState, tick: number): boolean {
  const required = COMMAND_REQUIRES_CONJURE[abilityId];
  if (required) return conjureActive(state, required, tick);

  const summons = CONJURE_ABILITY_SUMMONS[abilityId];
  if (summons) {
    // Individual conjure: only when that spirit is down.
    if (summons.length === 1) return !conjureActive(state, summons[0]!, tick);
    // Army: at least one selected spirit missing.
    return summons.some((id) => !conjureActive(state, id, tick));
  }
  return true;
}

export const CONJURE_SOURCE: SourceReference = NECROSIS_WIKI;
