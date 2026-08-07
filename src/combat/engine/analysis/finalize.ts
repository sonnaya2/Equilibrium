import type {
  DamageEffectBreakdown,
  DamageSourceKind,
  RotationDamageAnalysis,
} from "../simulation/contracts";
import type { RuntimeAnalysisState } from "./contracts";

const SOURCE_KINDS: readonly DamageSourceKind[] = [
  "ability-direct",
  "ability-dot",
  "equipment-passive",
  "league-blessing",
  "perk",
  "conjure-or-familiar",
  "player-poison",
  "basic-attack",
  "auto-attack",
  "other-modeled",
];

/** Format runtime ledgers into the public analysis summary. */
export function finalizeAnalysis(
  analysis: RuntimeAnalysisState,
  totalExpected: number,
): RotationDamageAnalysis {
  return {
    bySource: SOURCE_KINDS.flatMap((kind) => {
      const damage = analysis.sources.get(kind) ?? 0;
      return damage > 0 ? [{ kind, damage }] : [];
    }).sort((a, b) => b.damage - a.damage),
    byEffect: [...analysis.effects.values()]
      .map((ledger): DamageEffectBreakdown => {
        const activations = ledger.expectedActivations;
        return {
          id: ledger.id,
          kind: ledger.kind,
          totalDamage: ledger.totalDamage,
          share: totalExpected > 0 ? ledger.totalDamage / totalExpected : 0,
          expectedCasts: ledger.expectedCasts,
          expectedTriggerRolls: ledger.expectedTriggerRolls,
          expectedActivations: activations,
          expectedSeparateHits: ledger.expectedSeparateHits,
          expectedAttachedComponents: ledger.expectedAttachedComponents,
          expectedPlayerPoisonHits: ledger.expectedPlayerPoisonHits,
          bonusDamage: ledger.bonusDamage,
          averagePerActivation: activations > 0 ? ledger.totalDamage / activations : 0,
          directDamage: ledger.directDamage,
          dotDamage: ledger.dotDamage,
          criticalContribution: ledger.criticalContribution,
          capLoss: ledger.capLoss,
          ...(ledger.minimumDamage !== undefined ? { minimumDamage: ledger.minimumDamage } : {}),
          ...(ledger.maximumDamage !== undefined ? { maximumDamage: ledger.maximumDamage } : {}),
        };
      })
      .sort((a, b) => b.totalDamage - a.totalDamage),
    directDamage: analysis.directDamage,
    dotDamage: analysis.dotDamage,
    criticalContribution: analysis.criticalContribution,
    capLoss: analysis.capLoss,
  };
}

/** Floating-point reconciliation of analysis totals against the headline figure. */
export function analysisReconciles(
  analysis: RotationDamageAnalysis,
  totalExpected: number,
  tolerance = 1e-6,
): boolean {
  const byEffect = analysis.byEffect.reduce((sum, row) => sum + row.totalDamage, 0);
  const bySource = analysis.bySource.reduce((sum, row) => sum + row.damage, 0);
  const directDot = analysis.directDamage + analysis.dotDamage;
  return (
    Math.abs(byEffect - totalExpected) <= tolerance * Math.max(1, Math.abs(totalExpected)) &&
    Math.abs(bySource - totalExpected) <= tolerance * Math.max(1, Math.abs(totalExpected)) &&
    Math.abs(directDot - totalExpected) <= tolerance * Math.max(1, Math.abs(totalExpected))
  );
}
