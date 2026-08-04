/**
 * Single source for Icy Tempest damage bands, requirement, and adrenaline spend.
 * Resolves from a discrete Primordial Ice distribution — never floors E[stacks].
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
  expectedStacksFromMass,
  type PrimordialIceDistribution,
  expirePrimordialIce,
} from "./primordialIce";

export interface IcyTempestHitBand {
  band: { minPct: number; maxPct: number };
}

export interface IcyTempestSpendGroup {
  readonly spend: number;
  readonly probability: number;
  readonly expectedStacks: number;
}

export interface ResolvedIcyTempest {
  readonly requirement: number;
  readonly expectedSpend: number;
  readonly spendDistribution: readonly IcyTempestSpendGroup[];
  readonly expectedHits: readonly IcyTempestHitBand[];
  readonly stackMassConsumed: readonly number[];
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
  const mass = live.stackMass;
  const eStacks = expectedStacksFromMass(mass);

  const groups = new Map<number, { prob: number; eStacks: number }>();
  for (let s = 0; s <= PRIMORDIAL_ICE_CAP; s++) {
    const p = mass[s] ?? 0;
    if (!(p > 0)) continue;
    const spend = icyTempestSpendAfterVigour(s, ringOfVigour);
    const g = groups.get(spend);
    if (g) {
      g.prob += p;
      g.eStacks += s * p;
    } else {
      groups.set(spend, { prob: p, eStacks: s * p });
    }
  }

  const spendDistribution: IcyTempestSpendGroup[] = [];
  let expectedSpend = 0;
  for (const [spend, g] of groups) {
    const probability = g.prob;
    const expectedStacks = probability > 0 ? g.eStacks / probability : 0;
    spendDistribution.push({ spend, probability, expectedStacks });
    expectedSpend += spend * probability;
  }
  spendDistribution.sort((a, b) => b.spend - a.spend || b.probability - a.probability);

  if (spendDistribution.length === 0) {
    spendDistribution.push({
      spend: icyTempestSpendAfterVigour(0, ringOfVigour),
      probability: 1,
      expectedStacks: 0,
    });
    expectedSpend = spendDistribution[0]!.spend;
  }

  const stackMassConsumed =
    mass.length === PRIMORDIAL_ICE_BINS
      ? mass
      : (() => {
          const out = new Array<number>(PRIMORDIAL_ICE_BINS).fill(0);
          for (let i = 0; i < Math.min(mass.length, PRIMORDIAL_ICE_BINS); i++) out[i] = mass[i]!;
          if (out.every((x) => !(x > 0))) out[0] = 1;
          return out;
        })();

  return {
    requirement: icyTempestRequirement(ringOfVigour),
    expectedSpend,
    spendDistribution,
    expectedHits: icyTempestHitsLinear(eStacks),
    stackMassConsumed,
    expectedStacks: eStacks,
  };
}

export { icyTempestSpendInteger as icyTempestSpendFromStacks };

export const ICY_TEMPEST_BASE_SPEND_BY_STACKS: readonly number[] = Array.from(
  { length: PRIMORDIAL_ICE_BINS },
  (_, n) => Math.max(0, ICY_TEMPEST_COST_PCT - ICY_TEMPEST_COST_REDUCTION_PER_STACK * n),
);
