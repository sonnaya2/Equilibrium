import { resolveHostDamageInstance } from "../../core/hostDamage";
import { resolveLeagueAttachedTerms, type LeagueAttachedTerm } from "../../league/damage";
import {
  PLAYER_POISON_EFFECT_ID,
  activeEvolvingToxinStacks,
  evolvingToxinPoisonModifier,
  playerPoisonDamage,
  type PoisonDamageBand,
} from "../../poison/mechanics";
import { runPipeline } from "../../pipeline/modifierPipeline";
import { contextWithProvenance } from "../../shared/damageProvenance";
import { isRangedAmmoActive } from "../../styles/ranged/ammoModel";
import type { CombatModifier } from "../../types";
import { abilityDamageAt } from "../resolution/castHit";
import type { ScheduledEvent } from "../runtime/events";
import type { SimulationRuntime } from "../runtime/runtime";
import type { TargetWeaponPoisonHitMultiplicity, TargetWeaponPoisonState } from "../runtime/state";
import { keepsAnalysisLedgers } from "../simulation/contracts";

export interface PlayerPoisonEventOrder {
  tick: number;
  seq: number;
}

export interface PlayerPoisonLandOccurrence {
  occurrenceProbability: number;
  expectedOccurrences: number;
  applicationSuccessProbability: number;
  applicationSuccessMultiplicity: TargetWeaponPoisonHitMultiplicity;
  immunityDisabledUntilTick: number;
}

export interface PlayerPoisonLandResult {
  expectedAttempts: number;
  expectedSuccesses: number;
  expectedApplicationHits: number;
}

export function recordPlayerPoisonApplication(
  rt: SimulationRuntime,
  kind: "attempt" | "success",
  amount = 1,
): void {
  if (!keepsAnalysisLedgers(rt.detailLevel) || !(amount > 0)) return;
  const existing = rt.analysis.effects.get(PLAYER_POISON_EFFECT_ID);
  const ledger = existing ?? {
    id: PLAYER_POISON_EFFECT_ID,
    kind: "player-poison" as const,
    totalDamage: 0,
    directDamage: 0,
    dotDamage: 0,
    criticalContribution: 0,
    capLoss: 0,
    expectedCasts: 0,
    expectedTriggerRolls: 0,
    expectedActivations: 0,
    expectedSeparateHits: 0,
    expectedAttachedComponents: 0,
    expectedPlayerPoisonHits: 0,
    bonusDamage: 0,
  };
  if (kind === "success") ledger.expectedActivations += amount;
  else ledger.expectedTriggerRolls += amount;
  rt.analysis.effects.set(PLAYER_POISON_EFFECT_ID, ledger);
}

function recordPlayerPoisonContinuationHits(rt: SimulationRuntime, amount: number): void {
  if (!keepsAnalysisLedgers(rt.detailLevel) || !(amount > 0)) return;
  const ledger = rt.analysis.effects.get(PLAYER_POISON_EFFECT_ID);
  if (ledger) ledger.expectedPlayerPoisonHits += amount;
}

export function recordPlayerPoisonContinuation(
  rt: SimulationRuntime,
  attempts: number,
  activations: number,
  hits: number,
): void {
  if (keepsAnalysisLedgers(rt.detailLevel)) {
    rt.analysis.playerPoisonContinuationAttempts += attempts;
    rt.analysis.playerPoisonContinuationActivations += activations;
  }
  recordPlayerPoisonApplication(rt, "attempt", attempts);
  recordPlayerPoisonApplication(rt, "success", activations);
  recordPlayerPoisonContinuationHits(rt, hits);
}

export interface ResolvedPlayerPoisonAttached {
  term: LeagueAttachedTerm;
  damage: PoisonDamageBand;
}

export interface ResolvedPlayerPoisonHit {
  host: PoisonDamageBand;
  attached: readonly ResolvedPlayerPoisonAttached[];
}

