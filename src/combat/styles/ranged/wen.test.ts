import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import {
  WEN_ICY_CHILL_DURATION_TICKS,
  WEN_ICY_CHILL_MAX_STACKS,
  WEN_ICY_PRECISION_DURATION_TICKS,
  expireWenArrowState,
  newWenArrowState,
  prepareWenArrowCast,
  recordWenBasicHit,
  wenBasicHitEligible,
} from "./wen";

const ability = (
  category: AbilitySpec["category"],
  options: { weaponSpecial?: boolean; damaging?: boolean } = {},
): AbilitySpec => ({
  id: `${category}-test`,
  name: `${category} test`,
  style: "ranged",
  category,
  hits: options.damaging === false ? [] : [{ band: { minPct: 90, maxPct: 110 } }],
  ...(options.weaponSpecial ? { weaponSpecial: true } : {}),
});

describe("modern Wen arrows", () => {
  it("builds one Icy Chill stack per basic hit, caps at 10, and expires after 30 seconds", () => {
    let state = newWenArrowState();
    for (let hit = 0; hit < 12; hit++) state = recordWenBasicHit(state, hit);

    expect(state.icyChillStacks).toBe(WEN_ICY_CHILL_MAX_STACKS);
    expect(state.icyChillExpiresAtTick).toBe(11 + WEN_ICY_CHILL_DURATION_TICKS);
    expect(expireWenArrowState(state, state.icyChillExpiresAtTick)).toEqual(newWenArrowState());
  });

  it("consumes exactly 10 stacks for 9 seconds of Icy Precision", () => {
    const stacked = {
      icyChillStacks: WEN_ICY_CHILL_MAX_STACKS,
      icyChillExpiresAtTick: 50,
      icyPrecisionUntilTick: 0,
    };
    const prepared = prepareWenArrowCast(stacked, 12, ability("enhanced"));

    expect(prepared.snapshot).toEqual({ damageActive: true, damagePotentialActive: true });
    expect(prepared.nextState).toEqual({
      icyChillStacks: 0,
      icyChillExpiresAtTick: 0,
      icyPrecisionUntilTick: 12 + WEN_ICY_PRECISION_DURATION_TICKS,
    });
  });

  it("gives later spenders both damage and Damage Potential while blocking another consumption", () => {
    const active = {
      icyChillStacks: WEN_ICY_CHILL_MAX_STACKS,
      icyChillExpiresAtTick: 60,
      icyPrecisionUntilTick: 20,
    };
    expect(prepareWenArrowCast(active, 19, ability("ultimate"))).toEqual({
      snapshot: { damageActive: true, damagePotentialActive: true },
      nextState: null,
    });
    expect(prepareWenArrowCast(active, 20, ability("ultimate"))).toEqual({
      snapshot: { damageActive: true, damagePotentialActive: true },
      nextState: {
        icyChillStacks: 0,
        icyChillExpiresAtTick: 0,
        icyPrecisionUntilTick: 20 + WEN_ICY_PRECISION_DURATION_TICKS,
      },
    });
  });

  it("does not consume early or on a non-damaging ability", () => {
    const partial = { icyChillStacks: 9, icyChillExpiresAtTick: 50, icyPrecisionUntilTick: 0 };
    expect(prepareWenArrowCast(partial, 10, ability("enhanced")).nextState).toBeNull();

    const full = { ...partial, icyChillStacks: WEN_ICY_CHILL_MAX_STACKS };
    expect(
      prepareWenArrowCast(full, 10, ability("utility", { damaging: false })).nextState,
    ).toBeNull();
    expect(
      prepareWenArrowCast(full, 10, ability("enhanced", { weaponSpecial: true })).nextState,
    ).not.toBeNull();
  });

  it("builds stacks from every Ranged basic ability, including Basic Attack", () => {
    expect(wenBasicHitEligible({ ...ability("basic"), basicAttack: true })).toBe(true);
    expect(wenBasicHitEligible(ability("basic"))).toBe(true);
    expect(wenBasicHitEligible(ability("enhanced"))).toBe(false);
  });
});
