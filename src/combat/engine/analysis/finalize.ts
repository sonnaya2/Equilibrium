import type {
  DamageEffectBreakdown,
  DamageEffectGroupBreakdown,
  DamageEffectSourceBreakdown,
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
  "target-status",
  "other-modeled",
];

const GRASP_GROUP_ID = "grasp-of-guthix";
const GRASP_CHILD_IDS = new Set(["grasp-of-guthix-max-life", "grasp-of-guthix-poison"]);
const GRASP_BIG_BONED_ID = "grasp-of-guthix-big-boned";

function mergeSourceBreakdowns(
  rows: readonly DamageEffectSourceBreakdown[],
): DamageEffectSourceBreakdown[] {
  const merged = new Map<string, DamageEffectSourceBreakdown>();
  for (const row of rows) {
    const current = merged.get(row.blessingId) ?? {
      blessingId: row.blessingId,
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
      averagePerActivation: 0,
    };
    current.totalDamage += row.totalDamage;
    current.directDamage += row.directDamage;
    current.dotDamage += row.dotDamage;
    current.criticalContribution += row.criticalContribution;
    current.capLoss += row.capLoss;
    current.expectedCasts += row.expectedCasts;
    current.expectedTriggerRolls += row.expectedTriggerRolls;
    current.expectedActivations += row.expectedActivations;
    current.expectedSeparateHits += row.expectedSeparateHits;
    current.expectedAttachedComponents += row.expectedAttachedComponents;
    current.expectedPlayerPoisonHits += row.expectedPlayerPoisonHits;
    current.bonusDamage += row.bonusDamage;
    current.averagePerActivation =
      current.expectedActivations > 0 ? current.totalDamage / current.expectedActivations : 0;
    merged.set(row.blessingId, current);
  }
  return [...merged.values()].sort((a, b) => b.totalDamage - a.totalDamage);
}

export function graspGroupFromEffects(
  byEffect: readonly DamageEffectBreakdown[],
  totalExpected: number,
): DamageEffectGroupBreakdown[] {
  const children = byEffect.filter(
    (row) => row.analysisGroupId === GRASP_GROUP_ID && GRASP_CHILD_IDS.has(row.id),
  );
  if (children.length === 0) return [];

  const attachedDamage = children.reduce((sum, row) => sum + row.bonusDamage, 0);
  const attachedActivations = children.reduce(
    (sum, row) => sum + row.expectedAttachedComponents,
    0,
  );
  const attachedSource: DamageEffectSourceBreakdown | undefined =
    attachedDamage > 0
      ? {
          blessingId: "big-boned",
          totalDamage: attachedDamage,
          directDamage: attachedDamage,
          dotDamage: 0,
          criticalContribution: 0,
          capLoss: 0,
          expectedCasts: 0,
          expectedTriggerRolls: 0,
          expectedActivations: attachedActivations,
          expectedSeparateHits: 0,
          expectedAttachedComponents: attachedActivations,
          expectedPlayerPoisonHits: 0,
          bonusDamage: 0,
          averagePerActivation: attachedActivations > 0 ? attachedDamage / attachedActivations : 0,
        }
      : undefined;
  const componentRows = children.map((row) => ({
    ...row,
    bonusDamage: 0,
    expectedAttachedComponents: 0,
  }));
  if (attachedSource) {
    componentRows.push({
      id: GRASP_BIG_BONED_ID,
      kind: "league-blessing",
      totalDamage: attachedDamage,
      share: totalExpected > 0 ? attachedDamage / totalExpected : 0,
      expectedCasts: 0,
      expectedTriggerRolls: 0,
      expectedActivations: attachedActivations,
      expectedSeparateHits: 0,
      expectedAttachedComponents: attachedActivations,
      expectedPlayerPoisonHits: 0,
      bonusDamage: 0,
      averagePerActivation: attachedSource.averagePerActivation,
      sourceBreakdown: [attachedSource],
      directDamage: attachedDamage,
      dotDamage: 0,
      criticalContribution: 0,
      capLoss: 0,
    });
  }

  const totalDamage = children.reduce((sum, row) => sum + row.totalDamage, 0) + attachedDamage;
  const sources = mergeSourceBreakdowns([
    ...children.flatMap((row) => row.sourceBreakdown ?? []),
    ...(attachedSource ? [attachedSource] : []),
  ]);
  const expectedActivations = Math.max(...children.map((row) => row.analysisGroupActivations ?? 0));
  return [
    {
      id: GRASP_GROUP_ID,
      kind: "league-blessing",
      totalDamage,
      share: totalExpected > 0 ? totalDamage / totalExpected : 0,
      expectedActivations,
      expectedSeparateHits: children.reduce((sum, row) => sum + row.expectedSeparateHits, 0),
      expectedAttachedComponents: attachedActivations,
      ...(sources.length > 0 ? { sourceBreakdown: sources } : {}),
      directDamage: children.reduce((sum, row) => sum + row.directDamage, 0) + attachedDamage,
      dotDamage: children.reduce((sum, row) => sum + row.dotDamage, 0),
      criticalContribution: children.reduce((sum, row) => sum + row.criticalContribution, 0),
      capLoss: children.reduce((sum, row) => sum + row.capLoss, 0),
      components: componentRows,
    },
  ];
}

