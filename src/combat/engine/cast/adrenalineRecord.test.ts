import { describe, expect, it } from "vitest";
import { createCastContext } from "../simulation/simulate";
import { calculateLeagueAbility } from "../../league/damage";
import { resolveLeagueRules } from "../../league/ruleset";
import { baseInput } from "../../test/fixtures/inputs";
import {
  CONSERVATION_OF_ENERGY_REFUND,
} from "../../shared/conservationOfEnergy";
import type { AbilitySpec } from "../../pipeline/calculateAbility";

const emptyLeague = resolveLeagueRules({ ruleset: "base" });

describe("cast adren ledger (transaction once)", () => {
  it("records Relentless once with actualSpend 0 and refund = effectiveCost", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { relentlessRank: 5 },
    });
    const assault = ctx.byId.get("assault")!;
    expect(ctx.performCast(assault, 0, false, { relentless: true }).ok).toBe(true);
    const cast = ctx.finish().casts.at(-1)!;
    expect(cast.actualSpend).toBe(0);
    expect(cast.refund).toBe(25);
    expect(cast.adrenalineTransaction?.spendPreventedBy).toBe("relentless");
    expect(cast.adrenalineTransaction?.actualSpend).toBe(0);
    expect(cast.adrenalineGained).toBe(0);
    expect(cast.result.adrenalineDelta).toBe(0);
  });

  it("separates CoE and RoV on the transaction and CastRecord", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: {
        conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
        ringOfVigour: true,
      },
    });
    const berserk = ctx.byId.get("berserk")!;
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    const cast = ctx.finish().casts.at(-1)!;
    expect(cast.adrenalineTransaction?.conservationOfEnergyRefund).toBe(10);
    expect(cast.adrenalineTransaction?.ringOfVigourRefund).toBe(10);
    expect(cast.adrenalineGained).toBe(20);
    expect(cast.refund).toBe(0);
    expect(cast.actualSpend).toBe(100);
    expect(cast.result.adrenalineDelta).toBe(-80);
    expect(cast.adrenalineAfterResources).toBe(20);
  });

  it("performCast and calculateLeagueAbility match for non-RNG cases", () => {
    const adren = {
      basicGainMultiplier: 1.2,
      basicAdrenalineFlatBonus: 1,
      abilityGainMultiplier: 1.5,
      ringOfVigour: true,
    };
    const ctx = createCastContext({
      ...baseInput,
      adrenaline: adren,
    });
    const attack = ctx.byId.get("attack")!;
    expect(ctx.performCast(attack, 0, false).ok).toBe(true);
    const cast = ctx.finish().casts[0]!;

    const preview = calculateLeagueAbility(attack, {
      base: baseInput.base,
      level: baseInput.level,
      accuracy: baseInput.accuracy,
      crit: baseInput.crit,
      modifiers: [],
      context: { style: "melee", ruleset: "base" },
      rules: emptyLeague,
      adrenaline: adren,
    });

    // (9 + 1) * 1.2 * 1.5 = 18
    expect(cast.result.adrenalineDelta).toBeCloseTo(18, 10);
    expect(preview.adrenalineDelta).toBeCloseTo(18, 10);
    expect(cast.adrenalineGained).toBeCloseTo(18, 10);
  });

  it("weapon special under Vigour uses effectiveCost in analysis delta", () => {
    const special: AbilitySpec = {
      id: "instability",
      name: "Instability",
      style: "magic",
      category: "enhanced",
      weaponSpecial: true,
      hits: [{ band: { minPct: 100, maxPct: 100 } }],
      adrenaline: { cost: 50 },
    };
    const preview = calculateLeagueAbility(special, {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      modifiers: [],
      context: { style: "magic", ruleset: "base" },
      rules: emptyLeague,
      adrenaline: { ringOfVigour: true },
    });
    // 50 - floor(50*0.1) = 45
    expect(preview.adrenalineDelta).toBe(-45);

    const without = calculateLeagueAbility(special, {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      modifiers: [],
      context: { style: "magic", ruleset: "base" },
      rules: emptyLeague,
      adrenaline: { ringOfVigour: false },
    });
    expect(without.adrenalineDelta).toBe(-50);
  });

  it("explicit CoE + RoV fields refund independently (no legacy sum)", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: {
        conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND,
        ringOfVigour: true,
      },
    });
    const berserk = ctx.byId.get("berserk")!;
    expect(ctx.performCast(berserk, 0, false).ok).toBe(true);
    const cast = ctx.finish().casts.at(-1)!;
    expect(cast.adrenalineTransaction?.conservationOfEnergyRefund).toBe(10);
    expect(cast.adrenalineTransaction?.ringOfVigourRefund).toBe(10);
    expect(cast.result.adrenalineDelta).toBe(-80);
    expect(cast.adrenalineAfterResources).toBe(20);
  });
});
