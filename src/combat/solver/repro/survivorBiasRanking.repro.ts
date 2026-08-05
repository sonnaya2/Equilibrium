/**
 * Engine fixture: substantial residual branch mass from real mechanics.
 *
 * Survivor-bias ranking risk: when residualWeight > 0, totalExpected is
 * E[D|concrete] (weight-normalized over expanded terminals only). Using that
 * number as if it were unit-mass E[D] overstates known-mass damage by
 * ~1/concreteMass. Residual is disclosed on rng; product scoreSummary hard-fails
 * residual, but exploratory / short-horizon paths may still rank on E[D|concrete].
 *
 * Mechanics: dual Leng + Icy Tempest bar + Impatient 4 L20 + Relentless 5 L20.
 * Residual is live-branch-cap discard (MAX_LIVE_BRANCHES=64), not mock weight.
 *
 * Measured (deterministic engine, legal revo bar, 2026-08):
 *   primary 100t: residualFraction ~0.772, concreteMass ~0.228
 *   extreme 150t: residualFraction ~0.956, concreteMass ~0.044
 *   user clean (no Imp/Rel): residual 0, unit-mass, known-mass ~69775
 *
 * Run:
 *   npx vitest run src/combat/solver/repro
 */
import { activeEquipmentEffects } from "../../shared/equipment";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { baseInput } from "../../test/fixtures/inputs";
import type { SimulateInput, RotationSummary } from "../../engine/simulation/contracts";
import {
  simulateRevolution,
  type RevolutionInput,
} from "../../engine/simulation/revolution";

/**
 * Dual-Leng revo bar that expands Impatient/Relentless into residual.
 * No auto-attack ids - legal for evaluateRevolutionBar / candidate pool.
 * Measured residual at 100t with Imp4 L20 + Rel5 L20: ~0.77 concrete ~0.23.
 * (Bar with auto `attack` reaches ~0.85 residual but is not pool-legal.)
 */
export const SURVIVOR_BIAS_BAR_IDS = [
  "icy_tempest",
  "assault",
  "fury",
  "dismember",
] as const;

/** Primary fixture horizon: residual ~77%+ with concrete mass ~0.23. */
export const SURVIVOR_BIAS_DURATION_TICKS = 100;

/** Extreme horizon: residual closer to unit (concrete mass shrinks further). */
export const SURVIVOR_BIAS_EXTREME_DURATION_TICKS = 150;

export type SurvivorBiasFixtureKind = "primary" | "extreme";

export interface SurvivorBiasFixture {
  readonly kind: SurvivorBiasFixtureKind;
  readonly label: string;
  readonly barIds: readonly string[];
  readonly durationTicks: number;
  readonly revoInput: RevolutionInput;
}

export interface ResidualMassStats {
  readonly label: string;
  readonly ok: boolean;
  /** Expanded terminal mass (success + fail banked). */
  readonly concreteMass: number;
  /** Alias of concreteMass on production summaries. */
  readonly probabilityMass: number;
  /** Cap-discarded mass; residual + concrete ~ 1 when conserved. */
  readonly residualWeight: number;
  /** residualWeight / (concreteMass + residualWeight). */
  readonly residualFraction: number;
  readonly conservedMass: number;
  readonly totalsBasis: string | undefined;
  readonly exactness: string | undefined;
  /**
   * Primary totalExpected from the summary (unit-mass EV or known-mass contribution).
   * Under residual this is known-mass, never the conditional mean alone.
   */
  readonly totalExpected: number;
  /** E[D|concrete] diagnostic (weight-normalized over expanded terminals). */
  readonly conditionalConcreteMean: number;
  /**
   * knownMassExpectedDamage = concreteMass * conditionalConcreteMean.
   * Equals totalExpected when residual > 0 under Phase 2 semantics.
   */
  readonly knownMassDamage: number;
  /** conditionalConcreteMean / knownMassDamage when residual > 0 (~ 1/concreteMass). */
  readonly survivorRenormFactor: number;
  readonly terminalClasses: number | undefined;
  readonly failedWeight: number;
  readonly successfulWeight: number | undefined;
  readonly totalMin: number;
  readonly totalMax: number;
  readonly dps: number;
  readonly summary: RotationSummary;
}

/**
 * Documented primary measurement band (legal revo bar, score-only).
 * Re-measure if MAX_LIVE_BRANCHES or merge keys change.
 * See survivorBiasEngine.repro.test.ts for live asserts.
 */
export const PRIMARY_MEASURED = {
  residualFractionMin: 0.5,
  residualFractionApprox: 0.7717,
  concreteMassApprox: 0.2283,
  totalExpectedApprox: 70048,
  knownMassDamageApprox: 15990,
  totalsBasis: "concrete-terminals" as const,
  exactness: "approximated" as const,
} as const;

/** Residual-free baseline: same bar/gear, no Impatient/Relentless. */
export const USER_CLEAN_MEASURED = {
  residualWeight: 0,
  totalsBasis: "unit-mass" as const,
  totalExpectedApprox: 69775,
} as const;

