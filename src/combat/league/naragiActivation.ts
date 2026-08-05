import { makeLevelOverride } from "../core/effectiveLevel";
import { applyPlayerHeal } from "../core/playerVitality";
import { NO_DAMAGE, type EventResolution } from "../engine/resolution/types";
import {
  makeDeathPrevention,
  applyPreventablePlayerDamage,
  clearDeathPrevention,
} from "../engine/runtime/deathPrevention";
import type { SimulationRuntime } from "../engine/runtime/runtime";
import { scheduleEvent } from "../engine/runtime/runtime";
import { patchPlayer, type RotationState } from "../engine/runtime/state";
import type { DamageProvenance } from "../shared/damageProvenance";
import { hasNaragiEdict } from "./ruleset";
import {
  beginNaragiActivation,
  expireNaragiActivation,
  invalidateNaragiActivation,
  naragiActivationFailNote,
  naragiActivationGate,
  naragiCooldownReadyTick,
  naragiHealOffsetsTicks,
  NARAGI_HEAL_AMOUNT,
  NARAGI_LEVEL_OVERRIDE,
  NARAGI_REVIVAL_CHARGES,
  SLIVER_OF_EDICTS_ACTIVATE_ID,
  SLIVER_OF_EDICTS_ID,
  type NaragiActivationFailReason,
  newNaragiRuntime,
} from "./naragiEdict";

const NARAGI_PROVENANCE: DamageProvenance = {
  kind: "equipment_proc",
  detail: "naragi_sliver",
};

/** Ability ids used on player-family events (analysis / timeline). */
export const NARAGI_EVENT = {
  activate: "naragi_sliver_activate",
  /** Scheduled auto re-fire at CD ready when activateNaragiAtStart is set. */
  reactivate: "naragi_sliver_reactivate",
  heal: "naragi_sliver_heal",
  expire: "naragi_sliver_expire",
  revive: "naragi_sliver_revive",
  fail: "naragi_sliver_fail",
} as const;

export interface NaragiActivateResult {
  ok: boolean;
  reason: NaragiActivationFailReason | null;
  note: string;
  activationTick: number;
  healTicks: readonly number[];
  cooldownReadyTick: number;
  activeUntilTick: number;
}

function ensurePlayer(state: RotationState, maxLp = 15_000): RotationState {
  if (state.player) return state;
  return patchPlayer(state, {
    vitality: { maximumLifePoints: maxLp, currentLifePoints: maxLp },
    dead: false,
    naragi: newNaragiRuntime(),
    naragiHealed: 0,
    naragiOverheal: 0,
  });
}

function playerHealResolve(healIndex: number): (rt: SimulationRuntime, landTick: number) => EventResolution {
  return (rt, landTick) => {
    const player = rt.state.player;
    if (!player || player.dead) return NO_DAMAGE;
    const result = applyPlayerHeal(player.vitality, NARAGI_HEAL_AMOUNT);
    rt.state = patchPlayer(rt.state, {
      vitality: result.vitality,
      naragiHealed: player.naragiHealed + result.healed,
      naragiOverheal: player.naragiOverheal + result.overheal,
    });
    if (result.healed > 0) rt.totalHealed += result.healed;
    // hitIndex carries heal pulse index for analysis
    void healIndex;
    void landTick;
    return NO_DAMAGE;
  };
}

function playerExpireResolve(rt: SimulationRuntime, _landTick: number): EventResolution {
  const player = rt.state.player;
  if (!player) return NO_DAMAGE;
  const naragi = expireNaragiActivation(player.naragi);
  let deathPrevention = player.deathPrevention;
  if (deathPrevention.sourceId === SLIVER_OF_EDICTS_ACTIVATE_ID) {
    deathPrevention = clearDeathPrevention(deathPrevention);
  }
  rt.state = patchPlayer(rt.state, {
    naragi,
    levelOverride: { untilTick: 0, level: 0 },
    deathPrevention,
  });
  return NO_DAMAGE;
}

/**
 * Auto re-activate when UI toggle (activateNaragiAtStart) keeps Sliver on a cycle.
 * Uses landTick: clock advances state.tick only after due events land.
 */
