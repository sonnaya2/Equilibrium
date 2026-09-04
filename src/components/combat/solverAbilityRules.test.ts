import { describe, expect, it } from "vitest";
import { DEFAULT_SOLVER_PERMITTED_CATEGORIES } from "@/combat/solver";
import {
  filterSolverAbilitiesByCategory,
  pruneSolverAbilityRules,
  setSolverAbilityRule,
  solverAbilityRuleFor,
} from "./solverAbilityRules";

describe("optimizer ability rules", () => {
  it("only offers categories searched by the request", () => {
    const abilities = [
      { id: "rend", category: "basic" },
      { id: "icy_tempest", category: "utility" },
    ];

    expect(
      filterSolverAbilitiesByCategory(abilities, DEFAULT_SOLVER_PERMITTED_CATEGORIES).map(
        (ability) => ability.id,
      ),
    ).toEqual(["rend"]);
  });

  it("keeps lock and disable mutually exclusive", () => {
    const locked = setSolverAbilityRule(
      { lockedAbilityIds: [], disabledAbilityIds: ["slice"] },
      "slice",
      "locked",
    );
    expect(locked).toEqual({ lockedAbilityIds: ["slice"], disabledAbilityIds: [] });

    const disabled = setSolverAbilityRule(locked, "slice", "disabled");
    expect(disabled).toEqual({ lockedAbilityIds: [], disabledAbilityIds: ["slice"] });
    expect(solverAbilityRuleFor(disabled, "slice")).toBe("disabled");

    expect(setSolverAbilityRule(disabled, "slice", "normal")).toEqual({
      lockedAbilityIds: [],
      disabledAbilityIds: [],
    });
  });

  it("prunes rules when the loadout or region pool changes", () => {
    expect(
      pruneSolverAbilityRules(
        {
          lockedAbilityIds: ["slice", "berserk"],
          disabledAbilityIds: ["cleave", "dismember"],
        },
        new Set(["berserk", "dismember"]),
      ),
    ).toEqual({
      lockedAbilityIds: ["berserk"],
      disabledAbilityIds: ["dismember"],
    });
  });

  it("replaces a locked ability with a peer from the same replacement group", () => {
    const abilities = [
      { id: "sunshine", replacementGroup: "sunshine" },
      { id: "greater_sunshine", replacementGroup: "sunshine" },
      { id: "wild_magic" },
    ];
    const next = setSolverAbilityRule(
      { lockedAbilityIds: ["sunshine", "wild_magic"], disabledAbilityIds: [] },
      "greater_sunshine",
      "locked",
      abilities,
    );

    expect(next.lockedAbilityIds).toEqual(["wild_magic", "greater_sunshine"]);
  });
});
