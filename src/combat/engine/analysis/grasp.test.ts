import { describe, expect, it } from "vitest";
import { rotationOf } from "../simulation/contracts";
import { simulate } from "../simulation/simulate";
import { baseInput } from "../../test/fixtures/inputs";
import { analysisReconciles } from "./finalize";
import { blessingRule, resolveLeagueRules } from "../../league/ruleset";

const graspLeague = resolveLeagueRules(
  {
    ruleset: "equilibrium",
    blessingPicks: ["Balance", "Balance", "Balance", "Balance", "Balance"],
  },
  { maximumLife: 10_000, areaTargets: 3 },
);

const graspInput = {
  ...baseInput,
  league: graspLeague,
  context: { style: "melee" as const, ruleset: "equilibrium" as const },
  rotation: rotationOf("dismember"),
};

function row(result: ReturnType<typeof simulate>, id: string) {
  return result.analysis.byEffect.find((effect) => effect.id === id);
}

describe("Grasp of Guthix analysis grouping", () => {
  it("rolls real child damage into a non-additive grouped presentation", () => {
    const result = simulate(graspInput, { detailLevel: "full-analysis" });
    const maxLife = row(result, "grasp-of-guthix-max-life");
    const poison = row(result, "grasp-of-guthix-poison");
    const group = result.analysis.groups?.find((entry) => entry.id === "grasp-of-guthix");

    expect(result.ok).toBe(true);
    expect(maxLife).toBeDefined();
    expect(poison).toBeDefined();
    expect(group).toBeDefined();
    expect(row(result, "grasp-of-guthix")).toBeUndefined();
    expect(result.events.filter((event) => event.abilityId === "grasp-of-guthix")).toHaveLength(0);
    expect(
      result.events
        .filter((event) => event.abilityId.startsWith("grasp-of-guthix-"))
        .every((event) => event.damageTag === undefined && event.bonusTargetId === undefined),
    ).toBe(true);
    expect(group!.totalDamage).toBeCloseTo(
      maxLife!.totalDamage + poison!.totalDamage + maxLife!.bonusDamage + poison!.bonusDamage,
      6,
    );
    expect(group!.totalDamage).toBeCloseTo(
      group!.components.reduce((sum, component) => sum + component.totalDamage, 0),
      6,
    );
    expect(group!.expectedActivations).toBe(3);
    expect(maxLife!.expectedActivations).toBe(9);
    expect(poison!.expectedActivations).toBe(9);
    expect(group!.components.map((component) => component.id)).toEqual([
      "grasp-of-guthix-max-life",
      "grasp-of-guthix-poison",
      "grasp-of-guthix-big-boned",
    ]);
    expect(
      group!.components.find((component) => component.id === "grasp-of-guthix-big-boned"),
    ).toMatchObject({
      totalDamage: maxLife!.bonusDamage + poison!.bonusDamage,
      expectedSeparateHits: 0,
    });
  });

  it("keeps source, direct, poison-immunity, and fifth-hit attribution coherent", () => {
    const result = simulate(graspInput, { detailLevel: "full-analysis" });
    const immune = simulate(
      { ...graspInput, targetPoisonImmune: true },
      { detailLevel: "full-analysis" },
    );
    const maxLife = row(result, "grasp-of-guthix-max-life")!;
    const poison = row(result, "grasp-of-guthix-poison")!;
    const immuneMaxLife = row(immune, "grasp-of-guthix-max-life")!;
    const group = result.analysis.groups?.find((entry) => entry.id === "grasp-of-guthix");
    const immuneGroup = immune.analysis.groups?.find((entry) => entry.id === "grasp-of-guthix");
    if (!group || !immuneGroup) throw new Error("Grasp group was not produced");

    expect(maxLife.sourceBreakdown).toEqual(
      expect.arrayContaining([expect.objectContaining({ blessingId: "tearing-thorns" })]),
    );
    expect(poison.sourceBreakdown).toEqual(
      expect.arrayContaining([expect.objectContaining({ blessingId: "tearing-thorns" })]),
    );
    expect(group.sourceBreakdown).toEqual(
      expect.arrayContaining([expect.objectContaining({ blessingId: "tearing-thorns" })]),
    );
    expect(group.share).toBeCloseTo(group.totalDamage / result.totalExpected, 6);
    expect(group.sourceBreakdown!.reduce((sum, source) => sum + source.totalDamage, 0)).toBeCloseTo(
      group.totalDamage,
      6,
    );
    expect(result.analysis.bySource).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "league-blessing" })]),
    );
    expect(result.analysis.bySource).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "player-poison" })]),
    );
    expect(result.analysis.directDamage + result.analysis.dotDamage).toBeCloseTo(
      result.totalExpected,
      6,
    );
    expect(group.directDamage + group.dotDamage).toBeCloseTo(group.totalDamage, 6);
    expect(immune.analysis.byEffect.some((effect) => effect.id === "grasp-of-guthix-poison")).toBe(
      false,
    );
    expect(immuneMaxLife.totalDamage + immuneMaxLife.bonusDamage).toBeCloseTo(
      maxLife.totalDamage + maxLife.bonusDamage,
      6,
    );
    expect(result.totalExpected - immune.totalExpected).toBeCloseTo(
      poison.totalDamage + poison.bonusDamage,
      6,
    );
    expect(immuneGroup.totalDamage).toBeCloseTo(
      immuneMaxLife.totalDamage + immuneMaxLife.bonusDamage,
      6,
    );

    const perfidiousLeague = resolveLeagueRules(
      {
        ruleset: "equilibrium",
        blessingPicks: ["Balance", "Balance", "Balance", "Balance", "Balance", "Chaos"],
      },
      { maximumLife: 10_000, areaTargets: 3 },
    );
    expect(blessingRule(perfidiousLeague, "tearing-thorns")?.tearingThorns?.hitsPerGrasp).toBe(
      blessingRule(graspLeague, "tearing-thorns")?.tearingThorns?.hitsPerGrasp,
    );
    const perfidious = simulate(
      { ...graspInput, league: perfidiousLeague },
      { detailLevel: "full-analysis" },
    );
    expect(perfidious.events.filter((event) => event.abilityId === "dismember").length).toBe(
      result.events.filter((event) => event.abilityId === "dismember").length,
    );
    expect(
      perfidious.events.filter((event) => event.abilityId === "grasp-of-guthix-max-life").length,
    ).toBe(result.events.filter((event) => event.abilityId === "grasp-of-guthix-max-life").length);
  });

  it("does not double-count the roll-up and keeps score-only totals identical", () => {
    const full = simulate(graspInput, { detailLevel: "full-analysis" });
    const scoreOnly = simulate(graspInput, { detailLevel: "score-only" });
    const byEffectTotal = full.analysis.byEffect.reduce(
      (sum, effect) => sum + effect.totalDamage,
      0,
    );

    expect(analysisReconciles(full.analysis, full.totalExpected)).toBe(true);
    expect(byEffectTotal).toBeCloseTo(full.totalExpected, 6);
    expect(full.totalExpected).toBe(scoreOnly.totalExpected);
    expect(full.damageByTick).toEqual(scoreOnly.damageByTick);
    expect(scoreOnly.analysis.byEffect).toEqual([]);
    expect(scoreOnly.analysis.groups ?? []).toEqual([]);
  });
});
