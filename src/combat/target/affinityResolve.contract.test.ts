import { describe, expect, it } from "vitest";
import { effectiveTargetAffinity, resolveLeagueRules } from "../league/ruleset";

/** Chaos god tier (two Chaos picks) grants Demon's Mark. */
const mark = resolveLeagueRules({
  ruleset: "equilibrium",
  blessingPicks: ["Chaos", "Chaos", "Balance"],
});
const noMark = resolveLeagueRules({
  ruleset: "equilibrium",
  blessingPicks: ["Order", "Order"],
});

/**
 * Aff_eff contract: stored style Aff is never rewritten here.
 * Mark upgrades only when hasApplicableWeakness and weakness is strictly better.
 * Default weakness Aff is 90 when omitted.
 */
describe("affinityResolve contract (unbake; Mark-only)", () => {
  it("checkbox alone keeps Aff_eff at stored style Aff", () => {
    expect(effectiveTargetAffinity(60, true, noMark)).toBe(60);
    expect(effectiveTargetAffinity(60, true, undefined)).toBe(60);
    expect(effectiveTargetAffinity(50, true, noMark, 90)).toBe(50);
  });

  it("Mark + applicable + stored 60 uses Aff_eff 90", () => {
    expect(effectiveTargetAffinity(60, true, mark)).toBe(90);
    expect(effectiveTargetAffinity(60, true, mark, 90)).toBe(90);
  });

  it("Mark + weakness 55 + stored 60 stays 60 (better-only)", () => {
    expect(effectiveTargetAffinity(60, true, mark, 55)).toBe(60);
  });

  it("Mark never worsens Aff_eff; upgrades only when weakness is higher", () => {
    expect(effectiveTargetAffinity(50, true, mark, 55)).toBe(55);
    expect(effectiveTargetAffinity(70, true, mark, 55)).toBe(70);
    expect(effectiveTargetAffinity(90, true, mark)).toBe(90);
    expect(effectiveTargetAffinity(60, false, mark)).toBe(60);
  });
});
