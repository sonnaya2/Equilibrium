import { describe, expect, it } from "vitest";
import { createCastContext } from "../engine/simulation/simulate";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { IMPATIENT_EXTRA_ADRENALINE } from "../shared/perks";
import { baseInput } from "../test/fixtures/inputs";
import { blessingAdrenalineGenerationMultiplier, resolveLeagueRules } from "./ruleset";

/**
 * Adrenaline Junkie: "Maximum adrenaline is increased by 50%. Adrenaline
 * generation is increased by 50%." The multiplier is read as applying to listed
 * ability generation only, so flat grants and refunds from unrelated mechanics
 * are added after it.
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

  it("leaves Impatient's flat +3 at 3, not 4.5", () => {
    const withoutBlessing = adrenalineAfter({ impatientRank: 4, impatientProc: true });
    const withBlessing = adrenalineAfter({
      league: junkie,
      impatientRank: 4,
      impatientProc: true,
    });
    expect(withoutBlessing).toBeCloseTo(listedGain + IMPATIENT_EXTRA_ADRENALINE, 10);
    expect(withBlessing).toBeCloseTo(listedGain * 1.5 + IMPATIENT_EXTRA_ADRENALINE, 10);
    // The blessing moved only the listed generation, so the delta is exactly the
    // multiplier acting on it — the flat grant is untouched.
    expect(withBlessing - withoutBlessing).toBeCloseTo(listedGain * 0.5, 10);
  });

  it("keeps a non-procced Impatient identical to no Impatient at all", () => {
    expect(adrenalineAfter({ league: junkie, impatientRank: 4, impatientProc: false })).toBeCloseTo(
      adrenalineAfter({ league: junkie }),
      10,
    );
  });

  it("applies Invigorating inside the multiplied generation", () => {
    // Both scale the listed gain, so the order between them does not change the
    // product; what matters is that neither reaches Impatient's flat grant.
    const invigorated = adrenalineAfter({ league: junkie, invigorating: 1.2 });
    expect(invigorated).toBeCloseTo(listedGain * 1.2 * 1.5, 10);
    const both = adrenalineAfter({
      league: junkie,
      invigorating: 1.2,
      impatientRank: 4,
      impatientProc: true,
    });
    expect(both).toBeCloseTo(listedGain * 1.2 * 1.5 + IMPATIENT_EXTRA_ADRENALINE, 10);
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
