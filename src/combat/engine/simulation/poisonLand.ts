import { nextEvolvingToxin, resolvePoisonApplication } from "../../poison/mechanics";
import { capabilitiesOf } from "../../shared/damageProvenance";
import { envenomedPoisonImmunityDisableTicks } from "../../league/ruleset";
import {
  expectedStatefulOccurrences,
  statefulOccurrenceProbability,
  statefulProcSuccessProbability,
} from "../analysis/multiplicity";
import { accountPlayerPoisonHits } from "../analysis";
import { isAmmunitionHitEligible } from "../../styles/ranged/ammunitionEligibility";
import { recordAppliedEventEffect } from "../resolution/accounting";
import type { ResolvedDamage } from "../resolution/types";
import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import { patchTarget, type TargetWeaponPoisonHitMultiplicity } from "../runtime/state";
import type { PlayerPoisonLandOccurrence } from "../schedulers/playerPoison";
import { applyPlayerPoisonLandOccurrence } from "../schedulers/playerPoisonState";

function poisonSuccessMultiplicity(
  event: ScheduledEvent<SimulationRuntime>,
  chance: number,
): TargetWeaponPoisonHitMultiplicity {
  if (event.occurrenceModel?.kind === "geometric") {
    const continuation = event.occurrenceModel.continuationProbability;
    return {
      kind: "positive-geometric",
      continuationProbability: (continuation * chance) / (1 - continuation * (1 - chance)),
    };
  }
  const occurrences = expectedStatefulOccurrences(event);
  return Number.isInteger(occurrences) && occurrences > 1
    ? { kind: "positive-binomial", trials: occurrences, probability: chance }
    : { kind: "single" };
}

export function applyEvolvingToxinOnLand(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  const attackOrigin =
    event.provenance.kind === "botlg_perfect_equilibrium" ? "botlg" : "player";
  const capabilities = capabilitiesOf(event.provenance);
  if (
    rt.input.ammunition?.projectile?.mechanicId !== "bik" ||
    damage.expected <= 0 ||
    !isAmmunitionHitEligible({
      style: rt.input.context?.style ?? "melee",
      provenance: event.provenance,
      attackOrigin,
    }) ||
    (attackOrigin !== "botlg" && capabilities.canApplyEvolvingToxin !== true)
  ) {
    return;
  }
  const toxin = rt.state.target.evolvingToxin;
  const evolvingToxin = nextEvolvingToxin(toxin.stacks, toxin.expiresAtTick, event.tick);
  rt.state = patchTarget(rt.state, {
    evolvingToxin,
  });
  recordAppliedEventEffect(rt, event, {
    id: "ammunition:bik",
    stackCount: evolvingToxin.stacks,
    remainingTicks: Math.max(0, evolvingToxin.expiresAtTick - event.tick),
  });
}

export function applyPlayerPoisonOnLand(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  if (damage.expected <= 0) return;
  const source =
    !event.attached && capabilitiesOf(event.provenance).canApplyWeaponPoison === true
      ? resolvePoisonApplication(rt.input.playerPoison, event.tick)
      : null;
  const immunityDisableTicks = envenomedPoisonImmunityDisableTicks(rt.input.league);
  if (!source && (rt.input.targetPoisonImmune !== true || immunityDisableTicks <= 0)) return;
  const occurrence: PlayerPoisonLandOccurrence = {
    occurrenceProbability: statefulOccurrenceProbability(event),
    expectedOccurrences: expectedStatefulOccurrences(event),
    applicationSuccessProbability: source
      ? statefulProcSuccessProbability(event, source.procChance)
      : 0,
    applicationSuccessMultiplicity: source
      ? poisonSuccessMultiplicity(event, source.procChance)
      : { kind: "single" },
    immunityDisabledUntilTick: event.tick + immunityDisableTicks,
  };
  const applied = applyPlayerPoisonLandOccurrence(rt, event.tick, source, occurrence);
  accountPlayerPoisonHits(rt.analysis, event, applied.expectedApplicationHits);
}

export function applyPoisonLandEffects(
  rt: SimulationRuntime,
  event: ScheduledEvent<SimulationRuntime>,
  damage: ResolvedDamage,
): void {
  applyPlayerPoisonOnLand(rt, event, damage);
  applyEvolvingToxinOnLand(rt, event, damage);
}