function poisonBandDelta(after: PoisonDamageBand, before: PoisonDamageBand): PoisonDamageBand {
  return {
    min: after.min - before.min,
    expected: after.expected - before.expected,
    max: after.max - before.max,
  };
}

export function resolvePlayerPoison(
  rt: SimulationRuntime,
  poison: TargetWeaponPoisonState,
  atTick: number,
  decayIndex: number,
): ResolvedPlayerPoisonHit {
  const toxin = rt.state.target.evolvingToxin;
  const stacks = activeEvolvingToxinStacks(toxin.stacks, toxin.expiresAtTick, atTick);
  const baseAbilityDamage = abilityDamageAt(rt, atTick);
  const attachedTerms = rt.input.league
    ? resolveLeagueAttachedTerms({
        rules: rt.input.league,
        source: { kind: "player_poison" },
        landTick: atTick,
        abilityBase: baseAbilityDamage,
      })
    : [];
  const cacheKey = [
    baseAbilityDamage,
    poison.effectiveTier,
    decayIndex,
    poison.sourceDamageMultiplier,
    stacks,
    attachedTerms.map((term) => `${term.id}:${term.amount}`).join(","),
  ].join("\x1f");
  const cached = rt.playerPoisonDamageCache.get(cacheKey) as ResolvedPlayerPoisonHit | undefined;
  if (cached) return cached;

  const baseBand = playerPoisonDamage(baseAbilityDamage, poison.effectiveTier, decayIndex, 1);
  const configured =
    rt.input.playerPoisonModifiers ??
    (() => {
      const ability = rt.byId.values().next().value;
      return typeof rt.input.modifiers === "function"
        ? ability
          ? rt.input.modifiers(ability)
          : []
        : (rt.input.modifiers ?? []);
    })();
  const modifiers: CombatModifier[] = configured.filter(
    (modifier) => modifier.appliesToPlayerPoison === true,
  );
  const toxinModifier = isRangedAmmoActive(
    rt.input.ammo,
    rt.input.context?.style,
    rt.input.equipmentIds,
  )
    ? evolvingToxinPoisonModifier(stacks)
    : null;
  if (toxinModifier) modifiers.push(toxinModifier);
  const provenance = { kind: "player_poison" as const };
  const context = contextWithProvenance(
    {
      ...(rt.input.context ?? { style: "melee" as const }),
      dotKind: "poison",
      damageSource: "dot",
      provenance,
    },
    provenance,
  );
  const apply = (damage: number) => runPipeline({ damage }, modifiers, context).damage;
  const applyBand = (band: PoisonDamageBand): PoisonDamageBand =>
    modifiers.length === 0
      ? band
      : {
          min: apply(band.min),
          expected: apply(band.expected),
          max: apply(band.max),
        };
  const resolveBand = (band: PoisonDamageBand): PoisonDamageBand =>
    applyBand({
      min: band.min * poison.sourceDamageMultiplier,
      expected: band.expected * poison.sourceDamageMultiplier,
      max: band.max * poison.sourceDamageMultiplier,
    });
  const composed = resolveHostDamageInstance(
    { host: baseBand, attached: attachedTerms },
    {
      add: (host, amount) => ({
        min: host.min + amount,
        expected: host.expected + amount,
        max: host.max + amount,
      }),
      resolve: resolveBand,
      delta: poisonBandDelta,
    },
  );
  const resolved: ResolvedPlayerPoisonHit = {
    host: composed.hostDamage,
    attached: composed.attached.map(({ term, damage }) => ({ term, damage })),
  };
  rt.playerPoisonDamageCache.set(cacheKey, resolved);
  return resolved;
}

export function playerPoisonPrecedes(
  poison: PlayerPoisonEventOrder | undefined,
  event: ScheduledEvent<SimulationRuntime> | undefined,
): boolean {
  return (
    poison !== undefined &&
    (event === undefined ||
      poison.tick < event.tick ||
      (poison.tick === event.tick && poison.seq < event.seq))
  );
}
