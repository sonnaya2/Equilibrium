import { describe, expect, it } from "vitest";
import { allEngineSpecs, engineSpecs, engineSpecsForStyle } from "../../abilities/registry";
import { secondsToTicks } from "../../core/ticks";
import { resolveBarSlot } from "../../data/specs";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { rotationOf } from "../../engine/simulation/contracts";
import { calculateAbility } from "../../pipeline/calculateAbility";
import { buildCandidatePool } from "../../solver/candidatePool";
import { baseInput } from "../../test/fixtures/inputs";
import {
  abilityStyleForBar,
  isSharedConstitutionAbilityId,
  SACRIFICE,
  SACRIFICE_HEAL_FRACTION,
  sacrificeExpectedHeal,
  SHARED_CONSTITUTION_ABILITIES,
  TUSKAS_EMPOWERED_COOLDOWN_SECONDS,
  TUSKAS_EMPOWERED_HIT_CAP,
  TUSKAS_EMPOWERED_SLAYER_MULT,
  TUSKAS_OFF_TASK_COOLDOWN_SECONDS,
  TUSKAS_WRATH,
  tuskasEmpoweredActive,
  tuskasEmpoweredDamage,
} from "./constitutionAbilities";

const STYLES = ["melee", "ranged", "magic", "necromancy"] as const;