function playerReactivateResolve(rt: SimulationRuntime, landTick: number): EventResolution {
  if (rt.input.activateNaragiAtStart !== true) return NO_DAMAGE;
  activateNaragiSliver(rt, {
    relicActive: hasNaragiEdict(rt.input.league),
    sliverWorn: rt.input.equipmentIds?.includes(SLIVER_OF_EDICTS_ID) === true,
    maximumLifePoints: rt.input.league?.maximumLife ?? 15_000,
    atTick: landTick,
  });
  return NO_DAMAGE;
}

/**
 * Activate Sliver of Edicts at `atTick` (default: runtime state tick).
 * Schedules four heal events then expire (higher seq) at the duration boundary.
 * When input.activateNaragiAtStart, also queues the next activation at CD ready (90s).
 */
export function activateNaragiSliver(
  rt: SimulationRuntime,
  opts: {
    relicActive: boolean;
    sliverWorn: boolean;
    /** Default max LP when player state was not initialized. */
    maximumLifePoints?: number;
    /** Absolute activation tick (event land time). Defaults to rt.state.tick. */
    atTick?: number;
  },
): NaragiActivateResult {
  rt.state = ensurePlayer(rt.state, opts.maximumLifePoints ?? 15_000);
  const tick = opts.atTick ?? rt.state.tick;
  const player = rt.state.player!;
  const gate = naragiActivationGate({
    relicActive: opts.relicActive,
    sliverWorn: opts.sliverWorn,
    runtime: player.naragi,
    cooldowns: rt.state.cooldowns,
    tick,
  });
  if (!gate.ok) {
    return {
      ok: false,
      reason: gate.reason,
      note: naragiActivationFailNote(gate.reason),
      activationTick: tick,
      healTicks: [],
      cooldownReadyTick: rt.state.cooldowns[SLIVER_OF_EDICTS_ACTIVATE_ID] ?? 0,
      activeUntilTick: player.naragi.activeUntilTick,
    };
  }

  const naragi = beginNaragiActivation(player.naragi, tick);
  const cooldownReadyTick = naragiCooldownReadyTick(tick);
  const activeUntilTick = naragi.activeUntilTick;

  rt.state = {
    ...patchPlayer(rt.state, {
      naragi,
      levelOverride: makeLevelOverride(activeUntilTick, NARAGI_LEVEL_OVERRIDE),
      deathPrevention: makeDeathPrevention({
        sourceId: SLIVER_OF_EDICTS_ACTIVATE_ID,
        charges: NARAGI_REVIVAL_CHARGES,
        untilTick: activeUntilTick,
        policy: "full-max",
      }),
      dead: false,
    }),
    cooldowns: {
      ...rt.state.cooldowns,
      [SLIVER_OF_EDICTS_ACTIVATE_ID]: cooldownReadyTick,
    },
  };

  const offsets = naragiHealOffsetsTicks();
  const healTicks = offsets.map((o) => tick + o);

  // Heals first (lower seq), expire last at the same boundary tick.
  for (let i = 0; i < healTicks.length; i++) {
    const landTick = healTicks[i]!;
    scheduleEvent(rt, {
      tick: landTick,
      family: "player",
      abilityId: NARAGI_EVENT.heal,
      sourceCast: -1,
      hitIndex: i,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      provenance: NARAGI_PROVENANCE,
      resolve: playerHealResolve(i),
    });
  }

  scheduleEvent(rt, {
    tick: activeUntilTick,
    family: "player",
    abilityId: NARAGI_EVENT.expire,
    sourceCast: -1,
    hitIndex: 0,
    attached: false,
    procEligible: false,
    recursionAllowed: false,
    provenance: NARAGI_PROVENANCE,
    resolve: playerExpireResolve,
  });

  // Activation marker on the event log (immediate resolve bookkeeping).
  scheduleEvent(rt, {
    tick,
    family: "player",
    abilityId: NARAGI_EVENT.activate,
    sourceCast: -1,
    hitIndex: 0,
    attached: false,
    procEligible: false,
    recursionAllowed: false,
    provenance: NARAGI_PROVENANCE,
    resolve: () => NO_DAMAGE,
  });

  // Toggle on: re-fire every 90s CD (horizon half-open bound skips post-run lands).
  if (rt.input.activateNaragiAtStart === true) {
    const horizon = rt.horizon;
    if (horizon == null || cooldownReadyTick < horizon) {
      scheduleEvent(rt, {
        tick: cooldownReadyTick,
        family: "player",
        abilityId: NARAGI_EVENT.reactivate,
        sourceCast: -1,
        hitIndex: 0,
        attached: false,
        procEligible: false,
        recursionAllowed: false,
        provenance: NARAGI_PROVENANCE,
        resolve: playerReactivateResolve,
      });
    }
  }

  return {
    ok: true,
    reason: null,
    note: "Sliver of Edicts activated",
    activationTick: tick,
    healTicks,
    cooldownReadyTick,
    activeUntilTick,
  };
}

