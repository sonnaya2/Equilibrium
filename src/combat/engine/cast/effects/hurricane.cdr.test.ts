import { describe, expect, it } from "vitest";
import { secondsToTicks } from "../../../core/ticks";
import { baseInput } from "../../../test/fixtures/inputs";
import { onMeleeHitLanded } from "../../resolution/landed/melee";
import type { ResolvedDamage } from "../../resolution/types";
import { prepareSimulationCast } from "../../cast";
import { scheduleCastEvents } from "../../cast/schedule";
import { createRuntime } from "../../runtime/runtime";
import type { ScheduledEvent } from "../../runtime/events";
import type { SimulationRuntime } from "../../runtime/runtime";
import { advanceTo } from "../../runtime/clock";
import { createCastContext } from "../../simulation/simulate";

const FULL = secondsToTicks(20.4); // 34
const CDR = secondsToTicks(3); // 5
/** One affected target grants one -3s reduction for the cast. */
const ONE_TARGET = FULL - CDR; // 29
const DAMAGE: ResolvedDamage = { min: 1, max: 10, expected: 5 };

function hurricaneEvent(
  overrides: Partial<ScheduledEvent<SimulationRuntime>> = {},
): ScheduledEvent<SimulationRuntime> {
  return {
    tick: 0,
    seq: 0,
    family: "hit",
    abilityId: "hurricane",
    sourceCast: 0,
    hitIndex: 0,
    attached: false,
    procEligible: true,
    recursionAllowed: false,
    originKind: "direct",
    provenance: { kind: "player_direct" },
    ...overrides,
    resolve: () => ({ damage: DAMAGE }),
  };
}

function landedCdr(event: ScheduledEvent<SimulationRuntime>, damage = DAMAGE): number | undefined {
  const rt = createRuntime({ ...baseInput, startingAdrenaline: 100 });
  rt.state = { ...rt.state, cooldowns: { hurricane: FULL } };
  onMeleeHitLanded(rt, event, rt.byId.get("hurricane"), damage);
  return rt.state.cooldowns.hurricane;
}

describe("Hurricane per-target CDR", () => {
  it("ST cast: two hits on one target grant one -3s reduction", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const hurricane = ctx.byId.get("hurricane")!;
    const castTick = 0;
    expect(ctx.performCast(hurricane, castTick, false).ok).toBe(true);

    // Both hits land during cast occupancy advance (no tickOffset).
    expect(ctx.getState().cooldowns.hurricane).toBe(castTick + ONE_TARGET);
  });

  it("two ability hits on the same target do not stack CDR", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const hurricane = ctx.byId.get("hurricane")!;
    expect(ctx.performCast(hurricane, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.hurricane).toBe(ONE_TARGET);
  });

  it("Bloodlust third hit does not add another same-target reduction", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const attack = ctx.byId.get("attack")!;
    const hurricane = ctx.byId.get("hurricane")!;
    for (let i = 0; i < 4; i++) ctx.performCast(attack, ctx.getState().tick, false);
    const castTick = ctx.getState().tick;
    expect(ctx.performCast(hurricane, castTick, false).ok).toBe(true);

    const s = ctx.finish();
    const hits = s.events.filter((e) => e.abilityId === "hurricane");
    expect(hits.length).toBe(3);
    expect(ctx.getState().cooldowns.hurricane).toBe(castTick + ONE_TARGET);
  });

  it("reduction floors at land event tick (never before current tick)", () => {
    expect(landedCdr(hurricaneEvent({ tick: FULL - 2 }))).toBe(FULL - 2);
  });

  it("does not apply CDR from non-hurricane or zero-damage paths", () => {
    const ctx = createCastContext({ ...baseInput, startingAdrenaline: 100 });
    const assault = ctx.byId.get("assault")!;
    expect(ctx.performCast(assault, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.hurricane).toBeUndefined();

    const zero = createCastContext({ ...baseInput, accuracy: 0, startingAdrenaline: 100 });
    expect(zero.performCast(zero.byId.get("hurricane")!, 0, false).ok).toBe(true);
    expect(zero.getState().cooldowns.hurricane).toBe(FULL);
  });

  it("does not apply CDR from blocked or cancelled casts", () => {
    const blocked = createCastContext({ ...baseInput, startingAdrenaline: 0 });
    expect(blocked.performCast(blocked.byId.get("hurricane")!, 0, false).ok).toBe(false);
    expect(blocked.getState().cooldowns.hurricane).toBeUndefined();

    const rt = createRuntime({ ...baseInput, startingAdrenaline: 100 });
    const hurricane = rt.byId.get("hurricane")!;
    const preparation = prepareSimulationCast(rt, hurricane, 0);
    expect(preparation.ok).toBe(true);
    if (!preparation.ok) return;
    scheduleCastEvents(rt, preparation.prepared, false);
    rt.state = { ...rt.state, cooldowns: { hurricane: FULL } };
    expect(rt.queue.cancelByOwner(0)).toBeGreaterThan(0);
    advanceTo(rt, FULL);
    expect(rt.state.cooldowns.hurricane).toBe(FULL);
  });

  it("ignores attached, proc, bleed, DoT, and derived events", () => {
    const excluded = [
      { attached: true },
      { originKind: "proc" as const },
      { bleedId: "dismember" as const },
      { dotKind: "bleed" as const },
      { derivedFrom: 7, provenance: { kind: "derived_bounce" as const } },
    ];
    for (const overrides of excluded) {
      expect(landedCdr(hurricaneEvent(overrides))).toBe(FULL);
    }
  });
});
