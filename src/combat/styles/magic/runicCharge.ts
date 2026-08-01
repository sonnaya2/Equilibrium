import { secondsToTicks } from "../../rotation/timing";
import { MODERNISATION_WIKI, RUNIC_CHARGE_WIKI } from "../../data/sources";
import type { SourceReference } from "../../types";

/**
 * Runic Charge (added 2 Mar 2026): level 26 Utility, 0% adrenaline, off-GCD,
 * 30s cooldown; applies Anima Charged for 15s. The next empowered cast consumes
 * the window. Empowerments per the wiki page; the Concentrated Blast crit grant
 * uses the current Critical strike page's values. The CSM table still lists +20%.
 */
export const RUNIC_CHARGE_COOLDOWN_SECONDS = 30;
export const ANIMA_CHARGED_DURATION_SECONDS = 15;

export const RUNIC_EMPOWERMENTS = {
  sonic_wave: { nextAbilityCostReductionPct: 35, greaterNextAbilityCostReductionPct: 45 },
  dragon_breath: { band: { minPct: 260, maxPct: 310 } },
  concentrated_blast: { critChanceGrantPct: 15, greaterCritChanceGrantPct: 17 },
} as const;

export interface RunicChargeState {
  /** Tick the cooldown lifts; 0 = ready. */
  cooldownUntilTick: number;
  /** Tick the Anima Charged window closes; 0 = no charge held. */
  animaUntilTick: number;
}

export const newRunicCharge = (): RunicChargeState => ({ cooldownUntilTick: 0, animaUntilTick: 0 });

export function runicChargeReady(state: RunicChargeState, tick: number): boolean {
  return tick >= state.cooldownUntilTick;
}

export function animaCharged(state: RunicChargeState, tick: number): boolean {
  return state.animaUntilTick > 0 && tick < state.animaUntilTick;
}

export function activateRunicCharge(state: RunicChargeState, tick: number): RunicChargeState {
  if (!runicChargeReady(state, tick)) return state;
  return {
    cooldownUntilTick: tick + secondsToTicks(RUNIC_CHARGE_COOLDOWN_SECONDS),
    animaUntilTick: tick + secondsToTicks(ANIMA_CHARGED_DURATION_SECONDS),
  };
}

/** One empowerment per charge — casting the empowered ability spends the window. */
export function consumeAnima(state: RunicChargeState): RunicChargeState {
  return { ...state, animaUntilTick: 0 };
}

export const RUNIC_CHARGE_SOURCE: SourceReference = RUNIC_CHARGE_WIKI;
export const RUNIC_CHARGE_CSM_SOURCE: SourceReference = MODERNISATION_WIKI;
