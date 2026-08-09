import { describe, expect, it } from "vitest";
import { rotationOf } from "../engine/simulation/contracts";
import { simulate } from "../engine/simulation/simulate";
import { simulateRevolution } from "../engine/simulation/revolution";
import { baseInput } from "../test/fixtures/inputs";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { NECROMANCY_ABILITIES } from "../styles/necromancy/abilities";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { calculateAbility } from "../pipeline/calculateAbility";
import { calculateLeagueAbility } from "./damage";
import { leagueModifiers, resolveLeagueRules } from "./ruleset";
import { serializeLeague } from "../model";
import {
  emptyModifierSources,
  type SerializableRevolutionSimBase,
} from "../solver/worker/serializable";
import { reviveRevolutionBase } from "../solver/worker/revive";
import { runUiRevolution } from "../solver/worker/uiRunHost";
import { EQUIPMENT_SET_ACTIVATION, type ActiveEquipmentEffects } from "../shared/equipment";
import type { PlayerPoisonProfile } from "../poison/mechanics";

const cinderbaneProfile: PlayerPoisonProfile = {
  potion: "weapon",
  potionUntilTick: 250,
  kwuarmPotency: 0,
  cinderbane: true,
  blowpipe: false,
  laniakea: false,
};

const strikingLeague = resolveLeagueRules({
  ruleset: "equilibrium",
  blessingPicks: ["Order", "Order"],
});

const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;

const emptyEquipmentEffects: ActiveEquipmentEffects = {
  activation: EQUIPMENT_SET_ACTIVATION,
  setCritChance: { unconditional: 0, conditional: {} },
  passiveIds: [],
  enchantments: [],
  weaponClass: null,
  defenderEquipped: false,
  passage: { active: false, agonyActive: false },
  amZiFlatDamage: 0,
  amHejDamageBonus: 0,
  vestments: {
    pieces: 0,
    heraldOfChaos: false,
    berserkExtension: false,
    increasedAdrenalineCap: false,
  },
};

function basicPreview(ability: AbilitySpec, rules = strikingLeague) {
  return calculateLeagueAbility(ability, {
    base: 1_000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    modifiers: leagueModifiers(rules),
    context: { style: ability.style, ruleset: "equilibrium" },
    rules,
  });
}

function serializedBase(rules = strikingLeague): SerializableRevolutionSimBase {
  return {
    base: 1_000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    equipmentEffects: emptyEquipmentEffects,
    league: serializeLeague(rules),
    context: { style: "melee", ruleset: "equilibrium" },
    cap: { cap: 30_000, bypass: false },
    equipmentIds: [],
    weaponConfiguration: "dualwield",
    modifierSources: emptyModifierSources(),
  };
}

function revivedRevolutionInput(rules = strikingLeague) {
  const revived = reviveRevolutionBase(structuredClone(serializedBase(rules)));
  return {
    ...revived,
    bar: [attack],
    style: "melee" as const,
    durationTicks: 3,
    abilities: MELEE_ABILITIES,
  };
}

