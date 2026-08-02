import type { ScheduledEvent } from "../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../runtime/runtime";
import { secondsToTicks } from "../../core/ticks";
import { runPipeline } from "../../pipeline/modifierPipeline";
import {
  AFTERSHOCK_DAMAGE_STEP_PER_RANK,
  AFTERSHOCK_DAMAGE_THRESHOLD,
  AFTERSHOCK_MAX_AD_FRACTION_PER_RANK,
  AFTERSHOCK_MIN_AD_FRACTION_PER_RANK,
  AFTERSHOCK_MIN_PROC_INTERVAL_SECONDS,
  CRACKLING_COOLDOWN_SECONDS,
  cracklingDamageFraction,
} from "../../shared/perks";
import { applyLandedHitEffects } from "./landed";
import type { EventResolution, ResolvedDamage } from "./types";

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
  return runPipeline(
    { damage },
    modifiers,
    rt.input.context ?? { style: ability?.style ?? "melee" },
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

function applyInventionProcs(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  const cracklingRank = procRank(rt.input.procs?.cracklingRank, 4);
  const cracklingEligible =
    event.family === "hit" || event.family === "dot" || event.family === "command";
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
      resolve: () => ({ damage: procDamage }),
    });
  }

  const aftershockRank = procRank(rt.input.procs?.aftershockRank, 4);
  if (aftershockRank === 0 || damage.expected <= 0) return;

  let invention = rt.state.invention;
  if (event.abilityId === "aftershock") {
    invention = {
      ...invention,
      aftershockCharge: 0,
      aftershockReadyTick: event.tick + secondsToTicks(AFTERSHOCK_MIN_PROC_INTERVAL_SECONDS),
      aftershockPending: false,
    };
  }
  if (invention.aftershockPending) {
    rt.state = { ...rt.state, invention };
    return;
  }

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
    resolve: () => ({ damage: procDamage }),
  });
}

/**
 * Record one landed event: damage ledgers, tick/ability attribution, the owning
 * cast record, the hit detail later derived hits read, and the event log
 * (provenance kept, resolve closure dropped). Recording is the only step that
 * writes to the runtime's ledgers — resolvers only calculate.
 *
 * Landed-hit state transitions run last, so a hit's own damage is resolved
 * against the state that preceded it.
 */
export function recordResolved(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  resolution: EventResolution,
): void {
  const { damage, hitDetail } = resolution;
  if (hitDetail) rt.hitDetails.set(event.seq, hitDetail);

  rt.totalMin += damage.min;
  rt.totalMax += damage.max;
  rt.totalExpected += damage.expected;
  rt.damageByTick[event.tick] = (rt.damageByTick[event.tick] ?? 0) + damage.expected;
  rt.perAbility[event.abilityId] = (rt.perAbility[event.abilityId] ?? 0) + damage.expected;
  rt.endTick = Math.max(rt.endTick, event.tick + 1);

  if (event.sourceCast >= 0) {
    const record = rt.recordBySeq.get(event.sourceCast);
    if (record) {
      record.result.expected += damage.expected;
      // Attached components and procs fold into the cast's expected total only:
      // they are not separate hits, so they never extend the min/max span or the
      // per-hit breakdown.
      if (event.family !== "proc" && !event.attached) {
        record.result.min += damage.min;
        record.result.max += damage.max;
        if (hitDetail) record.result.hits.push(hitDetail);
      }
    }
  }

  const { resolve: _resolve, ...provenance } = event;
  const parasite = rt.state.target.melee.abyssalParasite;
  const spirit = rt.spiritEventMeta.get(event.seq);
  const remainingTicks =
    event.bleedExpiresAtTick != null
      ? Math.max(0, event.bleedExpiresAtTick - event.tick)
      : event.abilityId === "abyssal_parasite"
        ? Math.max(0, parasite.expiresAtTick - event.tick)
        : spirit
          ? Math.max(0, spirit.untilTick - event.tick)
          : undefined;
  rt.events.push({
    ...provenance,
    damage,
    ...(event.abilityId === "abyssal_parasite" ? { stackCount: parasite.stacks } : {}),
    ...(remainingTicks !== undefined ? { remainingTicks } : {}),
  });

  applyInventionProcs(rt, event, damage);

  // Endless Assault damage is not proc-eligible, but it is still the original
  // channel hit for ability-owned landed effects such as Greater Flurry's
  // Berserk extension.
  if (
    (event.procEligible ||
      event.convertedChannel ||
      event.bleedId != null ||
      event.abyssalParasiteEligible) &&
    !event.attached
  ) {
    applyLandedHitEffects(rt, event, damage);
  }
}
