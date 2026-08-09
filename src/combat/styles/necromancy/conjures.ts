import type { DamageBand } from "../../core/abilityDamage";
import type { SourceReference } from "../../types";
import { NECROSIS_WIKI } from "../../data/sources";

/**
 * Spirit Pact III: 5-tick anim + 100-tick lifetime -> exclusive end cast+105.
 * Autos: Skeleton +7/5, Zombie +7/6, Ghost +6/7. Rage +3%/attack to 25 stacks.
 * Phantom no auto; default army Skeleton+Ghost+Zombie. Spirit attacks cannot crit.
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
/** Poison aura - wiki first hit cast+9, every 3 ticks (poison uncrit). */
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
  command_vengeful_ghost: "vengeful_ghost",
};

/**
 * In-game revo: conjure bar slot morphs to Command while that spirit is active.
 * Bars store conjure_* only; army has no single command so try actives in order
 * (skeleton preferred). Putrid is omitted from army morph: explode dismisses the
 * zombie and would re-open army re-summon every GCD under revo priority.
 */
export const REVO_CONJURE_COMMAND_MORPH: Readonly<Record<string, readonly string[]>> = {
  conjure_skeleton_warrior: ["command_skeleton_warrior"],
  conjure_vengeful_ghost: ["command_vengeful_ghost"],
  conjure_putrid_zombie: ["command_putrid_zombie"],
  conjure_phantom_guardian: ["command_phantom_guardian"],
  conjure_undead_army: ["command_skeleton_warrior", "command_vengeful_ghost"],
};

/** Initial lockout after conjuring ghost (wiki: command first available tick 6). */
export const COMMAND_GHOST_INITIAL_COOLDOWN_TICKS = 6;
/** Initial lockout after conjuring zombie (wiki: command first available tick 6). */
export const COMMAND_ZOMBIE_INITIAL_COOLDOWN_TICKS = 6;
/** Wiki: chat at command+3; poison still lands on that tick. */
export const COMMAND_PUTRID_CHAT_DELAY_TICKS = 3;
/** Wiki: explode + dismiss at command+4 (ability tickOffset). */
export const COMMAND_PUTRID_EXPLODE_DELAY_TICKS = 4;

/** PerAbility / damage ledger ids for spirit autos (not bar abilities). */
export const SPIRIT_AUTO_ABILITY_ID: Readonly<Record<ConjureId, string>> = {
  skeleton_warrior: "spirit_skeleton_warrior",
  vengeful_ghost: "spirit_vengeful_ghost",
  putrid_zombie: "spirit_putrid_zombie",
  phantom_guardian: "spirit_phantom_guardian",
};

export const VENGEFUL_GHOST_HEAL_FRACTION = 1.4;

/** Ghost heals for 140% of final damage dealt by each basic attack. */
export function vengefulGhostExpectedHeal(finalDamageDealt: number): number {
  if (!Number.isFinite(finalDamageDealt) || finalDamageDealt <= 0) return 0;
  return Math.floor(finalDamageDealt * VENGEFUL_GHOST_HEAL_FRACTION);
}

export const SPIRIT_POISON_ABILITY_ID = "spirit_putrid_zombie_poison";

/**
 * Wiki (2026-07-31): conjures and commands always deal 100% damage potential
 * (ignore player hit chance). Never use the player's Damage Potential fraction.
 */
export const CONJURE_DAMAGE_POTENTIAL = 1;

/**
 * Conjure-eligible globals (wiki 2026-07-31): Eruptive, Equilibrium, Vulnerability,
 * set effects; not player prayers. Commands and Putrid poison follow the same rule.
 */
export function conjureEligibleModifiers<T extends { id: string }>(mods: readonly T[]): T[] {
  return mods.filter((m) => !m.id.startsWith("prayer:"));
}

/** Command Skeleton (wiki tick table, 2026-07-31): RAAAR at activation+1; auto due that tick still fires. */
export const COMMAND_SKELETON_RAAAR_DELAY_TICKS = 1;
/** Command hits land at activation+2 .. activation+11; normal autos resume 2 ticks later. */
export const COMMAND_SKELETON_FIRST_HIT_OFFSET = 2;
export const COMMAND_SKELETON_LAST_HIT_OFFSET = 11;
export const COMMAND_SKELETON_RESUME_DELAY_TICKS = 2;
/** Initial lockout after conjuring (wiki: "initial 3.6 second cooldown"). */
export const COMMAND_SKELETON_INITIAL_COOLDOWN_TICKS = 6;
/** Command hits keep landing up to 2 ticks past the skeleton's expiry. */
export const COMMAND_SKELETON_EXPIRY_TAIL_TICKS = 2;

/** One scheduled track: tick of next event. Variant only carries tracks it has. */
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
  /** When command let pending auto fire on/before RAAAR: successor lands here (command end + 2). Cleared when consumed. */
  readonly commandResumeTick?: number;
}

export interface ActiveVengefulGhost extends ActiveConjureBase {
  readonly id: "vengeful_ghost";
  readonly auto: SpiritTrack;
  /** Command Vengeful Ghost active: autos apply Haunted for remainder of life. */
  readonly commanding?: boolean;
}

