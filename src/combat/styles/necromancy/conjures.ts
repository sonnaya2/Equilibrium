import type { DamageBand } from "../../core/abilityDamage";
import type { SourceReference } from "../../types";
import { NECROSIS_WIKI } from "../../data/sources";

/**
 * Conjures (Spirit Pact III endgame default). Spirits cannot crit.
 *
 * Duration (wiki Skeleton / Zombie / Ghost hit timings, SP3):
 *   5-tick conjure anim + 100-tick lifetime → exclusive end at cast+105.
 * Skeleton: first hit cast+7, every 5 ticks; last hit cast+102.
 * Zombie: first hit cast+7, every 6 ticks; last auto cast+103.
 * Ghost: first hit cast+6, every 7 ticks; last hit cast+104.
 * Phantom Guardian: no auto (defensive only) — command is the damage.
 *
 * Skeleton rage: +3% damage per stack after each attack, max 25 (1.75×).
 * Progressive stacks over SP3 life avg mult ≈ 1.285 (wiki 642.5% / 500%).
 *
 * Army default set: skeleton + ghost + zombie (PvME priority Ghost>Skeleton>
 * Zombie>Phantom; phantom is opt-in, not in the default three).
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

export interface SpiritAutoEvent {
  tick: number;
  abilityId: string;
  band: DamageBand;
  /** Damage mult (skeleton rage). Applied to EV at roll time. */
  mult: number;
  critEligible: false;
}

export const newConjures = (): ConjureState => ({ spirits: [] });

export function conjureActive(state: ConjureState, id: ConjureId, tick = 0): boolean {
  return state.spirits.some((s) => s.id === id && tick < s.untilTick);
}

function autoProfile(id: ConjureId): {
  first: number;
  interval: number;
  band: DamageBand;
  poison?: { first: number; interval: number };
} | null {
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
  const profile = autoProfile(id);
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

/** True while the spirit still contributes (alive, or zombie poison tail pending). */
export function spiritStillPresent(s: ActiveConjure, tick: number): boolean {
  if (tick < s.untilTick) return true;
  if (s.id === "putrid_zombie" && s.nextPoisonTick > 0) {
    return s.nextPoisonTick <= s.untilTick + ZOMBIE_POISON_TAIL_TICKS;
  }
  return false;
}

/** Drop fully expired spirits (past untilTick and any poison tail). */
export function expireConjures(state: ConjureState, tick: number): ConjureState {
  const spirits = state.spirits.filter((s) => spiritStillPresent(s, tick));
  return spirits.length === state.spirits.length ? state : { spirits };
}

export function skeletonRageMult(stacks: number): number {
  const s = Math.max(0, Math.min(stacks, SKELETON_RAGE_MAX_STACKS));
  return 1 + SKELETON_RAGE_PER_STACK * s;
}

/**
 * Land spirit autos with nextAutoTick / nextPoisonTick in (fromTick, toTick].
 * Gains skeleton rage after each auto. Spirits expire once past untilTick
 * (zombie poison may land a short tail past until).
 */
export function processSpiritAutos(
  stateIn: ConjureState,
  fromTick: number,
  toTick: number,
): { state: ConjureState; events: SpiritAutoEvent[] } {
  if (toTick <= fromTick) return { state: stateIn, events: [] };

  const events: SpiritAutoEvent[] = [];
  const nextSpirits: ActiveConjure[] = [];

  for (const raw of stateIn.spirits) {
    let s = { ...raw };
    const profile = autoProfile(s.id);

    if (profile) {
      while (
        s.nextAutoTick > fromTick &&
        s.nextAutoTick <= toTick &&
        s.nextAutoTick < s.untilTick
      ) {
        const mult = s.id === "skeleton_warrior" ? skeletonRageMult(s.rageStacks) : 1;
        events.push({
          tick: s.nextAutoTick,
          abilityId: SPIRIT_AUTO_ABILITY_ID[s.id],
          band: { minPct: profile.band.minPct, maxPct: profile.band.maxPct },
          mult,
          critEligible: false,
        });
        s = {
          ...s,
          nextAutoTick: s.nextAutoTick + profile.interval,
          rageStacks:
            s.id === "skeleton_warrior"
              ? Math.min(SKELETON_RAGE_MAX_STACKS, s.rageStacks + 1)
              : s.rageStacks,
        };
      }
    }

    if (s.id === "putrid_zombie" && s.nextPoisonTick > 0) {
      const poisonEnd = s.untilTick + ZOMBIE_POISON_TAIL_TICKS;
      while (
        s.nextPoisonTick > fromTick &&
        s.nextPoisonTick <= toTick &&
        s.nextPoisonTick <= poisonEnd
      ) {
        events.push({
          tick: s.nextPoisonTick,
          abilityId: SPIRIT_POISON_ABILITY_ID,
          band: { minPct: ZOMBIE_POISON_BAND.minPct, maxPct: ZOMBIE_POISON_BAND.maxPct },
          mult: 1,
          critEligible: false,
        });
        s = { ...s, nextPoisonTick: s.nextPoisonTick + ZOMBIE_POISON_INTERVAL };
      }
    }

    if (spiritStillPresent(s, toTick)) nextSpirits.push(s);
  }

  return { state: { spirits: nextSpirits }, events };
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
