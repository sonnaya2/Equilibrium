/**
 * Single source for Icy Tempest damage bands, requirement, and adrenaline spend.
 * Resolves from a discrete Primordial Ice distribution; never floors E[stacks].
 */
import { resolveSpecialAttackAdrenalineCost } from "../../shared/ringOfVigour";
import {
  ICY_TEMPEST_COST_PCT,
  ICY_TEMPEST_COST_REDUCTION_PER_STACK,
  ICY_TEMPEST_PRIMARY_BAND,
  ICY_TEMPEST_SECONDARY_BAND,
  ICY_TEMPEST_STACK_BAND,
  PRIMORDIAL_ICE_CAP,
  icyTempestSpend as icyTempestSpendInteger,
} from "./effects";
import {
  PRIMORDIAL_ICE_BINS,
  type PrimordialIceDistribution,
  expirePrimordialIce,
} from "./primordialIce";

export interface IcyTempestHitBand {
  band: { minPct: number; maxPct: number };
}

export interface IcyTempestOutcome {
  readonly probability: number;
  readonly stacksConsumed: number;
  readonly requirement: number;
  readonly spend: number;
  readonly hits: readonly IcyTempestHitBand[];
  readonly postCastPrimordialIce: PrimordialIceDistribution;
}

export interface ResolvedIcyTempest {
  readonly requirement: number;
  readonly outcomes: readonly IcyTempestOutcome[];
  readonly expectedSpend: number;
  readonly expectedStacks: number;
}

export function icyTempestBaseSpend(stacks: number): number {
  return icyTempestSpendInteger(stacks);
}

export function icyTempestHitsLinear(stacks: number): IcyTempestHitBand[] {
  const n = Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, stacks));
  const addMin = ICY_TEMPEST_STACK_BAND.minPct * n;
  const addMax = ICY_TEMPEST_STACK_BAND.maxPct * n;
  return [
    {
      band: {
        minPct: ICY_TEMPEST_PRIMARY_BAND.minPct + addMin,
        maxPct: ICY_TEMPEST_PRIMARY_BAND.maxPct + addMax,
      },
    },
    {
      band: {
        minPct: ICY_TEMPEST_SECONDARY_BAND.minPct + addMin,
        maxPct: ICY_TEMPEST_SECONDARY_BAND.maxPct + addMax,
      },
    },
  ];
}

export function icyTempestSpendAfterVigour(stacks: number, ringOfVigour: boolean): number {
  const base = icyTempestBaseSpend(stacks);
  if (!(base > 0)) return 0;
  return resolveSpecialAttackAdrenalineCost(base, ringOfVigour);
}

export function icyTempestRequirement(ringOfVigour: boolean): number {
  return resolveSpecialAttackAdrenalineCost(ICY_TEMPEST_COST_PCT, ringOfVigour);
}

export function resolveIcyTempest(
  dist: PrimordialIceDistribution,
  tick: number,
  ringOfVigour: boolean,
): ResolvedIcyTempest {
  const live = expirePrimordialIce(dist, tick);
  const requirement = icyTempestRequirement(ringOfVigour);
  const outcomesByKey = new Map<string, IcyTempestOutcome>();
  let expectedSpend = 0;
  let expectedStacks = 0;
  const atoms =
    live.atoms.length > 0
      ? live.atoms
      : [{ weight: 1, stacks: 0, stacksExpireAtTick: 0, frostbladesExpireAtTick: 0 }];
  for (const atom of atoms) {
    if (!(atom.weight > 0)) continue;
    const stacksConsumed = Math.max(0, Math.min(PRIMORDIAL_ICE_CAP, Math.floor(atom.stacks)));
    const spend = icyTempestSpendAfterVigour(stacksConsumed, ringOfVigour);
    const hits = icyTempestHitsLinear(stacksConsumed);
    const postCastPrimordialIce: PrimordialIceDistribution = {
      atoms: [
        {
          weight: 1,
          stacks: 0,
          stacksExpireAtTick: 0,
          frostbladesExpireAtTick: atom.frostbladesExpireAtTick,
        },
      ],
    };
    const outcome: IcyTempestOutcome = {
      probability: atom.weight,
      stacksConsumed,
      requirement,
      spend,
      hits,
      postCastPrimordialIce,
    };
    const key = JSON.stringify([
      stacksConsumed,
      requirement,
      spend,
      hits,
      postCastPrimordialIce,
    ]);
    const prior = outcomesByKey.get(key);
    outcomesByKey.set(
      key,
      prior ? { ...prior, probability: prior.probability + atom.weight } : outcome,
    );
    expectedSpend += spend * atom.weight;
    expectedStacks += stacksConsumed * atom.weight;
  }

  return {
    requirement,
    outcomes: [...outcomesByKey.values()].sort(
      (a, b) =>
        a.stacksConsumed - b.stacksConsumed ||
        a.spend - b.spend ||
        a.probability - b.probability,
    ),
    expectedSpend,
    expectedStacks,
  };
}

export { icyTempestSpendInteger as icyTempestSpendFromStacks };

export const ICY_TEMPEST_BASE_SPEND_BY_STACKS: readonly number[] = Array.from(
  { length: PRIMORDIAL_ICE_BINS },
  (_, n) => Math.max(0, ICY_TEMPEST_COST_PCT - ICY_TEMPEST_COST_REDUCTION_PER_STACK * n),
);