/** Drop active Naragi window (unequip / relic off). Leaves cooldown. Cancels pending heals/expire. */
export function invalidateNaragiOnRuntime(rt: SimulationRuntime): void {
  const player = rt.state.player;
  if (!player) return;
  const naragi = invalidateNaragiActivation(player.naragi);
  let deathPrevention = player.deathPrevention;
  if (deathPrevention.sourceId === SLIVER_OF_EDICTS_ACTIVATE_ID) {
    deathPrevention = clearDeathPrevention(deathPrevention);
  }
  rt.state = patchPlayer(rt.state, {
    naragi,
    levelOverride: { untilTick: 0, level: 0 },
    deathPrevention,
  });
  rt.queue.cancelWhere(
    (e) =>
      e.family === "player" &&
      (e.abilityId === NARAGI_EVENT.heal ||
        e.abilityId === NARAGI_EVENT.expire ||
        e.abilityId === NARAGI_EVENT.reactivate),
  );
}

/**
 * Apply lethal (or any) incoming damage through death-prevention.
 * Initializes player state when missing.
 */
export function applyPlayerDamageWithPrevention(
  rt: SimulationRuntime,
  amount: number,
  opts: { maximumLifePoints?: number } = {},
): {
  died: boolean;
  revived: boolean;
  currentLifePoints: number;
} {
  rt.state = ensurePlayer(rt.state, opts.maximumLifePoints ?? 15_000);
  const player = rt.state.player!;
  if (player.dead) {
    return { died: true, revived: false, currentLifePoints: 0 };
  }
  const result = applyPreventablePlayerDamage(
    player.vitality,
    player.deathPrevention,
    amount,
    rt.state.tick,
  );
  rt.state = patchPlayer(rt.state, {
    vitality: result.vitality,
    deathPrevention: result.deathPrevention,
    dead: result.died,
    naragi:
      result.revived && player.naragi.revivalCharges > 0
        ? { ...player.naragi, revivalCharges: player.naragi.revivalCharges - 1 }
        : player.naragi,
  });
  if (result.revived) {
    scheduleEvent(rt, {
      tick: rt.state.tick,
      family: "player",
      abilityId: NARAGI_EVENT.revive,
      sourceCast: -1,
      hitIndex: 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      provenance: NARAGI_PROVENANCE,
      resolve: () => NO_DAMAGE,
    });
  }
  return {
    died: result.died,
    revived: result.revived,
    currentLifePoints: result.vitality.currentLifePoints,
  };
}

export function readNaragiRuntime(state: RotationState): NaragiRuntimeState {
  return state.player?.naragi ?? newNaragiRuntime();
}

export function effectiveLevelFromState(
  baseLevel: number,
  state: RotationState,
  tick: number = state.tick,
): number {
  const override = state.player?.levelOverride;
  if (override && override.untilTick > 0 && tick < override.untilTick && override.level > 0) {
    return override.level;
  }
  return baseLevel;
}

export { NARAGI_EDICT_RELIC, SLIVER_OF_EDICTS_ID, NARAGI_ACTIVE_DURATION_TICKS };
