import { describe, expect, it } from "vitest";
import {
  isAdrenalineGeneratingBasic,
  resolveAbilityAdrenalineGain,
} from "./adrenalineGain";
import { calculateLeagueAbility } from "../league/damage";
import { resolveLeagueRules } from "../league/ruleset";
import { withArchaeologySelection, normalizeLoadout, DEFAULT_LOADOUT } from "../../components/combat/loadout/model";
import { loadoutStats } from "../../components/combat/loadoutStats";
import { createCastContext } from "../engine/simulation/simulate";
import { baseInput } from "../test/fixtures/inputs";
import { sanitizeSelectedRelics } from "./archaeologyRelics";

const attack = {
  id: "attack",
  category: "basic" as const,
  autoAttack: true,
  adrenaline: { gain: 9 },
};

describe("resolveAbilityAdrenalineGain", () => {
  it("adds FotS before Invigorating mult", () => {
    expect(resolveAbilityAdrenalineGain(attack)).toBe(9);
    expect(
      resolveAbilityAdrenalineGain(attack, { basicAdrenalineFlatBonus: 1 }),
    ).toBe(10);
    expect(
      resolveAbilityAdrenalineGain(attack, {
        basicAdrenalineFlatBonus: 1,
        basicGainMultiplier: 1.2,
      }),
    ).toBeCloseTo(12, 10);
  });

  it("does not apply FotS to thresholds", () => {
    const assault = { category: "threshold" as const, adrenaline: { gain: 9 } };
    expect(isAdrenalineGeneratingBasic(assault)).toBe(false);
    expect(
      resolveAbilityAdrenalineGain(assault, { basicAdrenalineFlatBonus: 1 }),
    ).toBe(9);
  });
});

describe("FotS + Invigorating in UI calc path", () => {
  it("calculateLeagueAbility includes FotS and Invigorating from loadoutStats", () => {
    const loadout = normalizeLoadout({
      ...withArchaeologySelection(DEFAULT_LOADOUT, ["fury_of_the_small"], 500),
      perks: { ...DEFAULT_LOADOUT.perks, invigorating: 4 },
    });
    const stats = loadoutStats(loadout, {
      unlockedRegions: ["misthalin", "kandarin"] as any,
    });
    expect(stats.adrenaline?.basicAdrenalineFlatBonus).toBe(1);
    expect(stats.adrenaline?.basicGainMultiplier).toBeCloseTo(1.2, 10);

    const ability = baseInput.abilities.find((a) => a.id === "attack")!;
    const result = calculateLeagueAbility(ability, {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      rules: resolveLeagueRules({ ruleset: "base" }),
      adrenaline: stats.adrenaline,
    });
    // (9 + 1) * 1.2 = 12
    expect(result.adrenalineDelta).toBeCloseTo(12, 10);
  });

  it("engine performCast matches league delta for FotS alone", () => {
    const loadout = normalizeLoadout(
      withArchaeologySelection(DEFAULT_LOADOUT, ["fury_of_the_small"], 500),
    );
    const stats = loadoutStats(loadout, {
      unlockedRegions: ["misthalin", "kandarin"] as any,
    });
    const ability = baseInput.abilities.find((a) => a.id === "attack")!;
    const ctx = createCastContext({
      ...baseInput,
      adrenaline: stats.adrenaline,
    });
    expect(ctx.performCast(ability, 0, false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(10);

    const league = calculateLeagueAbility(ability, {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      rules: resolveLeagueRules({ ruleset: "base" }),
      adrenaline: stats.adrenaline,
    });
    expect(league.adrenalineDelta).toBe(10);
  });

  it("calculateLeagueAbility includes CoE ultimate refund in adrenalineDelta", () => {
    const loadout = normalizeLoadout(
      withArchaeologySelection(DEFAULT_LOADOUT, ["conservation_of_energy"], 500),
    );
    const stats = loadoutStats(loadout, {
      unlockedRegions: ["misthalin", "kandarin", "morytania", "forinthry"] as any,
    });
    expect(stats.adrenaline?.ultimateAdrenalineRefund).toBe(10);
    const berserk = baseInput.abilities.find((a) => a.id === "berserk")!;
    expect(berserk.category).toBe("ultimate");
    const result = calculateLeagueAbility(berserk, {
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      rules: resolveLeagueRules({ ruleset: "base" }),
      adrenaline: stats.adrenaline,
    });
    // Full dump 100 → leave 0 + CoE 10 => delta -90 (if cost 100)
    const cost = berserk.adrenaline?.cost ?? 100;
    expect(result.adrenalineDelta).toBe(-cost + 10);
  });
});

describe("sanitize trims from the end (selection order)", () => {
  it("pops last when over active limit, including FotS if it is last", () => {
    const kept = sanitizeSelectedRelics({
      selectedIds: [
        "font_of_life",
        "shadows_grace",
        "unexpected_diplomacy",
        "fury_of_the_small",
      ],
      energyCap: 500,
    });
    expect(kept).toEqual([
      "font_of_life",
      "shadows_grace",
      "unexpected_diplomacy",
    ]);
    expect(kept).not.toContain("fury_of_the_small");
  });

  it("keeps FotS when it is within the first three", () => {
    const kept = sanitizeSelectedRelics({
      selectedIds: ["fury_of_the_small", "font_of_life", "shadows_grace"],
      energyCap: 500,
    });
    expect(kept).toContain("fury_of_the_small");
    expect(kept).toHaveLength(3);
  });
});
