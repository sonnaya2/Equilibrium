import { describe, expect, it } from "vitest";
import { secondsToTicks } from "../../../core/ticks";
import { baseInput } from "../../../test/fixtures/inputs";
import { createCastContext } from "../../simulation/simulate";

const FULL = secondsToTicks(20.4); // 34
const CDR = secondsToTicks(3); // 5
/** ST base form: two ability hits each grant -3s => 20.4 - 6 = 14.4s (24 ticks). */
const ST_TWO_HITS = FULL - 2 * CDR; // 24
/** Bloodlust form: three ability hits => 20.4 - 9 = 11.4s (19 ticks). */
const ST_THREE_HITS = FULL - 3 * CDR; // 19

describe("Hurricane per-hit CDR (wiki enemy-hit reductions)", () => {
  it("ST cast: full 20.4s then each of two lands -3s => ready at cast+14.4s", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const hurricane = ctx.byId.get("hurricane")!;
    const castTick = 0;
    expect(ctx.performCast(hurricane, castTick, false).ok).toBe(true);

    // Both hits land during cast occupancy advance (no tickOffset).
    expect(ctx.getState().cooldowns.hurricane).toBe(castTick + ST_TWO_HITS);
  });

  it("two ability hits on same primary both reduce CD (not once-per-target)", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const hurricane = ctx.byId.get("hurricane")!;
    expect(ctx.performCast(hurricane, 0, false).ok).toBe(true);
    // Distinct-target-once would leave 29; per-hit yields 24.
    expect(ctx.getState().cooldowns.hurricane).toBe(ST_TWO_HITS);
    expect(ctx.getState().cooldowns.hurricane).not.toBe(FULL - CDR);
  });

  it("Bloodlust third hit grants a third -3s (wiki: 3 enemies zero CD under BL)", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const attack = ctx.byId.get("attack")!;
    const hurricane = ctx.byId.get("hurricane")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    const castTick = ctx.getState().tick;
    expect(ctx.performCast(hurricane, castTick, false).ok).toBe(true);

    const s = ctx.finish();
    const hits = s.events.filter((e) => e.abilityId === "hurricane");
    expect(hits.length).toBe(3);
    expect(ctx.getState().cooldowns.hurricane).toBe(castTick + ST_THREE_HITS);
  });

  it("reduction floors at land event tick (never before current tick)", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const hurricane = ctx.byId.get("hurricane")!;
    expect(ctx.performCast(hurricane, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.hurricane).toBeGreaterThanOrEqual(0);
    expect(ctx.getState().cooldowns.hurricane).toBe(ST_TWO_HITS);
  });

  it("does not apply CDR from non-hurricane or zero-damage paths", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const assault = ctx.byId.get("assault")!;
    expect(ctx.performCast(assault, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.hurricane).toBeUndefined();
  });
});
