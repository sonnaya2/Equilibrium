import type { AbilitySpec } from "../../../pipeline/calculateAbility";
import { secondsToTicks } from "../../../core/ticks";
import {
  ABYSSAL_PARASITE_DURATION_TICKS,
  ABYSSAL_PARASITE_INTERVAL_TICKS,
  ABYSSAL_PARASITE_MAX_STACKS,
  abyssalParasiteDamage,
  FROSTBLADES_DURATION_SECONDS,
  GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS,
  LENG_BOUNDLESS_CHILL_CHANCE,
  LENG_ENDLESS_FROST_CHANCE,
  lengHitRoll,
  PRIMORDIAL_ICE_CAP,
} from "../../../styles/melee/effects";
import { capabilitiesOf } from "../../../shared/damageProvenance";
import { hasPassive } from "../../../shared/equipment";
import type { ResolvedDamage } from "../types";
import type { ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import { patchMelee, patchTarget } from "../../runtime/state";

function resolveParasiteDamage(rt: SimulationRuntime, at: number) {
  const parasite = rt.state.target.melee.abyssalParasite;
  if (parasite.stacks <= 0 || at >= parasite.expiresAtTick) {
    return { damage: { min: 0, max: 0, expected: 0 } };
  }
  let { min, max } = abyssalParasiteDamage(parasite.stacks);
  const enduringRuin = rt.state.target.melee.enduringRuin;
  if (enduringRuin.bleedVulnerability > 0 && at < enduringRuin.untilTick) {
    min = Math.floor(min * (1 + enduringRuin.bleedVulnerability));
    max = Math.floor(max * (1 + enduringRuin.bleedVulnerability));
  }
  return { damage: { min, max, expected: (min + max) / 2 } };
}

function addParasiteStack(rt: SimulationRuntime, event: ScheduledEvent<SimulationRuntime>): void {
  const current = rt.state.target.melee.abyssalParasite;
  const active = current.stacks > 0 && event.tick < current.expiresAtTick;
  const nextDamageTick = active
    ? current.nextDamageTick
    : event.tick + ABYSSAL_PARASITE_INTERVAL_TICKS;
  const finalDamageTick = event.tick + ABYSSAL_PARASITE_DURATION_TICKS;
  let scheduledThroughTick = active ? current.scheduledThroughTick : 0;
  const firstUnscheduledTick = Math.max(
    nextDamageTick,
    scheduledThroughTick > 0
      ? scheduledThroughTick + ABYSSAL_PARASITE_INTERVAL_TICKS
      : nextDamageTick,
  );

  for (
    let tick = firstUnscheduledTick;
    tick <= finalDamageTick;
    tick += ABYSSAL_PARASITE_INTERVAL_TICKS
  ) {
    scheduleEvent(rt, {
      tick,
      family: "dot",
      abilityId: "abyssal_parasite",
      sourceCast: -1,
      hitIndex: 0,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      originKind: "proc",
      provenance: { kind: "equipment_proc", detail: "abyssal_parasite" },
      dotKind: "bleed",
      bleedId: "abyssal-parasite",
      resolve: resolveParasiteDamage,
    });
    scheduledThroughTick = tick;
  }

  rt.state = patchTarget(rt.state, {
    melee: {
      ...rt.state.target.melee,
      abyssalParasite: {
        stacks: Math.min(ABYSSAL_PARASITE_MAX_STACKS, (active ? current.stacks : 0) + 1),
        expiresAtTick: finalDamageTick + 1,
        nextDamageTick,
        scheduledThroughTick,
      },
    },
  });
}

export function onMeleeHitLanded(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability: AbilitySpec | undefined,
  damage: ResolvedDamage,
): void {
  if (event.abilityId === "abyssal_parasite") {
    rt.state = patchTarget(rt.state, {
      melee: {
        ...rt.state.target.melee,
        abyssalParasite: {
          ...rt.state.target.melee.abyssalParasite,
          nextDamageTick: event.tick + ABYSSAL_PARASITE_INTERVAL_TICKS,
        },
      },
    });
    return;
  }
  if (!ability || damage.max <= 0) return;

  if (event.bleedId && event.bleedExpiresAtTick != null) {
    rt.state = patchTarget(rt.state, {
      melee: {
        ...rt.state.target.melee,
        bleeds: {
          ...rt.state.target.melee.bleeds,
          [event.bleedId]: event.bleedExpiresAtTick,
        },
      },
    });
  }

  if (ability.id === "rend" && hasPassive(rt.input.equipmentEffects, "enduring-ruin")) {
    const agony = rt.input.equipmentEffects?.passage.agonyActive === true;
    rt.state = patchMelee(rt.state, {
      enduringRuin: {
        nextAttackBonus: agony ? 0.16 : 0.1,
        untilTick: event.tick + secondsToTicks(6),
        grantedByCast: event.sourceCast,
      },
    });
    rt.state = patchTarget(rt.state, {
      melee: {
        ...rt.state.target.melee,
        enduringRuin: {
          bleedVulnerability: agony ? 0.25 : 0.2,
          untilTick: event.tick + secondsToTicks(10),
        },
      },
    });
  }

  if (
    ability.id === "greater_flurry" &&
    rt.state.melee.bloodlust.berserk &&
    event.tick < rt.state.melee.berserkUntilTick
  ) {
    rt.state = patchMelee(rt.state, {
      berserkUntilTick:
        rt.state.melee.berserkUntilTick +
        secondsToTicks(GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS),
    });
  }

  const mayStack =
    hasPassive(rt.input.equipmentEffects, "abyssal-parasite") &&
    ability.style === "melee" &&
    capabilitiesOf(event.provenance).canApplyAbyssalParasite &&
    !event.attached &&
    damage.max > 0;
  if (mayStack) addParasiteStack(rt, event);

  // Leng: Endless Frost (10%) / Boundless Chill (2%) on real melee hits.
  // Chill stack generation also opens Frostblades for 9s.
  if (
    event.procEligible &&
    !event.attached &&
    ability.style === "melee" &&
    event.family !== "dot" &&
    !event.dotKind
  ) {
    const equipment = rt.input.equipmentEffects;
    let stacks = rt.state.melee.primordialIceStacks;
    let frostUntil = rt.state.melee.frostbladesUntilTick;
    let changed = false;
    if (
      hasPassive(equipment, "leng-endless-frost") &&
      lengHitRoll(event.seq, 1) < LENG_ENDLESS_FROST_CHANCE
    ) {
      stacks = Math.min(PRIMORDIAL_ICE_CAP, stacks + 1);
      changed = true;
    }
    if (
      hasPassive(equipment, "leng-boundless-chill") &&
      lengHitRoll(event.seq, 2) < LENG_BOUNDLESS_CHILL_CHANCE
    ) {
      stacks = Math.min(PRIMORDIAL_ICE_CAP, stacks + 1);
      frostUntil = event.tick + secondsToTicks(FROSTBLADES_DURATION_SECONDS);
      changed = true;
    }
    if (changed) {
      rt.state = patchMelee(rt.state, {
        primordialIceStacks: stacks,
        frostbladesUntilTick: frostUntil,
      });
    }
  }
}
