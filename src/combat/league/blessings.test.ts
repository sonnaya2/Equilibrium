import { describe, expect, it } from "vitest";
import { blessingChoice, type BlessingPath } from "../../league/blessings";
import { createCastContext, simulate } from "../engine/simulation/simulate";
import { rotationOf } from "../engine/simulation/contracts";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { baseInput } from "../test/fixtures/inputs";
import { calculateLeagueAbility } from "./damage";
import {
  blessingArmourMultiplier,
  blessingAdrenalineGenerationMultiplier,
  blessingFinalLifeMultiplier,
  blessingLifeMultiplier,
  leagueModifiers,
  resolveLeagueRules,
} from "./ruleset";
import { runPipeline } from "../pipeline/modifierPipeline";

const rules = (
  blessingPicks: readonly BlessingPath[],
  derived: {
    totalArmour?: number;
    maximumLife?: number;
    targetTiles?: number;
    areaTargets?: number;
    prayerBonus?: number;
  } = {},
) => resolveLeagueRules({ ruleset: "equilibrium", blessingPicks }, derived);

describe("Equilibrium blessing combat rules", () => {
  it("keeps root bonus riders separate from one Bernoulli Inferno hit", () => {
    const league = rules(["Balance", "Chaos"], { maximumLife: 15_000 });
    const result = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    expect(result.totalExpected).toBeCloseTo(1_200 + 750 + 150 + 0.05 * (1_500 + 750), 6);
    expect(
      result.events.filter((event) => event.blessingId).map((event) => event.abilityId),
    ).toEqual(["big-boned", "abyssal-cinders", "inferno-of-zamorak", "big-boned"]);
    const cindersOnAttack = result.events.find((e) => e.abilityId === "abyssal-cinders")!;
    expect(cindersOnAttack).toMatchObject({
      attached: true,
      damageTag: "bonus-damage",
      expectedSeparateHits: 0,
    });
    expect(cindersOnAttack.expectedActivations).toBe(1);
    expect(cindersOnAttack.damage.expected).toBe(150);
    const bigBoned = result.events.filter((event) => event.abilityId === "big-boned");
    expect(bigBoned).toHaveLength(2);
    expect(bigBoned.reduce((sum, event) => sum + event.expectedActivations!, 0)).toBeCloseTo(
      1.05,
      10,
    );
    expect(bigBoned.reduce((sum, event) => sum + event.damage.expected, 0)).toBeCloseTo(787.5, 6);
    expect(
      result.analysis.byEffect.find((effect) => effect.id === "abyssal-cinders")?.bonusDamage,
    ).toBe(0);
    expect(
      result.analysis.byEffect.find((effect) => effect.id === "inferno-of-zamorak")?.bonusDamage,
    ).toBeCloseTo(37.5, 6);
    const inferno = result.events.find((event) => event.abilityId === "inferno-of-zamorak")!;
    expect(inferno).toMatchObject({
      family: "blessing",
      attached: false,
      damage: { min: 0 },
    });
    expect(inferno.expectedOccurrences).toBeCloseTo(0.05, 10);
    expect(inferno.expectedTriggerRolls).toBe(1);
    expect(inferno.expectedActivations).toBeCloseTo(0.05, 10);
    expect(inferno.expectedSeparateHits).toBeCloseTo(0.05, 10);
    expect(inferno.damage.max).toBe(2_000);
    expect(inferno.damage.expected).toBe(75);
    const infernoAnalysis = result.analysis.byEffect.find(
      (effect) => effect.id === "inferno-of-zamorak",
    )!;
    expect(infernoAnalysis.expectedActivations).toBeCloseTo(0.05, 10);
    expect(infernoAnalysis.averagePerActivation).toBeCloseTo(1_500, 6);
    expect(simulate({ ...baseInput, rotation: rotationOf("attack") }).totalExpected).toBe(1_200);
  });

  it("inherits each actual host's crit state without Big Boned on Cinders", () => {
    const result = simulate({
      ...baseInput,
      league: rules(["Balance", "Chaos"], { maximumLife: 15_000 }),
      crit: { chance: 0.2 },
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const bigBoned = result.events.filter((event) => event.abilityId === "big-boned");
    const infernoHit = result.events.find((event) => event.abilityId === "inferno-of-zamorak")!;
    const root = bigBoned.find((event) => event.derivedFrom !== infernoHit.seq)!;
    const inferno = bigBoned.find((event) => event.derivedFrom === infernoHit.seq)!;
    expect(bigBoned).toHaveLength(2);
    expect(bigBoned.some((event) => event.bonusTargetId === "abyssal-cinders")).toBe(false);
    expect(root.damage.critical).toMatchObject({ chance: 0.2, inherited: true });
    expect(inferno.damage.critical).toMatchObject({ chance: 0.2, inherited: true });
  });

  it("includes Big Boned outgoing damage while keeping max-life multiplier", () => {
    const league = rules(["Balance", "Chaos"], { maximumLife: 15_000 });
    expect(blessingLifeMultiplier({ ruleset: "equilibrium", blessingPicks: ["Balance"] })).toBe(
      1.5,
    );
    const result = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    expect(result.totalExpected).toBeCloseTo(1_200 + 750 + 150 + 0.05 * (1_500 + 750), 6);
    expect(result.events.filter((event) => event.abilityId === "big-boned")).toHaveLength(2);
    expect(
      result.events.filter((event) => event.blessingId).map((event) => event.abilityId),
    ).toEqual(["big-boned", "abyssal-cinders", "inferno-of-zamorak", "big-boned"]);
  });

  it("rides Big Boned onto Light of Saradomin without infinite cascade", () => {
    // Tier1 Balance = Big Boned; tier2 Order = Striking Light.
    const league = rules(["Balance", "Order"], { maximumLife: 15_000, totalArmour: 1_000 });
    const withoutBb = simulate({
      ...baseInput,
      league: rules(["Order", "Order"], { totalArmour: 1_000 }),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const withBb = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const light = withBb.events.find((event) => event.abilityId === "light-of-saradomin");
    expect(light).toBeDefined();
    const bbOnLight = withBb.events.filter(
      (event) => event.abilityId === "big-boned" && event.derivedFrom === light!.seq,
    );
    expect(bbOnLight).toHaveLength(1);
    expect(bbOnLight[0]).toMatchObject({
      attached: true,
      damageTag: "bonus-damage",
      blessingId: "big-boned",
      expectedActivations: 1,
    });
    // Flat 5% of 15k max life on Light (and parent).
    expect(bbOnLight[0]!.damage.expected).toBe(750);
    expect(withBb.totalExpected).toBeGreaterThan(withoutBb.totalExpected);
    // No BB-on-BB: attached riders never host further blessing events.
    const bbSeqs = new Set(
      withBb.events.filter((e) => e.abilityId === "big-boned").map((e) => e.seq),
    );
    for (const event of withBb.events) {
      if (event.derivedFrom != null) {
        expect(bbSeqs.has(event.derivedFrom)).toBe(false);
      }
    }
    // Light never re-rolls on-hit blessings from itself.
    expect(withBb.events.filter((e) => e.abilityId === "light-of-saradomin")).toHaveLength(1);
  });

  it("enforces Striking Light's 15-tick cooldown and Sacred Fervor's cooldown clock", () => {
    const league = rules(["Order", "Order", "Order"], { totalArmour: 1_000 });
    const result = simulate({
      ...baseInput,
      league,
      modifiers: leagueModifiers(league),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack", "attack", "attack", "attack", "attack", "attack"),
    });
    expect(
      result.events
        .filter((event) => event.abilityId === "light-of-saradomin")
        .map((event) => event.tick),
    ).toEqual([0, 15]);

    const dragonBreath = MAGIC_ABILITIES.find((ability) => ability.id === "dragon_breath")!;
    const context = createCastContext({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      league,
      context: { style: "magic", ruleset: "equilibrium" },
    });
    expect(context.performCast(dragonBreath, 0, false).ok).toBe(true);
    expect(context.firstLegalTick(dragonBreath.id)).toBe(8);
  });

  it("limits Light of Saradomin triggers to post-modernisation Basic Attacks", () => {
    const league = rules(["Order", "Order"], { totalArmour: 1_000 });
    const ordinaryBasic = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("rend"),
    });
    expect(
      ordinaryBasic.events.filter((event) => event.abilityId === "light-of-saradomin"),
    ).toHaveLength(0);

    const attack = baseInput.abilities.find((ability) => ability.id === "attack")!;
    const legacyAuto = calculateLeagueAbility(
      { ...attack, basicAttack: undefined, autoAttack: true },
      {
        base: 1_000,
        level: 99,
        accuracy: 1,
        crit: { chance: 0 },
        context: { style: "melee", ruleset: "equilibrium" },
        rules: league,
      },
    );
    expect(legacyAuto.leagueContributions).toHaveLength(0);
  });

  it("models Lord of Light strikes, Prayer scaling, area targets, healing, and cooldown", () => {
    const league = rules(["Order", "Balance", "Balance", "Order", "Order"], {
      totalArmour: 1_000,
      prayerBonus: 10,
      areaTargets: 2,
    });
    const result = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const lights = result.events.filter((event) => event.abilityId === "light-of-saradomin");
    expect(lights).toHaveLength(10);
    expect(lights.every((event) => event.blessingId === "lord-of-light")).toBe(true);
    expect(lights.every((event) => event.tick === 0)).toBe(true);
    expect(lights.map((event) => event.damage.expected)).toEqual(Array(10).fill(3_600));
    expect(result.totalExpected).toBe(37_200);
    expect(result.totalHealed).toBe(1_800);

    const withBigBoned = simulate({
      ...baseInput,
      league: rules(["Balance", "Balance", "Order", "Order", "Order"], {
        totalArmour: 1_000,
        maximumLife: 15_000,
        areaTargets: 2,
      }),
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    const lordLights = withBigBoned.events.filter(
      (event) => event.abilityId === "light-of-saradomin" && event.blessingId === "lord-of-light",
    );
    const lordLightSeqs = new Set(lordLights.map((event) => event.seq));
    expect(lordLights).toHaveLength(10);
    expect(
      withBigBoned.events.filter(
        (event) => event.abilityId === "big-boned" && lordLightSeqs.has(event.derivedFrom ?? -1),
      ),
    ).toHaveLength(10);

    const both = rules(["Chaos", "Order", "Balance", "Order", "Order"], {
      totalArmour: 1_000,
    });
    const cooldownRun = simulate({
      ...baseInput,
      league: both,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf(
        "attack",
        "attack",
        "attack",
        "attack",
        "attack",
        "attack",
        "attack",
        "attack",
        "attack",
      ),
    });
    const byBlessing = (id: "striking-light" | "lord-of-light") =>
      cooldownRun.events
        .filter((event) => event.abilityId === "light-of-saradomin" && event.blessingId === id)
        .map((event) => event.tick);
    expect(byBlessing("striking-light")).toEqual([0, 15]);
    expect(byBlessing("lord-of-light")).toEqual([...Array(5).fill(0), ...Array(5).fill(24)]);

    const perfidious = rules(["Chaos", "Order", "Balance", "Order", "Order", "Chaos"], {
      totalArmour: 1_000,
    });
    const perfidiousRun = simulate({
      ...baseInput,
      league: perfidious,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf(
        "attack",
        "attack",
        "attack",
        "attack",
        "attack",
        "attack",
        "attack",
        "attack",
        "attack",
      ),
    });
    const perfidiousTicks = (id: "striking-light" | "lord-of-light") =>
      perfidiousRun.events
        .filter((event) => event.abilityId === "light-of-saradomin" && event.blessingId === id)
        .map((event) => event.tick);
    expect(perfidiousTicks("striking-light")).toEqual([0, 9, 18]);
    expect(perfidiousTicks("lord-of-light")).toEqual([...Array(5).fill(0), ...Array(5).fill(24)]);
  });

  it("pulses Tempered Heart on the canonical two-tick clock", () => {
    const league = rules(["Order", "Balance", "Balance", "Balance", "Balance", "Order"]);
    const attack = baseInput.abilities.find((ability) => ability.id === "attack")!;
    const context = createCastContext({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
    });
    expect(context.performCast(attack, 0, false).ok).toBe(true);
    expect(context.getState()).toMatchObject({ tick: 3, adrenaline: 15 });
    expect(context.performCast(attack, 3, false).ok).toBe(true);
    expect(context.getState()).toMatchObject({ tick: 6, adrenaline: 36 });
    expect(context.performCast(attack, 6, false).ok).toBe(true);
    expect(context.getState()).toMatchObject({ tick: 9, adrenaline: 51 });
  });

  it("applies Splash Zone only to tagged attacks and Adrenaline Junkie only to ability gains", () => {
    const league = rules(["Chaos", "Balance", "Balance"], { targetTiles: 4 });
    const dragonBreath = MAGIC_ABILITIES.find((ability) => ability.id === "dragon_breath")!;
    const result = calculateLeagueAbility(dragonBreath, {
      base: 1_000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      modifiers: leagueModifiers(league),
      context: { style: "magic", ruleset: "equilibrium" },
      rules: league,
    });
    expect(result).toMatchObject({ min: 1_650, max: 1_950 });
    expect(result.expected).toBeCloseTo(1_800, 0);
    expect(blessingAdrenalineGenerationMultiplier(league)).toBe(1.5);
    expect(result.adrenalineDelta).toBe(13.5);
  });

  it("branches Avernic Rampage and makes only later casts inside its window free", () => {
    const league = rules(["Chaos", "Chaos", "Chaos"]);
    const assault = baseInput.abilities.find((ability) => ability.id === "assault")!;
    const context = createCastContext({
      ...baseInput,
      league,
      startingAdrenaline: 100,
      context: { style: "melee", ruleset: "equilibrium" },
    });
    expect(context.performCast(assault, 0, false, { "avernic-rampage": true }).ok).toBe(true);
    expect(context.getState()).toMatchObject({
      adrenaline: 75,
      league: { avernicRampageUntilTick: 12 },
    });
    expect(
      context.performCast(assault, context.firstLegalTick(assault.id), false, {
        "avernic-rampage": false,
      }).ok,
    ).toBe(true);
    expect(context.getState().adrenaline).toBe(75);

    const branched = simulate({
      ...baseInput,
      league,
      context: { style: "melee", ruleset: "equilibrium" },
      rotation: rotationOf("attack"),
    });
    expect(branched.rng).toMatchObject({
      method: "probability-weighted branching",
      terminalClasses: 2,
      representativeClassWeight: 0.95,
    });
  });

  it("keeps long Avernic rotations exact and bounded", () => {
    const rotation = rotationOf(...Array(100).fill("attack"));
    const withoutAvernic = simulate(
      {
        ...baseInput,
        league: rules(["Order", "Order"]),
        context: { style: "melee", ruleset: "equilibrium" },
        rotation,
      },
      { detailLevel: "score-only" },
    );
    const withAvernic = simulate(
      {
        ...baseInput,
        league: rules(["Order", "Order", "Chaos"]),
        context: { style: "melee", ruleset: "equilibrium" },
        rotation,
      },
      { detailLevel: "score-only" },
    );
    expect(withAvernic.totalExpected).toBeCloseTo(withoutAvernic.totalExpected, 6);
    expect(withAvernic.rng?.residualWeight).toBe(0);
    expect(withAvernic.rng?.terminalClasses).toBeLessThanOrEqual(8);
  });
});

describe("Havoc Born", () => {
  const picks = ["Order", "Balance", "Balance", "Chaos"] as const;

  it("is the Chaos tier-5 choice with sourced combat parameters", () => {
    expect(blessingChoice(5, "Chaos")).toMatchObject({
      id: "havoc-born",
      name: "Havoc Born",
      path: "Chaos",
      source: { url: "https://runescape.wiki/w/Special:PermanentLink/37141126" },
      combat: { damageMultiplier: 1.2, maximumLifeMultiplier: 0.75, armourMultiplier: 0.75 },
    });
  });

  it("uses one shared damage modifier across outgoing provenance kinds", () => {
    const league = rules(picks);
    const modifier = leagueModifiers(league).find((entry) => entry.id === "blessing:havoc-born")!;
    expect(modifier.stage).toBe("postHit");
    const applicable = [
      "player_direct",
      "player_dot",
      "conjure_auto",
      "conjure_poison",
      "conjure_command",
      "equipment_proc",
      "invention_proc",
      "attached",
      "reflected",
      "blessing",
    ] as const;
    for (const kind of applicable) {
      expect(
        modifier.applies({ style: "melee", ruleset: "equilibrium", provenance: { kind } }),
      ).toBe(true);
    }
    expect(
      modifier.apply({ damage: 1_000 }, { style: "melee", ruleset: "equilibrium" }).damage,
    ).toBe(1_200);
  });

  it("stacks with another outgoing modifier in pipeline order", () => {
    const league = rules(["Balance", "Balance", "Chaos", "Chaos"], { targetTiles: 2 });
    const result = runPipeline({ damage: 1_000 }, leagueModifiers(league), {
      style: "magic",
      ruleset: "equilibrium",
      area: "aoe",
    });
    expect(result.damage).toBe(1_680);
  });

  it("changes simulation damage while disabled or switched off", () => {
    const attack = baseInput.abilities.find((ability) => ability.id === "attack")!;
    const league = rules(picks);
    const input = {
      ...baseInput,
      rules: league,
      context: { style: "melee" as const, ruleset: "equilibrium" as const },
    };
    const plain = calculateLeagueAbility(attack, { ...input, modifiers: [] });
    const havoc = calculateLeagueAbility(attack, {
      ...input,
      modifiers: leagueModifiers(league),
    });
    expect(plain.expected).toBe(1_200);
    expect(havoc.expected).toBeCloseTo(1_440, 0);
    expect(leagueModifiers(rules(["Order", "Balance", "Balance", "Order"]))).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "blessing:havoc-born" })]),
    );
  });

  it("keeps Havoc Born as a final life stage beside positive life blessings", () => {
    const loadout = {
      ruleset: "equilibrium" as const,
      blessingPicks: ["Balance", "Balance", "Chaos", "Chaos"] as const,
    };
    expect(blessingLifeMultiplier(loadout)).toBe(1.5);
    expect(blessingFinalLifeMultiplier(loadout)).toBe(0.75);
    expect(blessingArmourMultiplier(loadout)).toBe(0.75);
    expect(blessingLifeMultiplier({ ruleset: "base", blessingPicks: picks })).toBe(1);
    expect(blessingArmourMultiplier({ ruleset: "base", blessingPicks: picks })).toBe(1);
  });
});
