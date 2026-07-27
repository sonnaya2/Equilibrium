import { describe, expect, it } from "vitest";
import { secondsToTicks } from "../../rotation/timeline";
import {
  DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS,
  LIVING_DEATH_DURATION_SECONDS,
  NECROMANCY_ABILITIES,
  volleyOfSouls,
} from "./abilities";
import {
  activateLivingDeath,
  applyNecroOnCast,
  deathSkullsCooldownTicks,
  livingDeathActive,
  necroAdrenalineCost,
  necroCanCast,
  newNecroRotationState,
  residualSoulCapFor,
  resolveNecromancyAbility,
} from "./effects";
import { CONJURE_UNTIL_OFFSET_TICKS, conjureActive, newConjures, summonConjure } from "./conjures";
import { NECROSIS_CAP, TOUCH_OF_DEATH_NECROSIS } from "./necrosis";
import { RESIDUAL_SOUL_CAP } from "./souls";

const byId = (id: string) => NECROMANCY_ABILITIES.find((a) => a.id === id)!;

describe("necro rotation state machine", () => {
  it("caps residual souls at 3 / 5 and necrosis at 12", () => {
    expect(residualSoulCapFor(newNecroRotationState())).toBe(RESIDUAL_SOUL_CAP);
    expect(residualSoulCapFor(newNecroRotationState({ lantern: true }))).toBe(5);

    let necro = newNecroRotationState();
    for (let i = 0; i < 5; i++) {
      necro = applyNecroOnCast(necro, byId("touch_of_death"), i).necro;
    }
    expect(necro.necrosisStacks).toBe(NECROSIS_CAP);

    necro = newNecroRotationState();
    for (let i = 0; i < 6; i++) {
      necro = applyNecroOnCast(necro, byId("soul_sap"), i).necro;
    }
    expect(necro.residualSouls).toBe(3);
  });

  it("Soul Sap gains 1 soul; Soul Strike spends 1; Volley spends all", () => {
    let necro = newNecroRotationState();
    necro = applyNecroOnCast(necro, byId("soul_sap"), 0).necro;
    necro = applyNecroOnCast(necro, byId("soul_sap"), 1).necro;
    necro = applyNecroOnCast(necro, byId("soul_sap"), 2).necro;
    expect(necro.residualSouls).toBe(3);

    necro = applyNecroOnCast(necro, byId("soul_strike"), 3).necro;
    expect(necro.residualSouls).toBe(2);

    necro = applyNecroOnCast(necro, volleyOfSouls(2), 4).necro;
    expect(necro.residualSouls).toBe(0);
  });

  it("Touch of Death grants 4 Necrosis; FoD spends up to 6; Death Grasp spends all", () => {
    let necro = applyNecroOnCast(newNecroRotationState(), byId("touch_of_death"), 0).necro;
    necro = applyNecroOnCast(necro, byId("touch_of_death"), 1).necro;
    expect(necro.necrosisStacks).toBe(8);

    necro = applyNecroOnCast(necro, byId("finger_of_death"), 2).necro;
    expect(necro.necrosisStacks).toBe(2);

    necro = applyNecroOnCast(necro, byId("touch_of_death"), 3).necro;
    expect(necro.necrosisStacks).toBe(6);
    necro = applyNecroOnCast(necro, byId("death_grasp"), 4).necro;
    expect(necro.necrosisStacks).toBe(0);
  });

  it("Living Death opens a 30s window and resets ToD + Death Skulls CDs", () => {
    const castTick = 10;
    const patch = applyNecroOnCast(newNecroRotationState(), byId("living_death"), castTick);
    expect(patch.necro.livingDeathUntilTick).toBe(
      castTick + secondsToTicks(LIVING_DEATH_DURATION_SECONDS),
    );
    expect(livingDeathActive(patch.necro, castTick)).toBe(true);
    expect(livingDeathActive(patch.necro, patch.necro.livingDeathUntilTick - 1)).toBe(true);
    expect(livingDeathActive(patch.necro, patch.necro.livingDeathUntilTick)).toBe(false);
    expect(patch.clearCooldownIds).toEqual(["touch_of_death", "death_skulls"]);
  });

  it("under Living Death: basic +2 Necrosis, ToD +6% adren, FoD 1.5×, DS CD 17 ticks", () => {
    let necro = activateLivingDeath(newNecroRotationState(), 0);
    const tick = 3;

    necro = applyNecroOnCast(necro, byId("necromancy_basic"), tick).necro;
    expect(necro.necrosisStacks).toBe(2);

    const tod = applyNecroOnCast(necro, byId("touch_of_death"), tick);
    expect(tod.adrenalineBonus).toBe(6);
    expect(tod.necro.necrosisStacks).toBe(2 + TOUCH_OF_DEATH_NECROSIS);

    const fod = resolveNecromancyAbility(byId("finger_of_death"), tod.necro, tick);
    expect(fod.hits[0]!.band).toEqual({ minPct: 405, maxPct: 495 });
    expect(necroAdrenalineCost(byId("finger_of_death"), tod.necro, tick)).toBe(0); // 6 stacks

    expect(deathSkullsCooldownTicks(necro, tick)).toBe(DEATH_SKULLS_LIVING_DEATH_COOLDOWN_TICKS);
    expect(deathSkullsCooldownTicks(newNecroRotationState(), tick)).toBe(secondsToTicks(60));
  });

  it("resolveNecromancyAbility rewrites Volley hits from current soul count", () => {
    const necro = { ...newNecroRotationState(), residualSouls: 4 };
    const resolved = resolveNecromancyAbility(volleyOfSouls(3), necro, 0);
    expect(resolved.hits).toHaveLength(4);
    expect((resolved as { soulCost?: number }).soulCost).toBe(4);
  });

  it("necroCanCast gates Soul Strike and Volley on residual souls", () => {
    const empty = newNecroRotationState();
    expect(necroCanCast(byId("soul_strike"), empty)).toBe(false);
    expect(necroCanCast(volleyOfSouls(3), empty)).toBe(false);
    expect(necroCanCast(byId("soul_sap"), empty)).toBe(true);

    const two = { ...empty, residualSouls: 2 };
    expect(necroCanCast(byId("soul_strike"), two)).toBe(true);
    expect(necroCanCast(volleyOfSouls(3), two)).toBe(true);
  });

  it("necroCanCast gates commands on active conjures", () => {
    const necro = newNecroRotationState();
    const empty = newConjures();
    expect(necroCanCast(byId("command_skeleton_warrior"), necro, empty, 0)).toBe(false);
    // Without conjure state, commands are closed.
    expect(necroCanCast(byId("command_skeleton_warrior"), necro)).toBe(false);

    const skel = summonConjure(empty, "skeleton_warrior", 0);
    expect(necroCanCast(byId("command_skeleton_warrior"), necro, skel, 0)).toBe(true);
    expect(necroCanCast(byId("conjure_skeleton_warrior"), necro, skel, 0)).toBe(false);
    expect(necroCanCast(byId("conjure_skeleton_warrior"), necro, empty, 0)).toBe(true);
  });

  it("applyNecroOnCast summons conjures and dismisses zombie on command", () => {
    const necro = newNecroRotationState();
    const cast = applyNecroOnCast(necro, byId("conjure_skeleton_warrior"), 0, newConjures());
    expect(cast.conjures).toBeDefined();
    expect(conjureActive(cast.conjures!, "skeleton_warrior", 0)).toBe(true);
    expect(cast.conjures!.spirits[0]!.untilTick).toBe(CONJURE_UNTIL_OFFSET_TICKS);

    const army = applyNecroOnCast(necro, byId("conjure_undead_army"), 5, newConjures());
    expect(army.conjures!.spirits).toHaveLength(3);

    let z = applyNecroOnCast(necro, byId("conjure_putrid_zombie"), 0, newConjures()).conjures!;
    expect(conjureActive(z, "putrid_zombie", 0)).toBe(true);
    z = applyNecroOnCast(necro, byId("command_putrid_zombie"), 10, z).conjures!;
    expect(conjureActive(z, "putrid_zombie", 10)).toBe(false);
  });
});
