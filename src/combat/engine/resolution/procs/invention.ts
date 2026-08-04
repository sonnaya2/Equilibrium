import type { ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import { secondsToTicks } from "../../../core/ticks";
import { runPipeline } from "../../../pipeline/modifierPipeline";
import { capabilitiesOf } from "../../../shared/damageProvenance";
import {
  AFTERSHOCK_DAMAGE_STEP_PER_RANK,
  AFTERSHOCK_DAMAGE_THRESHOLD,
  AFTERSHOCK_MAX_AD_FRACTION_PER_RANK,
  AFTERSHOCK_MIN_AD_FRACTION_PER_RANK,
  AFTERSHOCK_MIN_PROC_INTERVAL_SECONDS,
  CRACKLING_COOLDOWN_SECONDS,
  cracklingDamageFraction,
} from "../../../shared/perks";
import type { ResolvedDamage } from "../types";

function procRank(value: number | undefined, max: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= max
    ? value
    : 0;
}

/** Crackling and Aftershock bypass Damage Potential and use only sourced target modifiers. */
function applyProcModifiers(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: number,
): number {
  const ability = rt.byId.get(event.abilityId) ?? rt.byId.values().next().value;
  const configured =
    typeof rt.input.modifiers === "function"
      ? ability
        ? rt.input.modifiers(ability)
        : []
      : (rt.input.modifiers ?? []);
  const modifiers = configured.filter((modifier) => modifier.id === "vulnerability");
  if (modifiers.length === 0) return damage;
  const provenance = {
    kind: "invention_proc" as const,
    detail: event.abilityId,
  };
  return runPipeline(
    { damage },
    modifiers,
    {
      ...(rt.input.context ?? { style: ability?.style ?? "melee" }),
      damageSource: "proc",
      provenance,
    },
  ).damage;
}

function cracklingDamage(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  rank: number,
): ResolvedDamage {
  const hit = applyProcModifiers(
    rt,
    event,
    Math.floor(rt.input.base * cracklingDamageFraction(rank)),
  );
  return { min: hit, max: hit, expected: hit };
}

function aftershockDamage(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  rank: number,
): ResolvedDamage {
  const hits: number[] = [];
  const steps = Math.round(
    (AFTERSHOCK_MAX_AD_FRACTION_PER_RANK - AFTERSHOCK_MIN_AD_FRACTION_PER_RANK) /
      AFTERSHOCK_DAMAGE_STEP_PER_RANK,
  );
  const minimumUnits = Math.round(AFTERSHOCK_MIN_AD_FRACTION_PER_RANK * 1000);
  const stepUnits = Math.round(AFTERSHOCK_DAMAGE_STEP_PER_RANK * 1000);
  for (let step = 0; step <= steps; step++) {
    const raw = Math.floor((rt.input.base * (minimumUnits + step * stepUnits) * rank) / 1000);
    hits.push(applyProcModifiers(rt, event, raw));
  }
  return {
    min: hits[0]!,
    max: hits.at(-1)!,
    expected: hits.reduce((total, hit) => total + hit, 0) / hits.length,
  };
}

/**
 * Aftershock charge eligibility (wiki: 50k threshold explosion;
 * https://runescape.wiki/w/Aftershock). Follows `canTriggerProcs` so conjure
 * auto/poison and equipment_proc do not charge; Aftershock's own blast never
 * re-charges (resets on land). Blessings never hit this path
 * (`recordResolved` skips Invention).
 */
function contributesAftershockCharge(event: ScheduledEvent<SimulationRuntime>): boolean {
  if (event.abilityId === "aftershock") return false;
  return capabilitiesOf(event.provenance).canTriggerProcs;
}

/** Schedule Crackling/Aftershock after a land; mutates `rt.state.invention`. */
export function applyInventionProcs(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  const cracklingRank = procRank(rt.input.procs?.cracklingRank, 4);
  // Family hit|dot|command; also require canTriggerProcs (player_dot true, conjure auto false).
  const cracklingEligible =
    (event.family === "hit" || event.family === "dot" || event.family === "command") &&
    capabilitiesOf(event.provenance).canTriggerProcs;
  if (
    cracklingRank > 0 &&
    cracklingEligible &&
    damage.max > 0 &&
    event.tick >= rt.state.invention.cracklingReadyTick
  ) {
    const procDamage = cracklingDamage(rt, event, cracklingRank);
    rt.state = {
      ...rt.state,
      invention: {
        ...rt.state.invention,
        cracklingReadyTick: event.tick + secondsToTicks(CRACKLING_COOLDOWN_SECONDS),
      },
    };
    scheduleEvent(rt, {
      tick: event.tick,
      family: "proc",
      abilityId: "crackling",
      sourceCast: -1,
      hitIndex: 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      originKind: "proc",
      provenance: { kind: "invention_proc", detail: "crackling" },
      resolve: () => ({ damage: procDamage }),
    });
  }

  const aftershockRank = procRank(rt.input.procs?.aftershockRank, 4);
  if (aftershockRank === 0 || damage.expected <= 0) return;

  const invention = rt.state.invention;
  // Blast land: reset charge / pending / interval. Do not fall through into
  // charge accumulation - Aftershock damage must not seed the next threshold.
  if (event.abilityId === "aftershock") {
    rt.state = {
      ...rt.state,
      invention: {
        ...invention,
        aftershockCharge: 0,
        aftershockReadyTick: event.tick + secondsToTicks(AFTERSHOCK_MIN_PROC_INTERVAL_SECONDS),
        aftershockPending: false,
      },
    };
    return;
  }

  if (invention.aftershockPending) {
    rt.state = { ...rt.state, invention };
    return;
  }

  if (!contributesAftershockCharge(event)) return;

  const aftershockCharge = invention.aftershockCharge + damage.expected;
  if (aftershockCharge < AFTERSHOCK_DAMAGE_THRESHOLD) {
    rt.state = { ...rt.state, invention: { ...invention, aftershockCharge } };
    return;
  }

  const procDamage = aftershockDamage(rt, event, aftershockRank);
  const tick = Math.max(event.tick, invention.aftershockReadyTick);
  rt.state = {
    ...rt.state,
    invention: { ...invention, aftershockCharge, aftershockPending: true },
  };
  scheduleEvent(rt, {
    tick,
    family: "proc",
    abilityId: "aftershock",
    sourceCast: -1,
    hitIndex: 0,
    attached: false,
    procEligible: false,
    recursionAllowed: false,
    originKind: "proc",
    provenance: { kind: "invention_proc", detail: "aftershock" },
    resolve: () => ({ damage: procDamage }),
  });
}
