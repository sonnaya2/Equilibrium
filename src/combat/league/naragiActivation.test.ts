import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { createRuntime } from "../engine/runtime/runtime";
import { advanceTo } from "../engine/runtime/clock";
import { resolveLeagueRules } from "./ruleset";
import {
  activateNaragiSliver,
  applyPlayerDamageWithPrevention,
  effectiveLevelFromState,
  NARAGI_EVENT,
} from "./naragiActivation";
import {
  NARAGI_ACTIVE_DURATION_TICKS,
  NARAGI_COOLDOWN_TICKS,
  NARAGI_HEAL_AMOUNT,
  SLIVER_OF_EDICTS_ACTIVATE_ID,
} from "./naragiEdict";

function bareRt(maxLp = 15_000) {
  return createRuntime({
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    abilities: MELEE_ABILITIES,
    league: resolveLeagueRules({ ruleset: "equilibrium", relics: ["Naragi Edict"] }),
  });
}

describe("activateNaragiSliver", () => {
  it("fails without relic or sliver", () => {
    const rt = bareRt();
    expect(
      activateNaragiSliver(rt, { relicActive: false, sliverWorn: true }).reason,
    ).toBe("relic-inactive");
    expect(
      activateNaragiSliver(rt, { relicActive: true, sliverWorn: false }).reason,
    ).toBe("sliver-unequipped");
  });

  it("schedules four heals at 7/14/21/28 and expires after boundary heal", () => {
    const rt = bareRt(40_000);
    rt.state = {
      ...rt.state,
      player: {
        vitality: { currentLifePoints: 0, maximumLifePoints: 40_000 },
        dead: false,
        levelOverride: { untilTick: 0, level: 0 },
        deathPrevention: { sourceId: "", charges: 0, untilTick: 0, policy: "full-max" },
        naragi: { activeUntilTick: 0, activatedAtTick: 0, revivalCharges: 0 },
        naragiHealed: 0,
        naragiOverheal: 0,
      },
    };

    const act = activateNaragiSliver(rt, {
      relicActive: true,
      sliverWorn: true,
      maximumLifePoints: 40_000,
    });
    expect(act.ok).toBe(true);
    expect(act.healTicks).toEqual([7, 14, 21, 28]);
    expect(act.activeUntilTick).toBe(NARAGI_ACTIVE_DURATION_TICKS);
    expect(rt.state.cooldowns[SLIVER_OF_EDICTS_ACTIVATE_ID]).toBe(NARAGI_COOLDOWN_TICKS);
    expect(effectiveLevelFromState(99, rt.state, 0)).toBe(255);
    expect(rt.state.player?.deathPrevention.charges).toBe(1);

    advanceTo(rt, 7);
    expect(rt.state.player?.vitality.currentLifePoints).toBe(NARAGI_HEAL_AMOUNT);
    advanceTo(rt, 14);
    expect(rt.state.player?.vitality.currentLifePoints).toBe(20_000);
    advanceTo(rt, 21);
    expect(rt.state.player?.vitality.currentLifePoints).toBe(30_000);
    // Boundary: heal then expire at tick 28 (heal lower seq)
    advanceTo(rt, 28);
    expect(rt.state.player?.vitality.currentLifePoints).toBe(40_000);
    expect(rt.state.player?.naragiHealed).toBe(40_000);
    expect(rt.state.player?.naragi.revivalCharges).toBe(0);
    expect(rt.state.player?.levelOverride.untilTick).toBe(0);
    expect(effectiveLevelFromState(99, rt.state, 28)).toBe(99);

    const heals = rt.events.filter((e) => e.abilityId === NARAGI_EVENT.heal);
    expect(heals).toHaveLength(4);
    expect(heals.map((e) => e.tick)).toEqual([7, 14, 21, 28]);
  });

  it("cannot re-activate during window or before cooldown", () => {
    const rt = bareRt();
    expect(activateNaragiSliver(rt, { relicActive: true, sliverWorn: true }).ok).toBe(true);
    expect(activateNaragiSliver(rt, { relicActive: true, sliverWorn: true }).reason).toBe(
      "already-active",
    );
    advanceTo(rt, 28);
    expect(activateNaragiSliver(rt, { relicActive: true, sliverWorn: true }).reason).toBe(
      "on-cooldown",
    );
    advanceTo(rt, 150);
    expect(activateNaragiSliver(rt, { relicActive: true, sliverWorn: true }).ok).toBe(true);
  });

  it("revives once during the window then kills on second lethal", () => {
    const rt = bareRt(5_000);
    activateNaragiSliver(rt, {
      relicActive: true,
      sliverWorn: true,
      maximumLifePoints: 5_000,
    });
    const first = applyPlayerDamageWithPrevention(rt, 50_000, { maximumLifePoints: 5_000 });
    expect(first.revived).toBe(true);
    expect(first.died).toBe(false);
    expect(first.currentLifePoints).toBe(5_000);

    const second = applyPlayerDamageWithPrevention(rt, 50_000, { maximumLifePoints: 5_000 });
    expect(second.revived).toBe(false);
    expect(second.died).toBe(true);
  });

  it("lethal before activation kills normally", () => {
    const rt = bareRt(1_000);
    rt.state = {
      ...rt.state,
      player: {
        vitality: { currentLifePoints: 1_000, maximumLifePoints: 1_000 },
        dead: false,
        levelOverride: { untilTick: 0, level: 0 },
        deathPrevention: { sourceId: "", charges: 0, untilTick: 0, policy: "full-max" },
        naragi: { activeUntilTick: 0, activatedAtTick: 0, revivalCharges: 0 },
        naragiHealed: 0,
        naragiOverheal: 0,
      },
    };
    const r = applyPlayerDamageWithPrevention(rt, 5_000, { maximumLifePoints: 1_000 });
    expect(r.died).toBe(true);
    expect(r.revived).toBe(false);
  });
});
