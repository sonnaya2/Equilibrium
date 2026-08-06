import type { SourceReference } from "../types";
import { secondsToTicks } from "../core/ticks";
import { applyPlayerHeal, type PlayerVitality } from "../core/playerVitality";

/**
 * Naragi Edict (Equilibrium T7 relic) + Sliver of Edicts.
 * https://runescape.wiki/w/Naragi_Edict
 *
 * Passive face stats live on the equipment record (armour/damage/life/prayer).
 * Activation is engine timeline: CD, duration, heal pulses, level override, one revive.
 */

export const NARAGI_EDICT_RELIC = "Naragi Edict";
export const SLIVER_OF_EDICTS_ID = "item:sliver-of-edicts";
/** Cooldown / activation key in RotationState.cooldowns. */
export const SLIVER_OF_EDICTS_ACTIVATE_ID = "sliver_of_edicts_activate";

export const NARAGI_EDICT_SOURCE: SourceReference = {
  source: "runescape-wiki",
  url: "https://runescape.wiki/w/Naragi_Edict",
  title: "Naragi Edict",
  verifiedAt: "2026-08-04",
};

/** Face passive bonuses (must match equipment record). */
export const SLIVER_PASSIVE = {
  armour: 300,
  styleDamage: 14,
  life: 1500,
  prayer: 15,
} as const;

export const NARAGI_ACTIVE_DURATION_SECONDS = 16.8;
export const NARAGI_COOLDOWN_SECONDS = 90;
export const NARAGI_HEAL_INTERVAL_SECONDS = 4.2;
export const NARAGI_HEAL_COUNT = 4;
export const NARAGI_HEAL_AMOUNT = 10_000;
export const NARAGI_LEVEL_OVERRIDE = 255;
export const NARAGI_REVIVAL_CHARGES = 1;

export const NARAGI_ACTIVE_DURATION_TICKS = secondsToTicks(NARAGI_ACTIVE_DURATION_SECONDS);
export const NARAGI_COOLDOWN_TICKS = secondsToTicks(NARAGI_COOLDOWN_SECONDS);
export const NARAGI_HEAL_INTERVAL_TICKS = secondsToTicks(NARAGI_HEAL_INTERVAL_SECONDS);

/** Heal land offsets from activation tick (inclusive of final pulse at duration). */
export function naragiHealOffsetsTicks(): readonly number[] {
  const out: number[] = [];
  for (let i = 1; i <= NARAGI_HEAL_COUNT; i++) {
    out.push(i * NARAGI_HEAL_INTERVAL_TICKS);
  }
  return out;
}

export function naragiEdictActive(
  relics: readonly string[] | ReadonlySet<string> | undefined,
): boolean {
  if (!relics) return false;
  for (const name of relics) {
    if (name === NARAGI_EDICT_RELIC) return true;
  }
  return false;
}

export function isSliverOfEdictsWorn(equipmentIds: readonly string[] | undefined): boolean {
  return equipmentIds?.includes(SLIVER_OF_EDICTS_ID) === true;
}

export type NaragiActivationFailReason =
  "relic-inactive" | "sliver-unequipped" | "already-active" | "on-cooldown";

export interface NaragiActivationGate {
  ok: boolean;
  reason: NaragiActivationFailReason | null;
}

/**
 * Half-open active window: level override + revival while tick < activeUntilTick.
 * Final heal is scheduled at activationTick + durationTicks (boundary after last open tick).
 */
export interface NaragiRuntimeState {
  /** Exclusive end tick for override + revive (half-open). 0 = inactive. */
  activeUntilTick: number;
  /** Tick when activation began; 0 when never activated this run. */
  activatedAtTick: number;
  /** Remaining revive charges while the window is open. */
  revivalCharges: number;
}

export const newNaragiRuntime = (): NaragiRuntimeState => ({
  activeUntilTick: 0,
  activatedAtTick: 0,
  revivalCharges: 0,
});

export function naragiWindowActive(state: NaragiRuntimeState, tick: number): boolean {
  return state.activeUntilTick > 0 && tick < state.activeUntilTick;
}

export function naragiActivationGate(opts: {
  relicActive: boolean;
  sliverWorn: boolean;
  runtime: NaragiRuntimeState;
  cooldowns: Readonly<Record<string, number>>;
  tick: number;
}): NaragiActivationGate {
  if (!opts.relicActive) return { ok: false, reason: "relic-inactive" };
  if (!opts.sliverWorn) return { ok: false, reason: "sliver-unequipped" };
  if (naragiWindowActive(opts.runtime, opts.tick)) {
    return { ok: false, reason: "already-active" };
  }
  const readyAt = opts.cooldowns[SLIVER_OF_EDICTS_ACTIVATE_ID] ?? 0;
  if (opts.tick < readyAt) return { ok: false, reason: "on-cooldown" };
  return { ok: true, reason: null };
}

export function naragiActivationFailNote(reason: NaragiActivationFailReason | null): string {
  switch (reason) {
    case "relic-inactive":
      return "Naragi Edict not selected";
    case "sliver-unequipped":
      return "Sliver of Edicts not equipped (pocket)";
    case "already-active":
      return "Sliver activation already running";
    case "on-cooldown":
      return "Sliver activation on cooldown";
    default:
      return "Sliver activation ready";
  }
}

/**
 * Begin activation at tick t0. Caller schedules heals and writes cooldowns.
 * activeUntilTick = t0 + duration (half-open); final heal at that same absolute tick.
 */
export function beginNaragiActivation(
  runtime: NaragiRuntimeState,
  activationTick: number,
): NaragiRuntimeState {
  return {
    activeUntilTick: activationTick + NARAGI_ACTIVE_DURATION_TICKS,
    activatedAtTick: activationTick,
    revivalCharges: NARAGI_REVIVAL_CHARGES,
  };
}

export function expireNaragiActivation(runtime: NaragiRuntimeState): NaragiRuntimeState {
  if (runtime.activeUntilTick === 0 && runtime.revivalCharges === 0) return runtime;
  return {
    activeUntilTick: 0,
    activatedAtTick: runtime.activatedAtTick,
    revivalCharges: 0,
  };
}

/** Invalidate active effects (unequip / relic drop). Cooldown is left to the caller. */
export function invalidateNaragiActivation(runtime: NaragiRuntimeState): NaragiRuntimeState {
  return expireNaragiActivation(runtime);
}

export function consumeNaragiRevival(
  runtime: NaragiRuntimeState,
  tick: number,
): { consumed: boolean; runtime: NaragiRuntimeState } {
  if (!naragiWindowActive(runtime, tick) || runtime.revivalCharges <= 0) {
    return { consumed: false, runtime };
  }
  return {
    consumed: true,
    runtime: { ...runtime, revivalCharges: runtime.revivalCharges - 1 },
  };
}

export function applyNaragiHealPulse(
  vitality: PlayerVitality,
  amount: number = NARAGI_HEAL_AMOUNT,
): ReturnType<typeof applyPlayerHeal> {
  return applyPlayerHeal(vitality, amount);
}

export function naragiCooldownReadyTick(activationTick: number): number {
  return activationTick + NARAGI_COOLDOWN_TICKS;
}

export function naragiLevelOverrideActive(runtime: NaragiRuntimeState, tick: number): boolean {
  return naragiWindowActive(runtime, tick);
}

export function naragiEffectiveLevelOverride(
  runtime: NaragiRuntimeState,
  tick: number,
): number | null {
  return naragiLevelOverrideActive(runtime, tick) ? NARAGI_LEVEL_OVERRIDE : null;
}
