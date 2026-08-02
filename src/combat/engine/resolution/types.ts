import type { HitResult } from "../../pipeline/calculateHit";

export interface CriticalResolution {
  mode: "none" | "expected" | "guaranteed";
  chance: number;
  contribution: number;
  inherited?: boolean;
}

export function packageCritical(
  chance: number,
  critExpected: number,
  nonCritExpected: number,
  opts?: { inherited?: boolean; scale?: number },
): CriticalResolution {
  const scale = opts?.scale ?? 1;
  return {
    mode: chance >= 1 ? "guaranteed" : chance > 0 ? "expected" : "none",
    chance,
    contribution: Math.max(0, chance * (critExpected - nonCritExpected)) * scale,
    ...(opts?.inherited ? { inherited: true } : {}),
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
}

export interface EventResolution {
  damage: ResolvedDamage;
  hitDetail?: HitResult;
  components?: readonly AttachedDamageComponent[];
}

function freezeDamage(damage: ResolvedDamage): ResolvedDamage {
  return Object.freeze({ ...damage });
}

export const NO_DAMAGE: EventResolution = Object.freeze({
  damage: freezeDamage({ min: 0, max: 0, expected: 0 }),
});
