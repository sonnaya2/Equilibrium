import { describe, expect, it } from "vitest";
import { createCastContext } from "../engine/simulation/simulate";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { IMPATIENT_EXTRA_ADRENALINE } from "../shared/perks";
import { baseInput } from "../test/fixtures/inputs";
import {
  blessingAdrenalineGenerationMultiplier,
  resolveLeagueRules,
  resolveMaximumAdrenaline,
} from "./ruleset";

/**
 * Adrenaline Junkie multiplies ability generation after Invigorating.
 * Order: listed + FotS + Impatient, then Invig (basic attacks), then AJ.
 * Spend prevention and CoE/RoV refunds are not multiplied.
 */
const junkie = resolveLeagueRules({ ruleset: "equilibrium", blessingPicks: ["Chaos"] });
const attack = MELEE_ABILITIES.find((ability) => ability.id === "attack")!;
const basic = MELEE_ABILITIES.find(
  (ability) => ability.category === "basic" && (ability.adrenaline?.gain ?? 0) > 0,
)!;

const adrenalineAfter = (
  options: {
    league?: typeof junkie;
    impatientRank?: number;
    invigorating?: number;
    impatientProc?: boolean;
  } = {},
) => {
  const context = createCastContext({
    ...baseInput,
    ...(options.league ? { league: options.league } : {}),
    context: { style: "melee", ruleset: options.league ? "equilibrium" : "base" },
    adrenaline: {
      abilityGainMultiplier: options.league
        ? blessingAdrenalineGenerationMultiplier(options.league)
        : 1,
      basicGainMultiplier: options.invigorating ?? 1,
      impatientRank: options.impatientRank ?? 0,
    },
  });
  const result = context.performCast(
    basic,
    0,
    false,
    options.impatientProc === undefined
      ? undefined
      : { impatient: options.impatientProc, "avernic-rampage": false },
  );
  expect(result.ok).toBe(true);
  return context.getState().adrenaline;
};

describe("Adrenaline Junkie generation", () => {
  const listedGain = basic.adrenaline!.gain!;

  it("multiplies the ability's listed generation by 1.5", () => {
    expect(blessingAdrenalineGenerationMultiplier(junkie)).toBe(1.5);
    expect(adrenalineAfter()).toBeCloseTo(listedGain, 10);
    expect(adrenalineAfter({ league: junkie })).toBeCloseTo(listedGain * 1.5, 10);
  });

  it("multiplies Impatient inside AJ (wiki order: (listed+3)*1.5)", () => {
    const withoutBlessing = adrenalineAfter({ impatientRank: 4, impatientProc: true });
    const withBlessing = adrenalineAfter({
      league: junkie,
      impatientRank: 4,
      impatientProc: true,
    });
    const withImp = listedGain + IMPATIENT_EXTRA_ADRENALINE;
    expect(withoutBlessing).toBeCloseTo(withImp, 10);
    expect(withBlessing).toBeCloseTo(withImp * 1.5, 10);
    expect(withBlessing - withoutBlessing).toBeCloseTo(withImp * 0.5, 10);
  });

  it("keeps a non-procced Impatient identical to no Impatient at all", () => {
    expect(adrenalineAfter({ league: junkie, impatientRank: 4, impatientProc: false })).toBeCloseTo(
      adrenalineAfter({ league: junkie }),
      10,
    );
  });

  it("applies Impatient inside Invigorating then AJ", () => {
    const invigorated = adrenalineAfter({ league: junkie, invigorating: 1.2 });
    expect(invigorated).toBeCloseTo(listedGain * 1.2 * 1.5, 10);
    const both = adrenalineAfter({
      league: junkie,
      invigorating: 1.2,
      impatientRank: 4,
      impatientProc: true,
    });
    // (listed + Impatient) * Invig * AJ
    expect(both).toBeCloseTo((listedGain + IMPATIENT_EXTRA_ADRENALINE) * 1.2 * 1.5, 10);
  });

  it("does not multiply a Relentless refund", () => {
    const spender = MELEE_ABILITIES.find((ability) => ability.id === "assault")!;
    expect(spender.adrenaline?.cost).toBeGreaterThan(0);
    const context = createCastContext({
      ...baseInput,
      league: junkie,
      startingAdrenaline: 100,
      context: { style: "melee", ruleset: "equilibrium" },
      adrenaline: { abilityGainMultiplier: 1.5, relentlessRank: 5 },
    });
    expect(
      context.performCast(spender, 0, false, {
        relentless: true,
        "avernic-rampage": false,
      }).ok,
    ).toBe(true);
    // A refunded cast spends nothing; the blessing must not turn that into a gain.
    expect(context.getState().adrenaline).toBe(100 + (spender.adrenaline?.gain ?? 0) * 1.5);
  });

  it("raises the maximum to 150 without letting generation exceed it", () => {
    // The blessing itself raises the cap, so the runtime derives 150 from it.
    const context = createCastContext({
      ...baseInput,
      league: junkie,
      startingAdrenaline: 148,
      context: { style: "melee", ruleset: "equilibrium" },
      adrenaline: { abilityGainMultiplier: 1.5 },
    });
    expect(context.performCast(attack, 0, false, { "avernic-rampage": false }).ok).toBe(true);
    expect(context.getState().adrenaline).toBe(150);
  });
});

describe("source-aware maximum adrenaline", () => {
  it("stacks Adrenaline Junkie, Tier 4, Vestments, and Heightened Senses", () => {
    const tierFour = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Chaos", "Order", "Order", "Order"],
    });
    const tierFourOnly = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Order", "Order", "Order"],
    });

    expect(resolveMaximumAdrenaline(100, tierFourOnly).cap).toBe(125);
    const allSources = resolveMaximumAdrenaline(120, tierFour, 10);
    expect(allSources.cap).toBe(205);
    expect(allSources.sources.map((source) => source.id)).toEqual([
      "vestments-of-havoc",
      "adrenaline-junkie",
      "tier-four-maximum-adrenaline",
      "heightened-senses",
    ]);
  });
});
