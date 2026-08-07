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
import type { AttachedDamageComponent, EventResolution } from "../types";
import { blessingRule, resolveMaximumLife } from "../../../league/ruleset";
import { targetAndPostHitModifiers } from "../modifiers";

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
  const modifiers = targetAndPostHitModifiers(rt, ability);
  if (modifiers.length === 0) return damage;
  const provenance = {
    kind: "invention_proc" as const,
    detail: event.abilityId,
  };
  return runPipeline({ damage }, modifiers, {
    ...(rt.input.context ?? { style: ability?.style ?? "melee" }),
    damageSource: "proc",
    provenance,
  }).damage;
}

function bigBonedFlat(rt: SimulationRuntime, atTick: number): number {
  if (!rt.input.league) return 0;
  const rule = blessingRule(rt.input.league, "big-boned");
  return rule?.maxLifeDamagePercent === undefined
    ? 0
    : Math.floor(resolveMaximumLife(rt.input.league, atTick) * rule.maxLifeDamagePercent);
}

function procResolution(
  effectId: "crackling" | "aftershock",
  damage: ResolvedDamage,
  bigBoned: ResolvedDamage | undefined,
): EventResolution {
  const component: AttachedDamageComponent | undefined = bigBoned
    ? {
        id: "big-boned",
        damage: bigBoned,
        attached: true,
        hitCapPolicy: "shared",
        analysis: {
          kind: "league-blessing",
          blessingId: "big-boned",
          bonusTargetId: effectId,
          expectedActivations: 1,
        },
      }
    : undefined;
  return {
    damage,
    ...(component ? { components: [component] } : {}),
  };
}

function cracklingDamage(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  rank: number,
): EventResolution {
  const raw = Math.floor(rt.input.base * cracklingDamageFraction(rank));
  const base = applyProcModifiers(rt, event, raw);
  const flat = bigBonedFlat(rt, event.tick);
  const combined = flat > 0 ? applyProcModifiers(rt, event, raw + flat) : base;
  return procResolution(
    "crackling",
    { min: combined, max: combined, expected: combined },
    flat > 0
      ? { min: combined - base, max: combined - base, expected: combined - base }
      : undefined,
  );
}

function aftershockDamage(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  rank: number,
  atTick: number,
): EventResolution {
  const hits: number[] = [];
  const combinedHits: number[] = [];
  const flat = bigBonedFlat(rt, atTick);
  const steps = Math.round(
    (AFTERSHOCK_MAX_AD_FRACTION_PER_RANK - AFTERSHOCK_MIN_AD_FRACTION_PER_RANK) /
      AFTERSHOCK_DAMAGE_STEP_PER_RANK,
  );
  const minimumUnits = Math.round(AFTERSHOCK_MIN_AD_FRACTION_PER_RANK * 1000);
  const stepUnits = Math.round(AFTERSHOCK_DAMAGE_STEP_PER_RANK * 1000);
  for (let step = 0; step <= steps; step++) {
    const raw = Math.floor((rt.input.base * (minimumUnits + step * stepUnits) * rank) / 1000);
    hits.push(applyProcModifiers(rt, event, raw));
    combinedHits.push(applyProcModifiers(rt, event, raw + flat));
  }
  const base: ResolvedDamage = {
    min: hits[0]!,
    max: hits.at(-1)!,
    expected: hits.reduce((total, hit) => total + hit, 0) / hits.length,
  };
  const combined: ResolvedDamage = {
    min: combinedHits[0]!,
    max: combinedHits.at(-1)!,
    expected: combinedHits.reduce((total, hit) => total + hit, 0) / combinedHits.length,
  };
  return procResolution(
    "aftershock",
    combined,
    flat > 0
      ? {
          min: combined.min - base.min,
          max: combined.max - base.max,
          expected: combined.expected - base.expected,
        }
      : undefined,
  );
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
    const procResolution = cracklingDamage(rt, event, cracklingRank);
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
      resolve: () => procResolution,
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

  const tick = Math.max(event.tick, invention.aftershockReadyTick);
  const procResolution = aftershockDamage(rt, event, aftershockRank, tick);
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
    resolve: () => procResolution,
  });
}
