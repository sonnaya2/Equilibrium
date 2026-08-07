import type { AbilitySpec } from "../../../pipeline/calculateAbility";
import { secondsToTicks } from "../../../core/ticks";
import {
  ABYSSAL_PARASITE_DURATION_TICKS,
  ABYSSAL_PARASITE_INTERVAL_TICKS,
  ABYSSAL_PARASITE_MAX_STACKS,
  abyssalParasiteDamage,
  GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS,
} from "../../../styles/melee/effects";
import { capabilitiesOf } from "../../../shared/damageProvenance";
import { hasPassive } from "../../../shared/equipment";
import { attachedResolutionComponent, resolveLeagueAttachedRawHost } from "../../../league/damage";
import { mulFloor } from "../../../core/rounding";
import { ENDURING_RUIN_SOURCE } from "../../../shared/equipment";
import type { CombatModifier } from "../../../types";
import type { ResolvedDamage } from "../types";
import type { ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import { patchMelee, patchTarget } from "../../runtime/state";
import { reduceCooldown } from "../../cast/effects/cooldowns";
import { targetAndPostHitModifiers } from "../modifiers";

/** Wiki Hurricane: -3s (5 ticks) per affected target per cast. */
const HURRICANE_CDR_TICKS = secondsToTicks(3);

function resolveParasiteDamage(rt: SimulationRuntime, at: number) {
  const parasite = rt.state.target.melee.abyssalParasite;
  if (parasite.stacks <= 0 || at >= parasite.expiresAtTick) {
    return { damage: { min: 0, max: 0, expected: 0 } };
  }
  const { min, max } = abyssalParasiteDamage(parasite.stacks);
  const modifiers = targetAndPostHitModifiers(rt);
  const enduringRuin = rt.state.target.melee.enduringRuin;
  if (enduringRuin.bleedVulnerability > 0 && at < enduringRuin.untilTick) {
    const modifier: CombatModifier = {
      id: "item:enduring-ruin-bleed",
      stage: "target",
      priority: 50,
      applies: () => true,
      apply: (damage) => ({
        ...damage,
        damage: mulFloor(damage.damage, 1 + enduringRuin.bleedVulnerability),
      }),
      source: ENDURING_RUIN_SOURCE,
    };
    modifiers.push(modifier);
  }
  const provenance = { kind: "equipment_proc" as const, detail: "abyssal_parasite" };
  const host = resolveLeagueAttachedRawHost({
    rules: rt.input.league,
    source: provenance,
    landTick: at,
    abilityBase: rt.input.base,
    min,
    max,
    level: rt.input.level,
    accuracy: 1,
    crit: { chance: 0, eligible: false },
    modifiers,
    context: {
      ...(rt.input.context ?? { style: "melee" }),
      style: "melee",
      damageSource: "proc",
      dotKind: "bleed",
      provenance,
    },
    cap: { cap: rt.input.cap?.cap ?? 30_000, bypass: true },
    bonusTargetId: "abyssal_parasite",
  });
  return {
    damage: {
      min: host.hit.min,
      max: host.hit.max,
      expected: host.hit.expected,
      critExpected: host.hit.critExpected,
      capLoss: host.hit.capLoss,
    },
    hitDetail: host.hit,
    ...(host.components.length > 0
      ? { components: host.components.map((component) => attachedResolutionComponent(component)) }
      : {}),
  };
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

  applyHurricaneTargetCdr(rt, event, damage);

  const mayStack =
    hasPassive(rt.input.equipmentEffects, "abyssal-parasite") &&
    ability.style === "melee" &&
    capabilitiesOf(event.provenance).canApplyAbyssalParasite &&
    !event.attached &&
    damage.max > 0;
  if (mayStack) addParasiteStack(rt, event);

  // Leng stack / Frostblades RNG is probability-weighted in expandLengOnLand
  // (simulation/landBranch.ts), not a per-seq hash roll.
}

function applyHurricaneTargetCdr(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  if (event.abilityId !== "hurricane") return;
  if (damage.max <= 0 || event.attached) return;
  if (event.originKind === "proc" || event.dotKind != null) return;
  if (event.bleedId != null || event.derivedFrom != null) return;
  if (!capabilitiesOf(event.provenance).directHit) return;
  if (event.sourceCast < 0) return;

  const target = rt.state.target.melee;
  if (target.lastHurricaneCdrCast === event.sourceCast) return;
  rt.state = patchTarget(rt.state, {
    melee: { ...target, lastHurricaneCdrCast: event.sourceCast },
  });
  rt.state = reduceCooldown(rt.state, "hurricane", HURRICANE_CDR_TICKS, event.tick);
}