export interface ActivePutridZombie extends ActiveConjureBase {
  readonly id: "putrid_zombie";
  readonly auto: SpiritTrack;
  /** The poison aura. No other spirit has one. */
  readonly poison: SpiritTrack;
  /**
   * After Command: last poison-eligible tick (chat = command+3).
   * https://runescape.wiki/w/Command_Putrid_Zombie
   */
  readonly poisonThroughTick?: number;
  /**
   * After Command: explode land tick (command+4). Spirit stays until then.
   * https://runescape.wiki/w/Command_Putrid_Zombie
   */
  readonly explodeAtTick?: number;
}

export interface ActivePhantomGuardian extends ActiveConjureBase {
  readonly id: "phantom_guardian";
  // No auto/poison: acts only on command; Valour is ability data, not sim state.
}

/** Active spirit variant by capability (phantom has no auto/poison tracks). */
export type ActiveConjure =
  ActiveSkeletonWarrior | ActiveVengefulGhost | ActivePutridZombie | ActivePhantomGuardian;

/** Narrowed to the one variant that id names. */
export type ConjureOf<Id extends ConjureId> = Extract<ActiveConjure, { id: Id }>;

export interface ConjureState {
  readonly spirits: readonly ActiveConjure[];
}

export const newConjures = (): ConjureState => ({ spirits: [] });

export function conjureActive(state: ConjureState, id: ConjureId, tick = 0): boolean {
  return state.spirits.some((s) => {
    if (s.id !== id) return false;
    if (tick < s.untilTick) return true;
    // Commanded putrid occupies the slot until explode lands (buff bar still up).
    return (
      s.id === "putrid_zombie" &&
      s.explodeAtTick !== undefined &&
      tick < s.explodeAtTick
    );
  });
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
 * Track advance helpers: one queued event per track. Autos never past untilTick;
 * zombie poison may land a short sourced tail past it.
 */

/** The auto track has another attack to schedule. A phantom never does. */
export function spiritAutoPending(s: ActiveConjure): boolean {
  if (!hasAutoTrack(s) || s.auto.nextTick >= s.untilTick) return false;
  // Command Putrid: autos after the command cast tick are suppressed (same-tick ok).
  if (s.id === "putrid_zombie" && s.explodeAtTick !== undefined) {
    const commandTick = s.explodeAtTick - COMMAND_PUTRID_EXPLODE_DELAY_TICKS;
    if (s.auto.nextTick > commandTick) return false;
  }
  return true;
}

/** Natural poison bound (SP3 tail past untilTick). Command caps this further. */
export function spiritPoisonBound(s: ActivePutridZombie): number {
  const natural = s.untilTick + ZOMBIE_POISON_TAIL_TICKS;
  return s.poisonThroughTick === undefined ? natural : Math.min(natural, s.poisonThroughTick);
}

/** The zombie poison track has another hit to schedule (tail may pass untilTick). */
export function spiritPoisonPending(s: ActiveConjure): s is ActivePutridZombie {
  return s.id === "putrid_zombie" && s.poison.nextTick <= spiritPoisonBound(s);
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

/** Command Vengeful Ghost: empower remaining autos to apply Haunted. */
export function applyGhostCommand(state: ConjureState): ConjureState {
  const ghost = findConjure(state, "vengeful_ghost");
  if (!ghost) return state;
  return {
    spirits: state.spirits.map((s) => (s.id === "vengeful_ghost" ? { ...s, commanding: true } : s)),
  };
}

/**
 * Command Putrid Zombie state: poison through chat (command+3), explode at +4.
 * Does not dismiss; scheduler suppresses post-command autos and caps poison.
 * https://runescape.wiki/w/Command_Putrid_Zombie
 */
export function applyPutridCommandState(state: ConjureState, commandTick: number): ConjureState {
  const zombie = findConjure(state, "putrid_zombie");
  if (!zombie || zombie.explodeAtTick !== undefined) return state;
  const next: ActivePutridZombie = {
    ...zombie,
    poisonThroughTick: commandTick + COMMAND_PUTRID_CHAT_DELAY_TICKS,
    explodeAtTick: commandTick + COMMAND_PUTRID_EXPLODE_DELAY_TICKS,
  };
  // Park auto if next land is after command (same-tick auto still pending-eligible).
  if (next.auto.nextTick > commandTick) {
    return {
      spirits: state.spirits.map((s) =>
        s.id === "putrid_zombie" ? { ...next, auto: { nextTick: next.untilTick } } : s,
      ),
    };
  }
  return {
    spirits: state.spirits.map((s) => (s.id === "putrid_zombie" ? next : s)),
  };
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

/** Cast gate: commands need spirit present; conjure_* needs it absent (army: any missing). */
export function conjureCanCast(abilityId: string, state: ConjureState, tick: number): boolean {
  const required = COMMAND_REQUIRES_CONJURE[abilityId];
  if (required) {
    if (!conjureActive(state, required, tick)) return false;
    // Ghost command is 0s wiki CD but lasts the spirit lifetime; re-cast is a no-op.
    // Without this, army morph revo picks ghost every GCD after skeleton is on CD.
    if (abilityId === "command_vengeful_ghost") {
      const ghost = findConjure(state, "vengeful_ghost");
      if (ghost?.commanding) return false;
    }
    // Putrid explode is one-shot; re-command while waiting for C+4 is a no-op.
    if (abilityId === "command_putrid_zombie") {
      const zombie = findConjure(state, "putrid_zombie");
      if (zombie?.explodeAtTick !== undefined) return false;
    }
    return true;
  }

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
