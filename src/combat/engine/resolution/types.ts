import type { HitResult } from "../../pipeline/calculateHit";

export interface CriticalResolution {
  mode: "none" | "expected" | "guaranteed";
  chance: number;
  contribution: number;
  inherited?: boolean;
  outcome?: boolean;
}

export function packageCritical(
  chance: number,
  critExpected: number,
  nonCritExpected: number,
  opts?: { inherited?: boolean; outcome?: boolean; scale?: number },
): CriticalResolution {
  const scale = opts?.scale ?? 1;
  return {
    mode: chance >= 1 ? "guaranteed" : chance > 0 ? "expected" : "none",
    chance,
    contribution: Math.max(0, chance * (critExpected - nonCritExpected)) * scale,
    ...(opts?.inherited ? { inherited: true } : {}),
    ...(opts?.outcome === undefined ? {} : { outcome: opts.outcome }),
  };
}

export interface ResolvedDamage {
  min: number;
  max: number;
  expected: number;
  critExpected?: number;
  capLoss?: number;
  critical?: CriticalResolution;
}

export interface AttachedDamageComponent {
  id: string;
  damage: ResolvedDamage;
  hitDetail?: HitResult;
  attached: true;
  hitCapPolicy: "separate" | "shared";
  analysis?: {
    kind: "league-blessing";
    blessingId: string;
    bonusTargetId?: string;
    expectedActivations: number;
  };
}

export interface EventResolution {
  damage: ResolvedDamage;
  hitDetail?: HitResult;
  components?: readonly AttachedDamageComponent[];
}

export function appendAttachedComponents(
  resolution: EventResolution,
  components: readonly AttachedDamageComponent[],
): EventResolution {
  if (components.length === 0) return resolution;
  const extra = components.reduce(
    (total, component) => ({
      min: total.min + component.damage.min,
      max: total.max + component.damage.max,
      expected: total.expected + component.damage.expected,
      critExpected:
        total.critExpected + (component.damage.critExpected ?? component.damage.expected),
      capLoss: total.capLoss + (component.damage.capLoss ?? 0),
      criticalContribution:
        total.criticalContribution + (component.damage.critical?.contribution ?? 0),
    }),
    { min: 0, max: 0, expected: 0, critExpected: 0, capLoss: 0, criticalContribution: 0 },
  );
  const damage = resolution.damage;
  return {
    ...resolution,
    damage: {
      ...damage,
      min: damage.min + extra.min,
      max: damage.max + extra.max,
      expected: damage.expected + extra.expected,
      ...("critExpected" in damage || extra.critExpected > 0
        ? { critExpected: (damage.critExpected ?? damage.expected) + extra.critExpected }
        : {}),
      capLoss: (damage.capLoss ?? 0) + extra.capLoss,
      ...(damage.critical
        ? {
            critical: {
              ...damage.critical,
              contribution: damage.critical.contribution + extra.criticalContribution,
            },
          }
        : {}),
    },
    components: [...(resolution.components ?? []), ...components],
  };
}

function freezeDamage(damage: ResolvedDamage): ResolvedDamage {
  return Object.freeze({ ...damage });
}

export const NO_DAMAGE: EventResolution = Object.freeze({
  damage: freezeDamage({ min: 0, max: 0, expected: 0 }),
});
