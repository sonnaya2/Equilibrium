import { nextEvolvingToxin, resolvePoisonApplication } from "../../poison/mechanics";
import { capabilitiesOf } from "../../shared/damageProvenance";
import { envenomedPoisonImmunityDisableTicks } from "../../league/ruleset";
import {
  expectedStatefulOccurrences,
  statefulOccurrenceProbability,
  statefulProcSuccessProbability,
} from "../analysis/multiplicity";
import { accountPlayerPoisonHits } from "../analysis";
import type { ResolvedDamage } from "../resolution/types";
import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import { patchTarget, type TargetWeaponPoisonHitMultiplicity } from "../runtime/state";
import {
  applyPlayerPoisonLandOccurrence,
  type PlayerPoisonLandOccurrence,
} from "../schedulers/playerPoison";

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
  if (
    rt.input.ammo !== "bik" ||
    damage.expected <= 0 ||
    event.attached ||
    capabilitiesOf(event.provenance).canApplyEvolvingToxin !== true
  ) {
    return;
  }
  const toxin = rt.state.target.evolvingToxin;
  rt.state = patchTarget(rt.state, {
    evolvingToxin: nextEvolvingToxin(toxin.stacks, toxin.expiresAtTick, event.tick),
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
