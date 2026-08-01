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

export interface ActiveConjure {
  readonly id: ConjureId;
  /** Exclusive end tick (active while tick < untilTick). SP3 → ready + 105. */
  readonly untilTick: number;
  /** Next auto-attack land tick. Phantom has no autos (nextAutoTick = untilTick). */
  readonly nextAutoTick: number;
  /** Skeleton rage stacks (applied after each auto; 0 on summon). */
  readonly rageStacks: number;
  /** Zombie poison next land tick; 0 = no poison track. */
  readonly nextPoisonTick: number;
}

export interface ConjureState {
  readonly spirits: readonly ActiveConjure[];
}

export const newConjures = (): ConjureState => ({ spirits: [] });

export function conjureActive(state: ConjureState, id: ConjureId, tick = 0): boolean {
  return state.spirits.some((s) => s.id === id && tick < s.untilTick);
}

export interface SpiritAutoProfile {
  first: number;
  interval: number;
  band: DamageBand;
  poison?: { first: number; interval: number };
}

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
        poison: { first: ZOMBIE_POISON_FIRST_TICKS, interval: ZOMBIE_POISON_INTERVAL },
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

export function summonConjure(state: ConjureState, id: ConjureId, readyTick: number): ConjureState {
  const untilTick = readyTick + CONJURE_UNTIL_OFFSET_TICKS;
  const profile = spiritAutoProfile(id);
  const nextAutoTick = profile ? readyTick + profile.first : untilTick;
  const nextPoisonTick = profile?.poison ? readyTick + profile.poison.first : 0;
  const spirit: ActiveConjure = {
    id,
    untilTick,
    nextAutoTick,
    rageStacks: 0,
    nextPoisonTick,
  };
  const others = state.spirits.filter((s) => s.id !== id);
  return { spirits: [...others, spirit] };
}

/** Summon every id not already active (army partial-cast behaviour). */
export function summonConjures(
  state: ConjureState,
  ids: readonly ConjureId[],
  readyTick: number,
): ConjureState {
  let next = state;
  for (const id of ids) {
    if (!conjureActive(next, id, readyTick)) next = summonConjure(next, id, readyTick);
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
 * Spirit scheduler state lives on ActiveConjure; the rotation event queue fires
 * one scheduled event per track and these helpers advance to the next. Autos
 * never schedule past untilTick; zombie poison lands a short sourced tail past it.
 */

/** The auto track has another attack to schedule (phantom: never). */
export function spiritAutoPending(s: ActiveConjure): boolean {
  return spiritAutoProfile(s.id) !== null && s.nextAutoTick < s.untilTick;
}

/** The zombie poison track has another hit to schedule (tail may pass untilTick). */
export function spiritPoisonPending(s: ActiveConjure): boolean {
  return (
    s.id === "putrid_zombie" &&
    s.nextPoisonTick > 0 &&
    s.nextPoisonTick <= s.untilTick + ZOMBIE_POISON_TAIL_TICKS
  );
}

/** Advance the auto track after a landed auto: next tick + skeleton rage. */
export function spiritAutoFired(s: ActiveConjure): ActiveConjure {
  const profile = spiritAutoProfile(s.id);
  if (!profile) return s;
  return {
    ...s,
    nextAutoTick: s.nextAutoTick + profile.interval,
    rageStacks:
      s.id === "skeleton_warrior"
        ? Math.min(SKELETON_RAGE_MAX_STACKS, s.rageStacks + 1)
        : s.rageStacks,
  };
}

/** Advance the poison track after a landed poison hit. */
export function spiritPoisonFired(s: ActiveConjure): ActiveConjure {
  return { ...s, nextPoisonTick: s.nextPoisonTick + ZOMBIE_POISON_INTERVAL };
}

/** Summon from a conjure_* ability id; army uses UNDEAD_ARMY_DEFAULT. */
export function applyConjureCast(
  state: ConjureState,
  abilityId: string,
  readyTick: number,
): ConjureState {
  const ids = CONJURE_ABILITY_SUMMONS[abilityId];
  if (!ids) return state;
  return summonConjures(state, ids, readyTick);
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