/** Format runtime ledgers into the public analysis summary. */
export function finalizeAnalysis(
  analysis: RuntimeAnalysisState,
  totalExpected: number,
): RotationDamageAnalysis {
  const byEffect = [...analysis.effects.values()]
    .map((ledger): DamageEffectBreakdown => {
      const activations = ledger.expectedActivations;
      const sourceBreakdown = ledger.sources
        ? [...ledger.sources.values()]
            .filter((source) => source.totalDamage !== 0 || source.expectedActivations !== 0)
            .map((source): DamageEffectSourceBreakdown => ({
              blessingId: source.blessingId,
              totalDamage: source.totalDamage,
              directDamage: source.directDamage,
              dotDamage: source.dotDamage,
              criticalContribution: source.criticalContribution,
              capLoss: source.capLoss,
              expectedCasts: source.expectedCasts,
              expectedTriggerRolls: source.expectedTriggerRolls,
              expectedActivations: source.expectedActivations,
              expectedSeparateHits: source.expectedSeparateHits,
              expectedAttachedComponents: source.expectedAttachedComponents,
              expectedPlayerPoisonHits: source.expectedPlayerPoisonHits,
              bonusDamage: source.bonusDamage,
              averagePerActivation:
                source.expectedActivations > 0
                  ? source.totalDamage / source.expectedActivations
                  : 0,
            }))
            .sort((a, b) => b.totalDamage - a.totalDamage)
        : undefined;
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
        ...(sourceBreakdown && sourceBreakdown.length > 0 ? { sourceBreakdown } : {}),
        directDamage: ledger.directDamage,
        dotDamage: ledger.dotDamage,
        criticalContribution: ledger.criticalContribution,
        capLoss: ledger.capLoss,
        ...(ledger.minimumDamage !== undefined ? { minimumDamage: ledger.minimumDamage } : {}),
        ...(ledger.maximumDamage !== undefined ? { maximumDamage: ledger.maximumDamage } : {}),
        ...(ledger.analysisGroupId ? { analysisGroupId: ledger.analysisGroupId } : {}),
        ...(ledger.analysisGroupActivations !== undefined
          ? { analysisGroupActivations: ledger.analysisGroupActivations }
          : {}),
      };
    })
    .sort((a, b) => b.totalDamage - a.totalDamage);
  return {
    bySource: SOURCE_KINDS.flatMap((kind) => {
      const damage = analysis.sources.get(kind) ?? 0;
      return damage > 0 ? [{ kind, damage }] : [];
    }).sort((a, b) => b.damage - a.damage),
    byEffect,
    groups: graspGroupFromEffects(byEffect, totalExpected),
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