function lengEquipment(): Pick<
  SimulateInput,
  "equipmentIds" | "equipmentEffects" | "weaponConfiguration" | "context"
> {
  return {
    equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
    equipmentEffects: activeEquipmentEffects({
      style: "melee",
      equipmentSlots: {
        mainhand: "item:dark-shard-of-leng",
        offhand: "item:dark-sliver-of-leng",
      },
    }),
    weaponConfiguration: "dualwield",
    context: { style: "melee" },
  };
}

function barFromIds(ids: readonly string[]): AbilitySpec[] {
  const byId = new Map(MELEE_ABILITIES.map((a) => [a.id, a]));
  const bar: AbilitySpec[] = [];
  for (const id of ids) {
    const ability = byId.get(id);
    if (!ability) {
      throw new Error(`survivorBiasRanking.repro: unknown ability id ${id}`);
    }
    bar.push(ability);
  }
  return bar;
}

function buildRevoInput(opts: {
  barIds: readonly string[];
  durationTicks: number;
}): RevolutionInput {
  return {
    ...baseInput,
    ...lengEquipment(),
    abilities: MELEE_ABILITIES,
    style: "melee",
    bar: barFromIds(opts.barIds),
    durationTicks: opts.durationTicks,
    startingAdrenaline: 100,
    adrenaline: {
      impatientRank: 4,
      impatientLevel20: true,
      relentlessRank: 5,
      relentlessLevel20: true,
    },
  };
}

/** Dual Leng + Icy Tempest + Impatient/Relentless; residual fraction ~0.85 at 100t. */
export function survivorBiasPrimaryFixture(): SurvivorBiasFixture {
  const barIds = SURVIVOR_BIAS_BAR_IDS;
  const durationTicks = SURVIVOR_BIAS_DURATION_TICKS;
  return {
    kind: "primary",
    label: "leng-icy-imp-rel-revo-100t",
    barIds,
    durationTicks,
    revoInput: buildRevoInput({ barIds, durationTicks }),
  };
}

/** Same loadout, 150t horizon; residual fraction ~0.98. */
export function survivorBiasExtremeFixture(): SurvivorBiasFixture {
  const barIds = SURVIVOR_BIAS_BAR_IDS;
  const durationTicks = SURVIVOR_BIAS_EXTREME_DURATION_TICKS;
  return {
    kind: "extreme",
    label: "leng-icy-imp-rel-revo-150t",
    barIds,
    durationTicks,
    revoInput: buildRevoInput({ barIds, durationTicks }),
  };
}

export function measureResidualStats(
  fixture: SurvivorBiasFixture,
  options?: { detailLevel?: "score-only" | "summary" | "full-analysis" },
): ResidualMassStats {
  const summary = simulateRevolution(fixture.revoInput, {
    detailLevel: options?.detailLevel ?? "score-only",
  });
  return residualStatsFromSummary(fixture.label, summary);
}

export function residualStatsFromSummary(
  label: string,
  summary: RotationSummary,
): ResidualMassStats {
  const concreteMass =
    summary.damage?.concreteMass ??
    summary.rng?.concreteMass ??
    summary.rng?.probabilityMass ??
    0;
  const probabilityMass = summary.rng?.probabilityMass ?? concreteMass;
  const residualWeight =
    summary.damage?.residualMass ?? summary.rng?.residualWeight ?? 0;
  const conservedMass = concreteMass + residualWeight;
  const residualFraction = conservedMass > 0 ? residualWeight / conservedMass : 0;
  const totalExpected = summary.totalExpected;
  // Prefer engine-named fields; never double-scale totalExpected * concreteMass.
  const knownMassDamage =
    summary.damage?.knownMassExpectedDamage ??
    (residualWeight > 1e-9 ? totalExpected : totalExpected);
  const conditionalConcreteMean =
    summary.damage?.conditionalConcreteMean ??
    (concreteMass > 1e-9 && residualWeight > 1e-9
      ? knownMassDamage / concreteMass
      : totalExpected);
  const survivorRenormFactor =
    knownMassDamage > 0 ? conditionalConcreteMean / knownMassDamage : Number.POSITIVE_INFINITY;

  return {
    label,
    ok: summary.ok,
    concreteMass,
    probabilityMass,
    residualWeight,
    residualFraction,
    conservedMass,
    totalsBasis: summary.rng?.totalsBasis ?? summary.damage?.scope,
    exactness: summary.rng?.exactness,
    totalExpected,
    conditionalConcreteMean,
    knownMassDamage,
    survivorRenormFactor,
    terminalClasses: summary.rng?.terminalClasses,
    failedWeight: summary.failure?.failedWeight ?? summary.rng?.failedWeight ?? 0,
    successfulWeight: summary.failure?.successfulWeight,
    totalMin: summary.totalMin,
    totalMax: summary.totalMax,
    dps: summary.dps,
    summary,
  };
}
