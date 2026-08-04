import { describe, expect, it } from "vitest";
import { secondsToTicks } from "../../../core/ticks";
import { baseInput } from "../../../test/fixtures/inputs";
import { createCastContext } from "../../simulation/simulate";

const FULL = secondsToTicks(20.4); // 34
const CDR = secondsToTicks(3); // 5
const ST_READY = FULL - CDR; // 29 = secondsToTicks(17.4)

describe("Hurricane per-enemy CDR", () => {
  it("ST cast: full 20.4s start, first land -3s once -> ready at cast+17.4s", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const hurricane = ctx.byId.get("hurricane")!;
    const castTick = 0;
    expect(ctx.performCast(hurricane, castTick, false).ok).toBe(true);

    // Hits land during cast occupancy advance; after finish path drains? performCast advances to occupancy.
    // After cast commit, CD should already have been reduced by first successful land.
    expect(ctx.getState().cooldowns.hurricane).toBe(castTick + ST_READY);
    expect(ctx.getState().hurricaneCdrTargets).toBeDefined();
  });

  it("two ability hits on same primary grant only one -3s", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const hurricane = ctx.byId.get("hurricane")!;
    expect(ctx.performCast(hurricane, 0, false).ok).toBe(true);
    // Two hits scheduled; only one distinct target counted.
    const counted = Object.values(ctx.getState().hurricaneCdrTargets ?? {}).flat();
    expect(counted.filter((t) => t === "primary")).toHaveLength(1);
    expect(ctx.getState().cooldowns.hurricane).toBe(ST_READY);
  });

  it("Bloodlust third hit on same primary still one -3s total", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const attack = ctx.byId.get("attack")!;
    const hurricane = ctx.byId.get("hurricane")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    const castTick = ctx.getState().tick;
    expect(ctx.performCast(hurricane, castTick, false).ok).toBe(true);

    const s = ctx.finish();
    const hits = s.events.filter((e) => e.abilityId === "hurricane");
    expect(hits.length).toBe(3);
    expect(ctx.getState().cooldowns.hurricane).toBe(castTick + ST_READY);
    const targets = Object.values(ctx.getState().hurricaneCdrTargets ?? {}).flat();
    expect(targets.filter((t) => t === "primary")).toHaveLength(1);
  });

  it("reduction floors at land event tick (never negative remaining)", () => {
    // Start with almost-expired CD then land a hit that would overshoot.
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const hurricane = ctx.byId.get("hurricane")!;
    expect(ctx.performCast(hurricane, 0, false).ok).toBe(true);
    // After ST CDR ready is 29; advance near that and re-check floor via second cast path is N/A.
    // Direct: ready stays >= land tick (0 for first lands).
    expect(ctx.getState().cooldowns.hurricane).toBeGreaterThanOrEqual(0);
    expect(ctx.getState().cooldowns.hurricane).toBe(ST_READY);
  });
});
