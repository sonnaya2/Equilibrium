import { describe, expect, it } from "vitest";
import { resolvePoisonApplication, type PlayerPoisonProfile } from "../../poison/mechanics";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";
import {
  applyPlayerPoisonLandOccurrence,
  lastPlayerPoisonTick,
  modalTargetWeaponPoison,
  playerPoisonProbabilityMass,
} from "./playerPoison";

const profile = (patch: Partial<PlayerPoisonProfile> = {}): PlayerPoisonProfile => ({
  potion: "weapon",
  potionUntilTick: 250,
  kwuarmPotency: 0,
  cinderbane: false,
  blowpipe: false,
  laniakea: false,
  ...patch,
});

function runtime(playerPoison: PlayerPoisonProfile, targetPoisonImmune = false) {
  return createRuntime({
    base: 1_000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    abilities: [],
    playerPoison,
    targetPoisonImmune,
  });
}

function applyPoison(
  rt: ReturnType<typeof runtime>,
  atTick: number,
  source: NonNullable<ReturnType<typeof resolvePoisonApplication>>,
): void {
  applyPlayerPoisonLandOccurrence(
    rt,
    atTick,
    { ...source, procChance: 1 },
    {
      occurrenceProbability: 1,
      expectedOccurrences: 1,
      applicationSuccessProbability: 1,
      applicationSuccessMultiplicity: { kind: "single" },
      immunityDisabledUntilTick: 0,
    },
  );
}

function drain(rt: ReturnType<typeof runtime>): void {
  while (lastPlayerPoisonTick(rt) >= 0) advanceTo(rt, lastPlayerPoisonTick(rt));
}

function poisonState(rt: ReturnType<typeof runtime>) {
  return modalTargetWeaponPoison(rt.state.target.weaponPoison).poison;
}