describe("Striking Light regression fixture", () => {
  it("resolves the isolated Basic Attack and Light at 2,180 total", () => {
    const modifiers = leagueModifiers(strikingLeague);
    const preview = calculateLeagueAbility(attack, {
      base: 1_000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      modifiers,
      context: { style: "melee", ruleset: "equilibrium" },
      rules: strikingLeague,
    });
    const light = preview.leagueContributions.find(
      (component) => component.effectId === "light-of-saradomin",
    );
    expect(preview.expected).toBe(2_180);
    expect(preview.hits[0]?.expected).toBe(1_680);
    expect(light?.damage.expected).toBe(500);

    const result = simulate({
      ...baseInput,
      league: strikingLeague,
      modifiers,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    expect(result.totalExpected).toBe(2_180);
    expect(result.events.filter((event) => event.abilityId === "light-of-saradomin")).toHaveLength(
      1,
    );
  });

  it("applies the multiplier to every style Basic Attack and to no ordinary basic", () => {
    const styles = [
      [MELEE_ABILITIES, "melee", "attack", 2_180],
      [RANGED_ABILITIES, "ranged", "ranged_attack", 1_900],
      [MAGIC_ABILITIES, "magic", "magic_attack", 1_900],
      [NECROMANCY_ABILITIES, "necromancy", "necromancy_basic", 1_900],
    ] as const;

    for (const [abilities, style, id, expected] of styles) {
      const ability = abilities.find((entry) => entry.id === id)!;
      const result = basicPreview(ability);
      expect(result.hits[0]?.expected, style).toBe(expected - 500);
      expect(result.expected, style).toBe(expected);
      expect(
        result.leagueContributions.filter(
          (component) => component.effectId === "light-of-saradomin",
        ),
        style,
      ).toHaveLength(1);
    }

    const ordinary = MELEE_ABILITIES.find((ability) => ability.id === "fury")!;
    const plain = calculateAbility(ordinary, {
      base: 1_000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      context: { style: "melee", ruleset: "equilibrium" },
    });
    const withStriking = basicPreview(ordinary);
    expect(withStriking.expected).toBe(plain.expected);
    expect(withStriking.leagueContributions).toHaveLength(0);
  });

  it("multiplies each hit of a multi-hit Basic Attack but triggers one Light volley", () => {
    const multiBasic: AbilitySpec = {
      id: "multi-basic-fixture",
      name: "Multi-hit Basic Fixture",
      style: "melee",
      category: "basic",
      basicAttack: true,
      hits: [{ band: { minPct: 100, maxPct: 100 } }, { band: { minPct: 50, maxPct: 50 } }],
    };
    const result = basicPreview(multiBasic);
    expect(result.hits.slice(0, 2).map((hit) => hit.expected)).toEqual([1_400, 700]);
    expect(
      result.leagueContributions.filter((component) => component.effectId === "light-of-saradomin"),
    ).toHaveLength(1);
    expect(result.expected).toBe(2_600);

    const simulated = simulate({
      ...baseInput,
      abilities: [multiBasic],
      league: strikingLeague,
      modifiers: leagueModifiers(strikingLeague),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("multi-basic-fixture"),
    });
    expect(simulated.totalExpected).toBe(2_600);
    expect(
      simulated.events.filter((event) => event.abilityId === "light-of-saradomin"),
    ).toHaveLength(1);
  });

  it("does not alter Revolution selection, adrenaline, or ordinary cast timing", () => {
    const controlLeague = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order"],
    });
    const bar = [MELEE_ABILITIES.find((ability) => ability.id === "meteor_strike")!, attack];
    const run = (league: typeof strikingLeague) =>
      simulateRevolution({
        ...baseInput,
        league,
        modifiers: leagueModifiers(league),
        context: { style: "melee", ruleset: "equilibrium" },
        bar,
        style: "melee",
        durationTicks: 30,
      });
    const control = run(controlLeague);
    const withStriking = run(strikingLeague);
    expect(
      withStriking.casts.map((cast) => [
        cast.tick,
        cast.abilityId,
        cast.adrenalineBefore,
        cast.adrenalineAfter,
      ]),
    ).toEqual(
      control.casts.map((cast) => [
        cast.tick,
        cast.abilityId,
        cast.adrenalineBefore,
        cast.adrenalineAfter,
      ]),
    );
    expect(withStriking.events.some((event) => event.abilityId === "light-of-saradomin")).toBe(
      true,
    );
    expect(withStriking.totalExpected).toBeGreaterThan(control.totalExpected);
  });

  it("keeps Perfidious limited to Striking Light's cooldown", () => {
    const perfidiousLeague = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Order", "Balance", "Balance", "Balance", "Chaos"],
    });
    expect(perfidiousLeague.blessingIds.has("striking-light")).toBe(true);
    expect(perfidiousLeague.blessingIds.has("perfidious")).toBe(true);
    const run = (league: typeof strikingLeague) =>
      simulate({
        ...baseInput,
        league,
        modifiers: leagueModifiers(league),
        context: { style: "melee", ruleset: "equilibrium" },
        rotation: rotationOf(...Array.from({ length: 9 }, () => "attack")),
      });
    const normal = run(strikingLeague);
    const perfidious = run(perfidiousLeague);
    const lightTicks = (result: ReturnType<typeof run>) =>
      result.events
        .filter((event) => event.abilityId === "light-of-saradomin")
        .map((event) => event.tick);
    expect(lightTicks(normal)).toEqual([0, 15]);
    expect(lightTicks(perfidious)).toEqual([0, 9, 18]);
    expect(perfidious.casts.map((cast) => [cast.tick, cast.abilityId])).toEqual(
      normal.casts.map((cast) => [cast.tick, cast.abilityId]),
    );
  });

  it("keeps host, serialized-worker, UI Run, score-only, and full-analysis totals aligned", async () => {
    const hostInput = {
      ...baseInput,
      league: strikingLeague,
      modifiers: leagueModifiers(strikingLeague),
      context: { style: "melee" as const, ruleset: "equilibrium" as const },
      bar: [attack],
      style: "melee" as const,
      durationTicks: 3,
    };
    const hostFull = simulateRevolution(hostInput, { detailLevel: "full-analysis" });
    const hostScore = simulateRevolution(hostInput, { detailLevel: "score-only" });
    const workerFull = simulateRevolution(revivedRevolutionInput(), {
      detailLevel: "full-analysis",
    });
    const workerScore = simulateRevolution(revivedRevolutionInput(), { detailLevel: "score-only" });
    const uiRun = await runUiRevolution(
      {
        loadout: serializedBase(),
        barIds: ["attack"],
        style: "melee",
        durationTicks: 3,
      },
      { forceMainThread: true },
    );

    for (const result of [hostFull, hostScore, workerFull, workerScore, uiRun.summary]) {
      expect(result.totalExpected).toBe(2_180);
    }
    expect(hostScore.totalExpected).toBe(hostFull.totalExpected);
    expect(workerFull.totalExpected).toBe(hostFull.totalExpected);
    expect(workerScore.totalExpected).toBe(hostFull.totalExpected);
    expect(workerFull.events.map((event) => event.abilityId)).toEqual(
      hostFull.events.map((event) => event.abilityId),
    );
    expect(uiRun.summary.events.map((event) => event.abilityId)).toEqual(
      hostFull.events.map((event) => event.abilityId),
    );
    expect(uiRun.meta.lanes).toBe(1);
    expect(uiRun.summary.rng).toBeUndefined();
  });

  it("keeps Big Boned attached to Light without changing the Basic Attack", () => {
    const bigBonedLeague = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Balance", "Order"] },
      { maximumLife: 15_000 },
    );
    const bigBoned = simulate({
      ...baseInput,
      league: bigBonedLeague,
      modifiers: leagueModifiers(bigBonedLeague),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const bigBonedLight = bigBoned.events.find((event) => event.abilityId === "light-of-saradomin");
    expect(bigBoned.events.find((event) => event.abilityId === "attack")?.damage.expected).toBe(
      2_430,
    );
    expect(bigBonedLight?.damage.expected).toBe(1_250);
    expect(
      bigBonedLight?.components?.find((component) => component.id === "big-boned"),
    ).toBeDefined();
  });

  it("keeps Cinders and Cinderbane separate from Striking Light", () => {
    const cindersLeague = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Chaos", "Chaos"],
    });
    const cinders = simulate({
      ...baseInput,
      league: cindersLeague,
      modifiers: leagueModifiers(cindersLeague),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const cindersHost = cinders.events.find((event) => event.abilityId === "attack");
    expect(cindersHost?.damage.expected).toBe(1_350);
    expect(
      cindersHost?.components?.find((component) => component.id === "abyssal-cinders")?.damage
        .expected,
    ).toBe(150);
    expect(cinders.events.some((event) => event.abilityId === "light-of-saradomin")).toBe(false);

    const controlPoisonLeague = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order"],
    });
    const controlPoison = simulate({
      ...baseInput,
      league: controlPoisonLeague,
      modifiers: leagueModifiers(controlPoisonLeague),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
      horizonTicks: 1,
      playerPoison: cinderbaneProfile,
    });
    const strikingPoison = simulate({
      ...baseInput,
      league: strikingLeague,
      modifiers: leagueModifiers(strikingLeague),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
      horizonTicks: 1,
      playerPoison: cinderbaneProfile,
    });
    expect(strikingPoison.playerPoison?.applicationAttempts).toBe(
      (controlPoison.playerPoison?.applicationAttempts ?? 0) + 1,
    );
    expect(strikingPoison.playerPoison?.probabilityMass).toBeCloseTo(1, 12);
  });

  it("keeps Aftershock and Avernic attached to the same Basic Attack policy", () => {
    const rampageLeague = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Order", "Chaos"],
    });
    const rampageControlLeague = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Balance", "Chaos"],
    });
    const revolution = (league: typeof strikingLeague) =>
      simulateRevolution({
        ...baseInput,
        league,
        modifiers: leagueModifiers(league),
        context: { style: "melee", ruleset: "equilibrium" },
        bar: [attack],
        style: "melee",
        durationTicks: 3,
        adrenaline: { impatientRank: 4, relentlessRank: 4 },
        procs: { aftershockRank: 4 },
      });
    const rampage = revolution(rampageLeague);
    const rampageControl = revolution(rampageControlLeague);
    expect(
      rampage.casts.map((cast) => [
        cast.tick,
        cast.abilityId,
        cast.adrenalineBefore,
        cast.adrenalineAfter,
      ]),
    ).toEqual(
      rampageControl.casts.map((cast) => [
        cast.tick,
        cast.abilityId,
        cast.adrenalineBefore,
        cast.adrenalineAfter,
      ]),
    );
    expect(rampage.totalExpected).toBeGreaterThan(rampageControl.totalExpected);
  });
});
