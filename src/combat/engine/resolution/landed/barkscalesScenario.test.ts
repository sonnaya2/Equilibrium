import { describe, expect, it } from "vitest";
import { simulate } from "../../simulation/simulate";
import { rotationOf } from "../../simulation/contracts";
import { baseInput } from "../../../test/fixtures/inputs";
import { resolveLeagueRules } from "../../../league/ruleset";

const barkscalesLeague = resolveLeagueRules(
  {
    ruleset: "equilibrium",
    blessingPicks: ["Order", "Balance"],
  },
  { totalArmour: 1_000, areaTargets: 1, maximumLife: 10_000 },
);

describe("Barkscales scenario Grasp in rotation results", () => {
  it("schedules Grasp poison into events and byEffect when interval is set", () => {
    // 60s horizon, 6s autos -> 10 hits / 5 = 2 triggers
    const horizonTicks = 100; // 60s
    const result = simulate(
      {
        ...baseInput,
        league: barkscalesLeague,
        context: { style: "melee", ruleset: "equilibrium" },
        rotation: rotationOf("dismember"),
        horizonTicks,
        incomingHitIntervalSeconds: 6,
      },
      { detailLevel: "full-analysis" },
    );

    expect(result.error, result.error).toBeUndefined();
    expect(result.ok).toBe(true);
    const graspEvents = result.events.filter((e) =>
      e.abilityId.startsWith("grasp-of-guthix"),
    );
    expect(graspEvents.length).toBeGreaterThan(0);
    const poison = result.analysis.byEffect.find((row) => row.id === "grasp-of-guthix-poison");
    expect(poison).toBeDefined();
    expect(poison!.totalDamage).toBeGreaterThan(0);
    expect(poison!.sourceBreakdown).toEqual(
      expect.arrayContaining([expect.objectContaining({ blessingId: "barkscales" })]),
    );
    const group = result.analysis.groups?.find((g) => g.id === "grasp-of-guthix");
    expect(group).toBeDefined();
    expect(group!.totalDamage).toBeGreaterThan(0);
  });

  it("does not inject Grasp without an incoming interval", () => {
    const result = simulate(
      {
        ...baseInput,
        league: barkscalesLeague,
        context: { style: "melee", ruleset: "equilibrium" },
        rotation: rotationOf("dismember"),
        horizonTicks: 100,
      },
      { detailLevel: "full-analysis" },
    );
    expect(
      result.events.some((e) => e.abilityId.startsWith("grasp-of-guthix")),
    ).toBe(false);
    expect(
      result.analysis.byEffect.some((row) => row.id.startsWith("grasp-of-guthix")),
    ).toBe(false);
  });

  it("hits poison-immune targets when Envenomed is active and applies Envenomed mult", () => {
    const immuneOnly = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Order", "Balance"] },
      { totalArmour: 1_000, areaTargets: 1, maximumLife: 10_000, herbloreLevel: 99 },
    );
    const withEnvenomed = resolveLeagueRules(
      {
        ruleset: "equilibrium",
        // T2 Balance Barkscales + T6 Balance Envenomed
        blessingPicks: ["Order", "Balance", "Order", "Order", "Order", "Balance"],
      },
      { totalArmour: 1_000, areaTargets: 1, maximumLife: 10_000, herbloreLevel: 99 },
    );
    const shared = {
      ...baseInput,
      context: { style: "melee" as const, ruleset: "equilibrium" as const },
      rotation: rotationOf("dismember"),
      horizonTicks: 100,
      incomingHitIntervalSeconds: 6,
      targetPoisonImmune: true,
    };
    const blocked = simulate(
      { ...shared, league: immuneOnly },
      { detailLevel: "full-analysis" },
    );
    const allowed = simulate(
      { ...shared, league: withEnvenomed },
      { detailLevel: "full-analysis" },
    );
    expect(
      blocked.analysis.byEffect.some((row) => row.id === "grasp-of-guthix-poison"),
    ).toBe(false);
    const poison = allowed.analysis.byEffect.find((row) => row.id === "grasp-of-guthix-poison");
    expect(poison).toBeDefined();
    expect(poison!.totalDamage).toBeGreaterThan(0);
    // Herblore 99 Envenomed mult is 1 + 0.5 + 0.02*99 = 3.48 vs bare Barkscales band EV.
    const bare = simulate(
      {
        ...shared,
        league: immuneOnly,
        targetPoisonImmune: false,
      },
      { detailLevel: "full-analysis" },
    );
    const barePoison = bare.analysis.byEffect.find((row) => row.id === "grasp-of-guthix-poison")!;
    expect(poison!.totalDamage / barePoison.totalDamage).toBeCloseTo(3.48, 1);
  });
});