describe("player poison scheduler", () => {
  it("lands the standard 18-hit sequence from tick 2 through 274", () => {
    const input = profile();
    const rt = runtime(input);
    applyPoison(rt, 0, resolvePoisonApplication(input, 0)!);
    drain(rt);
    expect(rt.events.map((event) => event.tick)).toEqual(
      Array.from({ length: 18 }, (_, index) => 2 + index * 16),
    );
    expect(rt.events.at(-1)?.tick).toBe(274);
    expect(poisonState(rt)).toMatchObject({ active: true, remainingHits: 0 });
  });

  it("lands 36 half-damage blowpipe hits through tick 282", () => {
    const input = profile({ potion: "none", potionUntilTick: 0, blowpipe: true });
    const rt = runtime(input);
    applyPoison(rt, 0, resolvePoisonApplication(input, 0)!);
    drain(rt);
    expect(rt.events).toHaveLength(36);
    expect(rt.events.map((event) => event.tick)).toEqual(
      Array.from({ length: 36 }, (_, index) => 2 + index * 8),
    );
    expect(rt.events[0]?.damage.expected).toBeCloseTo(97.5, 10);
  });

  it("non-Cinder refresh preserves cadence and the earned initial poison hit", () => {
    const input = profile();
    const rt = runtime(input);
    const source = resolvePoisonApplication(input, 0)!;
    applyPoison(rt, 0, source);
    const firstSeq = poisonState(rt).pendingEventSeq;
    applyPoison(rt, 1, source);
    expect(rt.queue.pending()).toHaveLength(0);
    expect(poisonState(rt).nextHitTick).toBe(18);
    expect(poisonState(rt).pendingEventSeq).toBe(firstSeq);
    expect(poisonState(rt)).toMatchObject({
      expiresAtTick: 301,
      decayIndex: 0,
      remainingHits: 17,
    });
    expect(poisonState(rt).pendingApplicationHits.map((hit) => hit.tick)).toEqual([2]);
    advanceTo(rt, 3);
    expect(rt.events.map((event) => event.tick)).toEqual([2]);
    expect(rt.events.map((event) => event.expectedOccurrences)).toEqual([1]);
  });

  it("Cinderbane reapplication earns another hit and resets the cadence", () => {
    const input = profile({ cinderbane: true });
    const rt = runtime(input);
    const source = resolvePoisonApplication(input, 0)!;
    applyPoison(rt, 0, source);
    applyPoison(rt, 1, source);
    expect(poisonState(rt)).toMatchObject({
      expiresAtTick: 301,
      decayIndex: 0,
      remainingHits: 17,
      nextHitTick: 19,
    });
    expect(poisonState(rt).pendingApplicationHits.map((hit) => hit.tick)).toEqual([2, 3]);
    advanceTo(rt, 3);
    expect(rt.events.map((event) => event.tick)).toEqual([2, 3]);
  });

  it("refresh after a landed poison hit restarts the damage band and 300-tick status", () => {
    const input = profile();
    const rt = runtime(input);
    const source = resolvePoisonApplication(input, 0)!;
    applyPoison(rt, 0, source);
    advanceTo(rt, 2);
    expect(poisonState(rt).decayIndex).toBe(1);
    applyPoison(rt, 10, source);
    expect(poisonState(rt)).toMatchObject({
      expiresAtTick: 310,
      decayIndex: 0,
      remainingHits: 18,
      nextHitTick: 18,
    });
    expect(poisonState(rt).pendingApplicationHits).toEqual([]);
    advanceTo(rt, 18);
    expect(rt.events.at(-1)?.damage.expected).toBeCloseTo(195, 10);
  });

  it("keeps an applied target status after its potion application window expires", () => {
    const input = profile();
    const rt = runtime(input);
    applyPoison(rt, 249, resolvePoisonApplication(input, 249)!);
    expect(resolvePoisonApplication(input, 250)).toBeNull();
    advanceTo(rt, 251);
    expect(rt.events.at(-1)?.tick).toBe(251);
    expect(poisonState(rt).active).toBe(true);
  });

  it("re-resolves a Cinderbane continuation after potion expiry", () => {
    const input = profile({
      potion: "weapon-plus-plus-plus",
      potionUntilTick: 3,
      cinderbane: true,
    });
    const rt = runtime(input);
    applyPoison(rt, 0, resolvePoisonApplication(input, 0)!);
    advanceTo(rt, 4);
    expect(
      rt.state.target.weaponPoison.atoms.some(
        (atom) =>
          atom.poison.effectiveTier === 2 &&
          atom.poison.pendingApplicationHits.some((hit) => hit.tick === 6),
      ),
    ).toBe(true);
  });

  it("keeps Cinderbane continuation and cadence paths in one unit distribution", () => {
    const input = profile({ potion: "none", potionUntilTick: 0, cinderbane: true });
    const rt = runtime(input);
    applyPoison(rt, 0, resolvePoisonApplication(input, 0)!);
    advanceTo(rt, 2);
    expect(
      rt.state.target.weaponPoison.atoms
        .filter((atom) => atom.poison.active)
        .map((atom) => atom.poison.pendingApplicationHits[0]?.tick ?? atom.poison.nextHitTick)
        .sort((a, b) => a - b),
    ).toEqual([4, 18]);
    expect(playerPoisonProbabilityMass(rt.state.target.weaponPoison)).toBeCloseTo(1, 12);
    expect(
      rt.state.target.weaponPoison.atoms
        .filter((atom) => atom.poison.active)
        .map((atom) => [
          atom.poison.pendingApplicationHits[0]?.tick ?? atom.poison.nextHitTick,
          atom.probability,
        ]),
    ).toEqual([
      [18, 0.875],
      [4, 0.125],
    ]);
  });

  it("does not create target state or events for an immune target", () => {
    const input = profile();
    const rt = runtime(input, true);
    applyPoison(rt, 0, {
      effectiveTier: 1,
      procChance: 1,
      cadenceTicks: 16,
      hitBudget: 18,
      sourceDamageMultiplier: 1,
      cinderbaneContinuation: false,
      continuationChance: 0,
      sourceLabel: "weapon poison (tier 1)",
    });
    expect(poisonState(rt).active).toBe(false);
    expect(rt.queue.length).toBe(0);
  });
});
