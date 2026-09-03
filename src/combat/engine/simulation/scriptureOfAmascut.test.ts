import { describe, expect, it } from "vitest";
import { equipmentById } from "../../data";
import { resolveLeagueRules } from "../../league/ruleset";
import { scriptureOfAmascutDamageModifier } from "../../passives/scriptureOfAmascut";
import { activeEquipmentEffects } from "../../shared/equipment";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { baseInput } from "../../test/fixtures/inputs";
import { rngPointsFor } from "../cast/rules";
import { stochasticLaneCount } from "../runtime/stochastic";
import { createCastContext } from "./simulate";

const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;
const equipmentEffects = activeEquipmentEffects({
  style: "melee",
  equipmentSlots: { pocket: "item:scripture-of-amascut" },
});

function context(league?: ReturnType<typeof resolveLeagueRules>) {
  return createCastContext({
    ...baseInput,
    equipmentEffects,
    ...(league ? { league } : {}),
    context: { style: "melee", ...(league ? { ruleset: "equilibrium" as const } : {}) },
  });
}

describe("Scripture of Amascut", () => {
  it("routes the equipped item into state-changing cast RNG", () => {
    expect(equipmentById("item:scripture-of-amascut")?.passiveId).toBe("scripture-of-amascut");
    expect(equipmentEffects.passiveIds).toContain("scripture-of-amascut");

    const ctx = context();
    expect(
      rngPointsFor(ctx.getState(), attack, 0, 0, undefined, undefined, equipmentEffects),
    ).toContainEqual({ id: "scripture-of-amascut", chance: 0.066 });
    expect(stochasticLaneCount({ ...baseInput, equipmentEffects }, ["attack"])).toBe(128);
    expect(scriptureOfAmascutDamageModifier()).toMatchObject({
      stage: "base",
      abilityBaseMultiplier: 1.1,
    });
  });

  it("schedules nine two-tick Contagion DoT hits and excludes them from their own buff", () => {
    const ctx = context();
    expect(ctx.performCast(attack, 0, false, { "scripture-of-amascut": true }).ok).toBe(true);
    expect(ctx.getState().scriptureOfAmascut).toEqual({
      damageUntilTick: 17,
      readyTick: 25,
      triggeringCast: 0,
    });

    const result = ctx.finish();
    const contagion = result.events.filter((event) => event.abilityId === "devourers_contagion");
    expect(contagion.map((event) => event.tick)).toEqual([4, 6, 8, 10, 12, 14, 16, 18, 20]);
    expect(contagion).toHaveLength(9);
    expect(
      contagion.every(
        (event) =>
          event.family === "dot" &&
          event.originKind === "dot" &&
          event.dotKind === "other" &&
          event.tearingThornsEligible === true &&
          event.damage.min === 240 &&
          event.damage.max === 400 &&
          event.damage.expected === 320,
      ),
    ).toBe(true);
    expect(result.analysis.byEffect.find((row) => row.id === "devourers_contagion")).toMatchObject({
      kind: "equipment-passive",
      dotDamage: 2_880,
      expectedActivations: 1,
      expectedSeparateHits: 9,
    });
  });

  it("does not boost the triggering hit and boosts later damage inside the window", () => {
    const ctx = context();
    ctx.performCast(attack, 0, false, { "scripture-of-amascut": true });
    ctx.performCast(attack, 3, false, { "scripture-of-amascut": false });
    const result = ctx.finish();
    const attacks = result.events.filter((event) => event.abilityId === "attack");

    expect(attacks[0]?.damage.expected).toBe(1_200);
    expect(attacks[1]?.damage.expected).toBeGreaterThan(attacks[0]!.damage.expected);
    expect(attacks[1]!.damage.expected / attacks[0]!.damage.expected).toBeCloseTo(1.1, 3);
  });

  it("does not boost later hits from the triggering attack", () => {
    const ctx = context();
    const multiHitAttack = {
      ...attack,
      id: "test:multi-hit-attack",
      name: "Multi-hit attack",
      hits: [attack.hits[0]!, attack.hits[0]!],
    };
    ctx.performCast(multiHitAttack, 0, false, { "scripture-of-amascut": true });

    const hits = ctx.finish().events.filter((event) => event.abilityId === "test:multi-hit-attack");
    expect(hits).toHaveLength(2);
    expect(hits.map((event) => event.damage.expected)).toEqual([1_200, 1_200]);
  });

  it("does not reactivate during cooldown and is ready on tick 25", () => {
    const ctx = context();
    ctx.performCast(attack, 0, false, { "scripture-of-amascut": true });
    ctx.performCast(attack, 3, false, { "scripture-of-amascut": true });
    expect(ctx.getState().scriptureOfAmascut.readyTick).toBe(25);
    ctx.performCast(attack, 25, false, { "scripture-of-amascut": true });

    const result = ctx.finish();
    expect(result.events.filter((event) => event.abilityId === "devourers_contagion")).toHaveLength(
      18,
    );
    expect(ctx.getState().scriptureOfAmascut.readyTick).toBe(50);
  });

  it("counts Contagion ticks toward Tearing Thorns without extending the scripture DoT", () => {
    const league = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Balance", "Balance", "Balance", "Balance", "Balance"],
    });
    const ctx = context(league);
    ctx.performCast(attack, 0, false, { "scripture-of-amascut": true });
    const result = ctx.finish();

    expect(result.events.filter((event) => event.abilityId === "devourers_contagion")).toHaveLength(
      9,
    );
    const grasps = result.events.filter(
      (event) =>
        event.abilityId === "grasp-of-guthix-poison" && event.blessingId === "tearing-thorns",
    );
    expect(grasps).toHaveLength(1);
    expect(grasps[0]?.tick).toBe(12);
    expect(ctx.getState().league?.tearingThornsHitCount).toBe(4);
  });

  it("scales the residue and Tearing Thorns count across its 3x3 target area", () => {
    const league = resolveLeagueRules(
      {
        ruleset: "equilibrium",
        blessingPicks: ["Balance", "Balance", "Balance", "Balance", "Balance"],
      },
      { areaTargets: 3 },
    );
    const ctx = context(league);
    ctx.performCast(attack, 0, false, { "scripture-of-amascut": true });
    const result = ctx.finish();
    const contagion = result.events.filter((event) => event.abilityId === "devourers_contagion");
    const grasps = result.events.filter((event) => event.abilityId === "grasp-of-guthix-poison");

    expect(contagion).toHaveLength(9);
    expect(contagion[0]).toMatchObject({
      expectedOccurrences: 3,
      expectedSeparateHits: 3,
      damage: { min: 720, max: 1_200, expected: 960 },
    });
    expect(grasps).toHaveLength(5);
    expect(ctx.getState().league?.tearingThornsHitCount).toBe(2);
    expect(result.analysis.byEffect.find((row) => row.id === "devourers_contagion")).toMatchObject({
      dotDamage: 8_640,
      expectedSeparateHits: 27,
    });
  });
});
