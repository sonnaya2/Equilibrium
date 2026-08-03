import type { AbilitySpec } from "../../pipeline/calculateAbility";
import type { CastRecord, RotationSummary } from "./contracts";

/**
 * Engine-owned, UI-neutral classification of why a Revolution ultimate never
 * (or rarely) cast. Reconstructs from the cast log only — no hidden adren
 * reservation and no mutation of Revolution policy.
 */

export interface PrioritySteal {
  tick: number;
  abilityId: string;
  adrenalineBefore: number;
  barIndex: number;
}

export interface UltimateStarvationReport {
  ultimateId: string;
  barIds: readonly string[];
  ultimateBarIndex: number;
  ultimateCost: number;
  castTicks: number[];
  castCount: number;
  firstCastTick: number | null;
  secondCastTick: number | null;
  minGapTicks: number | null;
  /** Peak adrenaline observed on any cast (before). */
  maxAdrenalineBefore: number;
  /** Higher-priority bar entries that fired while adren >= ultimate cost. */
  prioritySteals: PrioritySteal[];
  /** Higher-priority non-auto casts (any cost) that ran during the horizon. */
  higherPrioritySpends: number;
  /**
   * Ultimate never cast, was on the scanned bar, and higher-priority bar slots
   * prevented it: either stole GCDs at full affordability, or drained adren so
   * the ultimate cost was never reached (strict priority, no adren banking).
   */
  priorityStarved: boolean;
  /**
   * Ultimate never cast, on bar, with no higher-priority spends observed.
   * Suspect horizon/CD/rebuild issues rather than bar order.
   */
  unexplainedMiss: boolean;
  /** True when the ultimate id is absent from the scanned bar. */
  outsideManagedBar: boolean;
}

function costOfSpec(ability: AbilitySpec | undefined, fallback: number): number {
  return ability?.adrenaline?.cost ?? fallback;
}

/**
 * Classify ultimate cast outcomes for one Revolution summary.
 * `bar` is the exact ability list passed to `simulateRevolution` (managed prefix).
 */
export function diagnoseUltimateStarvation(
  summary: Pick<RotationSummary, "casts">,
  bar: readonly AbilitySpec[],
  ultimateId: string,
  opts?: { ultimateCost?: number },
): UltimateStarvationReport {
  const barIds = bar.map((a) => a.id);
  const ultimateBarIndex = barIds.indexOf(ultimateId);
  const ultimateSpec = ultimateBarIndex >= 0 ? bar[ultimateBarIndex] : undefined;
  const ultimateCost = opts?.ultimateCost ?? costOfSpec(ultimateSpec, 100);
  const higher = new Set(barIds.slice(0, Math.max(0, ultimateBarIndex)));

  const castTicks = summary.casts
    .filter((c) => c.abilityId === ultimateId)
    .map((c) => c.tick)
    .sort((a, b) => a - b);

  const prioritySteals: PrioritySteal[] = [];
  let maxAdrenalineBefore = 0;
  let higherPrioritySpends = 0;
  for (const cast of summary.casts) {
    maxAdrenalineBefore = Math.max(maxAdrenalineBefore, cast.adrenalineBefore);
    if (ultimateBarIndex < 0) continue;
    if (!higher.has(cast.abilityId)) continue;
    if (!cast.auto) higherPrioritySpends += 1;
    if (cast.adrenalineBefore < ultimateCost) continue;
    prioritySteals.push({
      tick: cast.tick,
      abilityId: cast.abilityId,
      adrenalineBefore: cast.adrenalineBefore,
      barIndex: barIds.indexOf(cast.abilityId),
    });
  }

  const castCount = castTicks.length;
  const firstCastTick = castCount > 0 ? castTicks[0]! : null;
  const secondCastTick = castCount > 1 ? castTicks[1]! : null;
  const minGapTicks =
    firstCastTick !== null && secondCastTick !== null ? secondCastTick - firstCastTick : null;
  const outsideManagedBar = ultimateBarIndex < 0;
  const drainedBelowCost =
    higherPrioritySpends > 0 && maxAdrenalineBefore < ultimateCost;
  const priorityStarved =
    castCount === 0 && !outsideManagedBar && (prioritySteals.length > 0 || drainedBelowCost);
  const unexplainedMiss =
    castCount === 0 && !outsideManagedBar && higherPrioritySpends === 0 && prioritySteals.length === 0;

  return {
    ultimateId,
    barIds,
    ultimateBarIndex,
    ultimateCost,
    castTicks,
    castCount,
    firstCastTick,
    secondCastTick,
    minGapTicks,
    maxAdrenalineBefore,
    prioritySteals,
    higherPrioritySpends,
    priorityStarved,
    unexplainedMiss,
    outsideManagedBar,
  };
}

/** Compact cast timeline for debug assertions. */
export function castTimeline(casts: readonly CastRecord[], limit = 40): string {
  return casts
    .slice(0, limit)
    .map((c) => `${c.abilityId}@${c.tick}:a${c.adrenalineBefore}->${c.adrenalineAfter}`)
    .join(" | ");
}