describe("shared constitution abilities", () => {
  it("registers sacrifice and tuskas_wrath once each", () => {
    expect(SHARED_CONSTITUTION_ABILITIES.map((a) => a.id)).toEqual(["sacrifice", "tuskas_wrath"]);
    expect(isSharedConstitutionAbilityId("sacrifice")).toBe(true);
    expect(isSharedConstitutionAbilityId("tuskas_wrath")).toBe(true);
    expect(isSharedConstitutionAbilityId("rend")).toBe(false);
    expect(allEngineSpecs().filter((a) => a.id === "sacrifice")).toHaveLength(1);
    expect(allEngineSpecs().filter((a) => a.id === "tuskas_wrath")).toHaveLength(1);
  });

  it("uses wiki bands, adren, and CDs", () => {
    expect(SACRIFICE.category).toBe("basic");
    expect(SACRIFICE.hits).toEqual([{ band: { minPct: 65, maxPct: 75 } }]);
    expect(SACRIFICE.adrenaline).toEqual({ gain: 9 });
    expect(SACRIFICE.cooldownSeconds).toBe(30);
    expect(SACRIFICE.supportStatus).toBeUndefined();
    expect(SACRIFICE.supportNote).toMatch(/heal/i);
    expect(SACRIFICE.supportNote).toMatch(/kill-blow/i);

    expect(TUSKAS_WRATH.category).toBe("basic");
    expect(TUSKAS_WRATH.hits).toEqual([{ band: { minPct: 75, maxPct: 85 } }]);
    expect(TUSKAS_WRATH.adrenaline).toEqual({ gain: 9 });
    expect(TUSKAS_WRATH.cooldownSeconds).toBe(TUSKAS_OFF_TASK_COOLDOWN_SECONDS);
    expect(TUSKAS_WRATH.supportStatus).toBeUndefined();
    expect(TUSKAS_WRATH.supportNote).toMatch(/on-task/i);
    expect(TUSKAS_WRATH.supportNote).toMatch(/slayerOnTask/i);
  });

  it("sacrificeExpectedHeal is 25% floored; never invents kill-blow", () => {
    expect(SACRIFICE_HEAL_FRACTION).toBe(0.25);
    expect(sacrificeExpectedHeal(700)).toBe(175);
    expect(sacrificeExpectedHeal(701)).toBe(175);
    expect(sacrificeExpectedHeal(0)).toBe(0);
    expect(sacrificeExpectedHeal(-10)).toBe(0);
    expect(sacrificeExpectedHeal(Number.NaN)).toBe(0);
  });

  it("tuskasEmpoweredDamage is 100x Slayer capped at 15k; no invented level", () => {
    expect(TUSKAS_EMPOWERED_SLAYER_MULT).toBe(100);
    expect(TUSKAS_EMPOWERED_HIT_CAP).toBe(15_000);
    expect(tuskasEmpoweredDamage(99)).toBe(9900);
    expect(tuskasEmpoweredDamage(120)).toBe(12_000);
    expect(tuskasEmpoweredDamage(200)).toBe(15_000);
    expect(tuskasEmpoweredDamage(undefined)).toBe(0);
    expect(tuskasEmpoweredDamage(null)).toBe(0);
    expect(tuskasEmpoweredDamage(0)).toBe(0);
    expect(tuskasEmpoweredActive({ slayerOnTask: true, slayerLevel: 99 })).toBe(true);
    expect(tuskasEmpoweredActive({ slayerOnTask: true })).toBe(false);
    expect(tuskasEmpoweredActive({ slayerLevel: 99 })).toBe(false);
    expect(tuskasEmpoweredActive({})).toBe(false);
  });

  it("remaps style per bar without cloning engine id", () => {
    const necroSac = abilityStyleForBar(SACRIFICE, "necromancy");
    expect(necroSac.id).toBe("sacrifice");
    expect(necroSac.style).toBe("necromancy");
    expect(abilityStyleForBar(SACRIFICE, "melee")).toBe(SACRIFICE);

    const magicTuska = abilityStyleForBar(TUSKAS_WRATH, "magic");
    expect(magicTuska.id).toBe("tuskas_wrath");
    expect(magicTuska.style).toBe("magic");
  });

  it("calculateAbility deals expected band damage at base 1000", () => {
    const sac = calculateAbility(SACRIFICE, {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
    });
    expect(sac.min).toBe(650);
    expect(sac.max).toBe(750);
    expect(sac.expected).toBe(700);
    expect(sac.listedAdrenalineDelta).toBe(9);

    const tuska = calculateAbility(TUSKAS_WRATH, {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
    });
    expect(tuska.min).toBe(750);
    expect(tuska.max).toBe(850);
    expect(tuska.expected).toBe(800);
    expect(tuska.listedAdrenalineDelta).toBe(9);
  });

  it("appears in every style candidate pool and engineSpecsForStyle", () => {
    const catalogue = allEngineSpecs();
    for (const style of STYLES) {
      const pool = buildCandidatePool(catalogue, style);
      expect(pool.byId.has("sacrifice"), `pool sacrifice ${style}`).toBe(true);
      expect(pool.byId.get("sacrifice")!.style, `pool sacrifice style ${style}`).toBe(style);
      expect(pool.byId.has("tuskas_wrath"), `pool tuskas ${style}`).toBe(true);
      expect(pool.byId.get("tuskas_wrath")!.style, `pool tuskas style ${style}`).toBe(style);

      const specs = engineSpecsForStyle(style);
      expect(specs.find((s) => s.id === "sacrifice")?.style, style).toBe(style);
      expect(specs.find((s) => s.id === "tuskas_wrath")?.style, style).toBe(style);
    }
  });

  it("resolveBarSlot uses engine and bar style for shared record ids", () => {
    const sac = resolveBarSlot(
      { name: "Sacrifice", abilityId: "shared:sacrifice" },
      engineSpecs,
      "magic",
    );
    expect(sac.modelledBy).toBe("engine");
    expect(sac.spec?.id).toBe("sacrifice");
    expect(sac.spec?.style).toBe("magic");
    expect(sac.spec?.hits[0]?.band).toEqual({ minPct: 65, maxPct: 75 });

    const tuska = resolveBarSlot(
      { name: "Tuska's Wrath", abilityId: "shared:tuskas-wrath" },
      engineSpecs,
      "ranged",
    );
    expect(tuska.modelledBy).toBe("engine");
    expect(tuska.spec?.id).toBe("tuskas_wrath");
    expect(tuska.spec?.style).toBe("ranged");
    expect(tuska.spec?.hits[0]?.band).toEqual({ minPct: 75, maxPct: 85 });

    const byEngineId = resolveBarSlot(
      { name: "Tuska's Wrath", abilityId: "tuskas_wrath" },
      engineSpecs,
      "necromancy",
    );
    expect(byEngineId.modelledBy).toBe("engine");
    expect(byEngineId.spec?.style).toBe("necromancy");
  });

  it("casts once and applies 15s (25 tick) cooldown off-task", () => {
    const stamped = abilityStyleForBar(TUSKAS_WRATH, "melee");
    const ctx = createCastContext({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
    });
    expect(ctx.performCast(ctx.byId.get("tuskas_wrath")!, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.tuskas_wrath).toBe(secondsToTicks(15));
    expect(secondsToTicks(15)).toBe(25);

    const summary = ctx.finish();
    expect(summary.ok).toBe(true);
    expect(summary.casts.some((c) => c.abilityId === "tuskas_wrath")).toBe(true);
  });

  it("sacrifice heals 25% of damage dealt on cast / totalHealed", () => {
    const stamped = abilityStyleForBar(SACRIFICE, "melee");
    const summary = simulate({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
      rotation: rotationOf("sacrifice"),
    });
    expect(summary.ok, summary.error).toBe(true);
    const cast = summary.casts.find((c) => c.abilityId === "sacrifice");
    expect(cast).toBeDefined();
    // base 1000, 65-75% band, accuracy 1, no crit -> expected 700.
    expect(cast!.result.expected).toBe(700);
    expect(cast!.expectedHeal).toBe(sacrificeExpectedHeal(700));
    expect(cast!.expectedHeal).toBe(175);
    expect(summary.totalHealed).toBe(175);
    expect(summary.totalHealed).toBe(sacrificeExpectedHeal(summary.perAbility.sacrifice!));
  });

  it("tuskas on-task uses 100x Slayer, 15k cap, and 120s CD", () => {
    const stamped = abilityStyleForBar(TUSKAS_WRATH, "melee");
    const summary = simulate({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
      rotation: rotationOf("tuskas_wrath"),
      slayerOnTask: true,
      slayerLevel: 99,
    });
    expect(summary.ok, summary.error).toBe(true);
    const cast = summary.casts.find((c) => c.abilityId === "tuskas_wrath");
    expect(cast).toBeDefined();
    expect(cast!.result.expected).toBe(9900);
    expect(cast!.result.min).toBe(9900);
    expect(cast!.result.max).toBe(9900);
    expect(summary.perAbility.tuskas_wrath).toBe(9900);

    const ctx = createCastContext({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
      slayerOnTask: true,
      slayerLevel: 99,
    });
    expect(ctx.performCast(ctx.byId.get("tuskas_wrath")!, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.tuskas_wrath).toBe(
      secondsToTicks(TUSKAS_EMPOWERED_COOLDOWN_SECONDS),
    );
    expect(secondsToTicks(TUSKAS_EMPOWERED_COOLDOWN_SECONDS)).toBe(200);
  });

  it("tuskas on-task without slayerLevel stays off-task (no invented level)", () => {
    const stamped = abilityStyleForBar(TUSKAS_WRATH, "melee");
    const summary = simulate({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
      rotation: rotationOf("tuskas_wrath"),
      slayerOnTask: true,
      // slayerLevel omitted intentionally
    });
    expect(summary.ok, summary.error).toBe(true);
    const cast = summary.casts.find((c) => c.abilityId === "tuskas_wrath");
    expect(cast).toBeDefined();
    // base 1000, 75-85% band -> expected 800.
    expect(cast!.result.expected).toBe(800);

    const ctx = createCastContext({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
      slayerOnTask: true,
    });
    expect(ctx.performCast(ctx.byId.get("tuskas_wrath")!, 0, false).ok).toBe(true);
    expect(ctx.getState().cooldowns.tuskas_wrath).toBe(secondsToTicks(15));
  });

  it("tuskas empowered damage is capped at 15k", () => {
    const stamped = abilityStyleForBar(TUSKAS_WRATH, "melee");
    const summary = simulate({
      ...baseInput,
      abilities: [...baseInput.abilities, stamped],
      rotation: rotationOf("tuskas_wrath"),
      slayerOnTask: true,
      slayerLevel: 200,
    });
    expect(summary.ok, summary.error).toBe(true);
    const cast = summary.casts.find((c) => c.abilityId === "tuskas_wrath");
    expect(cast!.result.expected).toBe(TUSKAS_EMPOWERED_HIT_CAP);
  });
});
