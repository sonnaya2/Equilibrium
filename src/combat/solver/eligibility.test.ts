import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { buildCandidatePool } from "./candidatePool";
import { canAdd, exclusiveKey, validateBarEligibility } from "./eligibility";

function spec(partial: Partial<AbilitySpec> & Pick<AbilitySpec, "id" | "name">): AbilitySpec {
  return {
    style: "melee",
    category: "basic",
    hits: [{ band: { minPct: 100, maxPct: 120 } }],
    adrenaline: { gain: 9 },
    ...partial,
  };
}

const catalogue: AbilitySpec[] = [
  spec({ id: "a", name: "A" }),
  spec({ id: "b", name: "B" }),
  spec({ id: "fury", name: "Fury", replacementGroup: "fury" }),
  spec({ id: "greater_fury", name: "Greater Fury", replacementGroup: "fury" }),
  spec({ id: "utility", name: "Utility", offGcd: true, category: "utility", hits: [] }),
  spec({ id: "auto", name: "Attack", autoAttack: true }),
  spec({
    id: "cleave",
    name: "Cleave",
    weaponRequirement: "twohand",
  }),
  spec({
    id: "partial",
    name: "Partial",
    supportStatus: "partially-modeled",
  }),
  {
    id: "fire",
    name: "Fire",
    style: "magic",
    category: "basic",
    hits: [{ band: { minPct: 100, maxPct: 120 } }],
    adrenaline: { gain: 9 },
  },
];

describe("validateBarEligibility", () => {
  it("rejects mutually exclusive replacement-group members", () => {
    const pool = buildCandidatePool(catalogue, "melee", { includePartial: true });
    const issues = validateBarEligibility(["fury", "greater_fury"], pool);
    expect(issues.some((issue) => issue.code === "replacement-group")).toBe(true);
    expect(issues.find((issue) => issue.code === "replacement-group")?.group).toBe("fury");
  });

  it("rejects off-GCD abilities on the bar", () => {
    const pool = buildCandidatePool(catalogue, "melee", {
      includeOffGcd: true,
      includePartial: true,
    });
    const issues = validateBarEligibility(["utility"], pool);
    expect(issues.some((issue) => issue.code === "off-gcd" && issue.abilityId === "utility")).toBe(
      true,
    );
  });

  it("rejects weapon-requirement mismatches", () => {
    const loose = buildCandidatePool(catalogue, "melee", { includePartial: true });
    const issues = validateBarEligibility(["cleave"], loose, {
      weaponConfiguration: "dualwield",
    });
    expect(
      issues.some((issue) => issue.code === "weapon-requirement" && issue.abilityId === "cleave"),
    ).toBe(true);
  });

  it("rejects unknown ids and duplicates", () => {
    const pool = buildCandidatePool(catalogue, "melee", { includePartial: true });
    const issues = validateBarEligibility(["a", "a", "missing"], pool);
    expect(issues.some((issue) => issue.code === "duplicate-id")).toBe(true);
    expect(
      issues.some((issue) => issue.code === "unknown-id" && issue.abilityId === "missing"),
    ).toBe(true);
  });

  it("rejects auto-attacks and partial support unless includePartial", () => {
    const withAutos = buildCandidatePool(catalogue, "melee", {
      includeAutos: true,
      includePartial: true,
    });
    expect(
      validateBarEligibility(["auto"], withAutos).some((issue) => issue.code === "auto-attack"),
    ).toBe(true);

    const withPartial = buildCandidatePool(catalogue, "melee", { includePartial: true });
    const issues = validateBarEligibility(["partial"], withPartial, { includePartial: false });
    expect(issues.some((issue) => issue.code === "partial-support")).toBe(true);
    expect(validateBarEligibility(["partial"], withPartial, { includePartial: true })).toEqual([]);
  });

  it("enforces size bounds", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    expect(
      validateBarEligibility([], pool, { size: { min: 1, max: 2 } }).some(
        (issue) => issue.code === "size-below-min",
      ),
    ).toBe(true);
    expect(
      validateBarEligibility(["a", "b", "fury"], pool, { size: { minSlots: 1, maxSlots: 2 } }).some(
        (issue) => issue.code === "size-above-max",
      ),
    ).toBe(true);
  });
});

describe("exclusiveKey / canAdd", () => {
  it("blocks a second member of the same replacement group", () => {
    const pool = buildCandidatePool(catalogue, "melee");
    expect(exclusiveKey(pool.byId.get("fury")!)).toBe("fury");
    expect(canAdd(["fury"], "greater_fury", pool.byId)).toBe(false);
    expect(canAdd(["fury"], "a", pool.byId)).toBe(true);
    expect(canAdd(["a"], "a", pool.byId)).toBe(false);
    expect(canAdd(["fury"], "missing", pool.byId)).toBe(false);
  });
});
