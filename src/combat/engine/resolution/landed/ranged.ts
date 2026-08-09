import type { AbilitySpec } from "../../../pipeline/calculateAbility";
import { capabilitiesOf } from "../../../shared/damageProvenance";
import {
  extendSearingWinds,
  onRangedHit,
  shadowImbuedAdrenalinePerHit,
} from "../../../styles/ranged/onHit";
import {
  applyPunctureStack,
  PUNCTURE_ABILITY_ID,
  PUNCTURE_FIRST_OFFSET_AFTER_FINISH,
  PUNCTURE_HIT_PERCENTS,
  punctureHitDamage,
  punctureSequenceTicks,
} from "../../../styles/ranged/puncture";
import type { ResolvedDamage } from "../types";
import type { ScheduledEvent } from "../../runtime/events";
import { scheduleEvent, type SimulationRuntime } from "../../runtime/runtime";
import { gainAdrenaline, patchRanged } from "../../runtime/state";
import { dracolichAdrenalinePerRapidFireHit } from "../../../styles/ranged/dracolich";
import { attachedResolutionComponent, resolveLeagueAttachedRawHost } from "../../../league/damage";
import { targetAndPostHitModifiers } from "../modifiers";

function mayApplyPuncture(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): boolean {
  if (rt.input.ammo !== "splintering") return false;
  if (event.abilityId === PUNCTURE_ABILITY_ID) return false;
  if (event.attached || !event.procEligible) return false;
  if (damage.max <= 0) return false;
  const caps = capabilitiesOf(event.provenance);
  return caps.playerAttack && caps.directHit;
}

/** Drop stale puncture sequence events (gen bump / refresh). */
function cancelPendingPuncture(rt: SimulationRuntime): void {
  rt.queue.cancelWhere((e) => e.abilityId === PUNCTURE_ABILITY_ID);
}

function schedulePunctureSequence(
  rt: SimulationRuntime,
  firstTick: number,
  generation: number,
  storedDamage: number,
): void {
  cancelPendingPuncture(rt);
  const ticks = punctureSequenceTicks(firstTick);
  for (let i = 0; i < PUNCTURE_HIT_PERCENTS.length; i++) {
    const percent = PUNCTURE_HIT_PERCENTS[i]!;
    const tick = ticks[i]!;
    const amount = punctureHitDamage(storedDamage, percent);
    scheduleEvent(rt, {
      tick,
      family: "dot",
      abilityId: PUNCTURE_ABILITY_ID,
      sourceCast: -1,
      hitIndex: i,
      attached: false,
      procEligible: false,
      recursionAllowed: false,
      originKind: "dot",
      provenance: { kind: "equipment_proc", detail: "puncture" },
      resolve: (eventRt) => {
        const p = eventRt.state.ranged.puncture;
        if (p.generation !== generation || tick >= p.expiresAtTick) {
          return { damage: { min: 0, max: 0, expected: 0 } };
        }
        const provenance = { kind: "equipment_proc" as const, detail: "puncture" };
        const host = resolveLeagueAttachedRawHost({
          rules: eventRt.input.league,
          source: provenance,
          landTick: tick,
          abilityBase: eventRt.input.base,
          min: amount,
          max: amount,
          level: eventRt.input.level,
          accuracy: 1,
          crit: { chance: 0, eligible: false },
          modifiers: targetAndPostHitModifiers(eventRt),
          context: {
            ...(eventRt.input.context ?? { style: "ranged" }),
            style: "ranged",
            damageSource: "proc",
            provenance,
          },
          cap: { cap: eventRt.input.cap?.cap ?? 30_000, bypass: true },
          bonusTargetId: "puncture",
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
            ? {
                components: host.components.map((component) =>
                  attachedResolutionComponent(component),
                ),
              }
            : {}),
        };
      },
    });
  }
}

/** Schedule Puncture sequence after the applying ability finishes (finish+1). */
export function schedulePunctureAfterFinish(rt: SimulationRuntime, finishTick: number): void {
  const p = rt.state.ranged.puncture;
  if (p.stacks <= 0 || p.storedDamage <= 0) {
    cancelPendingPuncture(rt);
    return;
  }
  const first = finishTick + PUNCTURE_FIRST_OFFSET_AFTER_FINISH;
  schedulePunctureSequence(rt, first, p.generation, p.storedDamage);
  rt.state = patchRanged(rt.state, {
    puncture: { ...p, pendingOwnerCast: -1 },
  });
}

/**
 * Ranged state a real landed hit changes: Deathspore, Shadow Imbued adren,
 * Rapid Fire Searing Winds extension, and Puncture stacks (splintering).
 */
export function onRangedHitLanded(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  ability: AbilitySpec,
  damage: ResolvedDamage,
): void {
  if (ability.id === "rapid_fire") {
    const grant = dracolichAdrenalinePerRapidFireHit(rt.input.equipmentEffects);
    if (grant > 0) rt.state = gainAdrenaline(rt.state, grant);
  }
  const fleeting = rt.input.equipmentIds?.some(
    (id) => id === "item:fleeting-boots" || id === "item:enhanced-fleeting-boots",
  );
  const snipeReduction =
    ability.id === "piercing_shot"
      ? fleeting
        ? 6
        : 4
      : ability.id === "ranged_attack" && fleeting
        ? 6
        : 0;
  const snipeReady = rt.state.cooldowns.snipe;
  if (snipeReduction > 0 && snipeReady !== undefined && snipeReady > event.tick) {
    rt.state = {
      ...rt.state,
      cooldowns: {
        ...rt.state.cooldowns,
        snipe: Math.max(event.tick, snipeReady - snipeReduction),
      },
    };
  }
  if (rt.input.ammo === "deathspore") {
    rt.state = patchRanged(rt.state, {
      deathspore: onRangedHit(rt.state.ranged.deathspore, event.tick),
    });
  }
  const perHit = shadowImbuedAdrenalinePerHit(rt.state.ranged.shadowImbued, event.tick);
  if (perHit > 0) rt.state = gainAdrenaline(rt.state, perHit);
  // Rapid Fire: each landed hit extends an active Searing Winds by 1 tick (wiki).
  if (ability.id === "rapid_fire" && event.tick < rt.state.ranged.searingWinds.expiresAtTick) {
    rt.state = patchRanged(rt.state, {
      searingWinds: extendSearingWinds(rt.state.ranged.searingWinds, 1),
    });
  }

  if (!mayApplyPuncture(rt, event, damage)) return;

  // Open cast: pendingOwnerCast waits for applyCompletionEffects (one sequence per cast).
  // Finished / autonomous: pendingOwnerCast=-1 and schedule from land (finish analog = land tick).
  const owner = event.sourceCast;
  const finished = owner < 0 || owner <= rt.state.ranged.puncture.lastCompletedCastSeq;
  const next = applyPunctureStack(
    rt.state.ranged.puncture,
    event.tick,
    rt.input.base,
    finished ? -1 : owner,
  );
  rt.state = patchRanged(rt.state, { puncture: next });
  // Gen bump invalidates any live sequence; drop stale queue rows (not only on reschedule).
  cancelPendingPuncture(rt);
  if (next.pendingOwnerCast < 0) {
    schedulePunctureAfterFinish(rt, event.tick);
  }
}
