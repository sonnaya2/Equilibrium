import { describe, expect, it } from "vitest";
import { resolvePoisonApplication, type PlayerPoisonProfile } from "../../poison/mechanics";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";
import { applyPlayerPoison, processPlayerPoisonEvent } from "./playerPoison";

const profile = (patch: Partial<PlayerPoisonProfile> = {}): PlayerPoisonProfile => ({
  potion: "weapon",
  potionUntilTick: 250,
  kwuarmPotency: 0,
  cinderbane: false,
  blowpipe: false,
  laniakea: false,
  bik: false,
  targetPoisonImmune: false,
  vulnerability: false,
  ...patch,
});

function runtime(playerPoison: PlayerPoisonProfile) {
  return createRuntime({
    base: 1_000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    abilities: [],
    playerPoison,
  });
}

function drain(rt: ReturnType<typeof runtime>): void {
  while (rt.queue.length > 0) advanceTo(rt, rt.queue.maxTick());
}

describe("player poison scheduler", () => {
  it("lands the standard 18-hit sequence from tick 2 through 274", () => {
    const input = profile();
    const rt = runtime(input);
    applyPlayerPoison(rt, 0, resolvePoisonApplication(input, 0)!);
    drain(rt);
    expect(rt.events.map((event) => event.tick)).toEqual(
      Array.from({ length: 18 }, (_, index) => 2 + index * 16),
    );
    expect(rt.events.at(-1)?.tick).toBe(274);
    expect(rt.state.target.weaponPoison.active).toBe(false);
  });

  it("lands 36 half-damage blowpipe hits through tick 282", () => {
    const input = profile({ potion: "none", potionUntilTick: 0, blowpipe: true });
    const rt = runtime(input);
    applyPlayerPoison(rt, 0, resolvePoisonApplication(input, 0)!);
    drain(rt);
    expect(rt.events).toHaveLength(36);
    expect(rt.events.map((event) => event.tick)).toEqual(
      Array.from({ length: 36 }, (_, index) => 2 + index * 8),
    );
    expect(rt.events[0]?.damage.expected).toBeCloseTo(97.5, 10);
  });

  it("refresh cancels the pending hit and resets decay and duration", () => {
    const input = profile();
    const rt = runtime(input);
    const source = resolvePoisonApplication(input, 0)!;
    applyPlayerPoison(rt, 0, source);
    const firstSeq = rt.state.target.weaponPoison.pendingEventSeq;
    applyPlayerPoison(rt, 1, source);
    expect(rt.queue.pending()).toHaveLength(1);
    expect(rt.queue.pending()[0]?.tick).toBe(3);
    expect(rt.queue.pending()[0]?.seq).not.toBe(firstSeq);
    expect(rt.state.target.weaponPoison).toMatchObject({
      appliedAtTick: 1,
      expiresAtTick: 301,
      decayIndex: 0,
      remainingHits: 18,
    });
  });

  it("refresh after a landed poison hit restarts the damage band and 300-tick status", () => {
    const input = profile();
    const rt = runtime(input);
    const source = resolvePoisonApplication(input, 0)!;
    applyPlayerPoison(rt, 0, source);
    advanceTo(rt, 2);
    expect(rt.state.target.weaponPoison.decayIndex).toBe(1);
    applyPlayerPoison(rt, 10, source);
    expect(rt.state.target.weaponPoison).toMatchObject({
      expiresAtTick: 310,
      decayIndex: 0,
      remainingHits: 18,
      nextHitTick: 12,
    });
    advanceTo(rt, 12);
    expect(rt.events.at(-1)?.damage.expected).toBeCloseTo(195, 10);
  });

  it("keeps an applied target status after its potion application window expires", () => {
    const input = profile();
    const rt = runtime(input);
    applyPlayerPoison(rt, 249, resolvePoisonApplication(input, 249)!);
    expect(resolvePoisonApplication(input, 250)).toBeNull();
    advanceTo(rt, 251);
    expect(rt.events.at(-1)?.tick).toBe(251);
    expect(rt.state.target.weaponPoison.active).toBe(true);
  });

  it("re-resolves a Cinderbane continuation after potion expiry", () => {
    const input = profile({
      potion: "weapon-plus-plus-plus",
      potionUntilTick: 3,
      cinderbane: true,
    });
    const rt = runtime(input);
    applyPlayerPoison(rt, 0, resolvePoisonApplication(input, 0)!);
    const first = rt.queue.shift()!;
    expect(processPlayerPoisonEvent(rt, first)?.effectiveTier).toBe(5);
    const afterExpiry = rt.queue.shift()!;
    expect(afterExpiry.tick).toBe(18);
    expect(processPlayerPoisonEvent(rt, afterExpiry)?.effectiveTier).toBe(2);
  });

  it("Cinderbane continuation success replaces the ordinary pending hit", () => {
    const input = profile({ potion: "none", potionUntilTick: 0, cinderbane: true });
    const rt = runtime(input);
    applyPlayerPoison(rt, 0, resolvePoisonApplication(input, 0)!);
    const event = rt.queue.shift()!;
    const continuation = processPlayerPoisonEvent(rt, event)!;
    expect(rt.queue.pending().map((pending) => pending.tick)).toEqual([18]);
    applyPlayerPoison(rt, event.tick, continuation);
    expect(rt.queue.pending().map((pending) => pending.tick)).toEqual([4]);
  });

  it("does not create target state or events for an immune target", () => {
    const input = profile({ targetPoisonImmune: true });
    const rt = runtime(input);
    applyPlayerPoison(rt, 0, {
      effectiveTier: 1,
      procChance: 0.125,
      cadenceTicks: 16,
      hitBudget: 18,
      sourceDamageMultiplier: 1,
      cinderbaneContinuation: false,
      continuationChance: 0.125,
      sourceLabel: "weapon poison (tier 1)",
    });
    expect(rt.state.target.weaponPoison.active).toBe(false);
    expect(rt.queue.length).toBe(0);
  });
});
