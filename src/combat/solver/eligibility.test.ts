import { describe, expect, it } from "vitest";
import type { AbilitySpec } from "../pipeline/calculateAbility";
import { buildCandidatePool } from "./candidatePool";
import { canAdd, createEligibilityMemo, exclusiveKey, validateBarEligibility } from "./eligibility";

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

  it("drops two-hand-only abilities from dual-wield and main-hand pools", () => {
    const dual = buildCandidatePool(catalogue, "melee", {
      includePartial: true,
      weaponConfiguration: "dualwield",
    });
    const main = buildCandidatePool(catalogue, "melee", {
      includePartial: true,
      weaponConfiguration: "mainhand",
    });
    const twohand = buildCandidatePool(catalogue, "melee", {
      includePartial: true,
      weaponConfiguration: "twohand",
    });
    expect(dual.byId.has("cleave")).toBe(false);
    expect(main.byId.has("cleave")).toBe(false);
    expect(twohand.byId.has("cleave")).toBe(true);
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

describe("manual-only weapon specials", () => {
  it("keeps FSoA Instability and Guthix Claws out of the Revo++ candidate pool", async () => {
    const { allEngineSpecs } = await import("../abilities/registry");
    const pool = buildCandidatePool(allEngineSpecs(), "magic");
    expect(pool.ids).not.toContain("instability");
    expect(pool.ids).not.toContain("claws_of_guthix");
  });
});

describe("igneous passive pool filtering", () => {
  it("excludes locked upgrades and supersedes the base when the passive is active", async () => {
    const { allEngineSpecs } = await import("../abilities/registry");
    const specs = allEngineSpecs();
    const without = buildCandidatePool(specs, "melee");
    expect(without.ids).toContain("overpower");
    expect(without.ids).not.toContain("overpower_igneous");

    const withCape = buildCandidatePool(specs, "melee", {
      equipmentIds: ["item:igneous-kal-ket"],
      passiveIds: ["igneous-overpower"],
    });
    expect(withCape.ids).toContain("overpower_igneous");
    expect(withCape.ids).not.toContain("overpower");

    const necroBase = buildCandidatePool(specs, "necromancy");
    expect(necroBase.ids).toContain("death_skulls");
    expect(necroBase.ids).not.toContain("death_skulls_igneous");

    const withMor = buildCandidatePool(specs, "necromancy", {
      equipmentIds: ["item:igneous-kal-mor"],
      passiveIds: ["igneous-death-skulls"],
    });
    expect(withMor.ids).toContain("death_skulls_igneous");
    expect(withMor.ids).not.toContain("death_skulls");

    const withZuk = buildCandidatePool(specs, "necromancy", {
      equipmentIds: ["item:igneous-kal-zuk"],
      passiveIds: [
        "igneous-overpower",
        "igneous-deadshot",
        "igneous-omnipower",
        "igneous-death-skulls",
      ],
    });
    expect(withZuk.ids).toContain("death_skulls_igneous");
    expect(withZuk.ids).not.toContain("death_skulls");
  });

  it("includes death_skulls_igneous with Kal-Mor without includePartial on the bar", async () => {
    const { allEngineSpecs } = await import("../abilities/registry");
    const withMor = buildCandidatePool(allEngineSpecs(), "necromancy", {
      equipmentIds: ["item:igneous-kal-mor"],
      passiveIds: ["igneous-death-skulls"],
    });
    expect(withMor.ids).toContain("death_skulls_igneous");
    expect(
      validateBarEligibility(["death_skulls_igneous"], withMor, { includePartial: false }),
    ).toEqual([]);
  });

  it("includes conjure summons for necromancy style without includePartial", async () => {
    const { allEngineSpecs } = await import("../abilities/registry");
    const pool = buildCandidatePool(allEngineSpecs(), "necromancy", {
      weaponConfiguration: "necromancy",
    });
    expect(pool.ids).toContain("conjure_skeleton_warrior");
    expect(pool.ids).toContain("conjure_undead_army");
    expect(pool.ids).toContain("command_skeleton_warrior");
    expect(
      validateBarEligibility(["conjure_skeleton_warrior", "conjure_undead_army"], pool, {
        includePartial: false,
      }),
    ).toEqual([]);
  });
});

describe("eligibility session memo", () => {
  it("returns identical outcomes with and without memo", () => {
    const pool = buildCandidatePool(catalogue, "melee", { includePartial: true });
    const bars: readonly (readonly string[])[] = [
      ["a", "b"],
      ["fury", "greater_fury"],
      ["partial"],
      ["a", "a"],
      ["missing"],
      ["cleave"],
    ];
    const baseOpts = { includePartial: false as const, size: { min: 1, max: 10 } };
    const memo = createEligibilityMemo(pool, baseOpts);

    for (const bar of bars) {
      const direct = validateBarEligibility(bar, pool, baseOpts);
      const memoized = validateBarEligibility(bar, pool, { ...baseOpts, memo });
      expect(memoized).toEqual(direct);
      // Second call must match (cache hit path).
      expect(validateBarEligibility(bar, pool, { ...baseOpts, memo })).toEqual(direct);
    }
    expect(memo.cache.hits).toBe(bars.length);
    expect(memo.cache.misses).toBe(bars.length);
  });

  it("does not reuse results when includePartial differs", () => {
    const pool = buildCandidatePool(catalogue, "melee", { includePartial: true });
    const memo = createEligibilityMemo(pool, { includePartial: false });
    const withPartialOff = validateBarEligibility(["partial"], pool, {
      includePartial: false,
      memo,
    });
    expect(withPartialOff.some((i) => i.code === "partial-support")).toBe(true);

    // Same memo, different options: must skip cache (optionKey mismatch).
    const withPartialOn = validateBarEligibility(["partial"], pool, {
      includePartial: true,
      memo,
    });
    expect(withPartialOn).toEqual([]);
    // Only the first call (matching optionKey) is cached.
    expect(memo.cache.size).toBe(1);
  });

  it("skips memo when pool identity differs", () => {
    const poolA = buildCandidatePool(catalogue, "melee", { includePartial: true });
    const poolB = buildCandidatePool(catalogue, "melee", { includePartial: true });
    const memo = createEligibilityMemo(poolA, { includePartial: true });
    validateBarEligibility(["a", "b"], poolA, { includePartial: true, memo });
    expect(memo.cache.size).toBe(1);
    expect(memo.cache.hits).toBe(0);

    // Different pool object: uncached path, no poison of poolA cache.
    const issues = validateBarEligibility(["a", "b"], poolB, { includePartial: true, memo });
    expect(issues).toEqual([]);
    expect(memo.cache.size).toBe(1);
    expect(memo.cache.hits).toBe(0);
  });

  it("weapon option is part of the memo binding", () => {
    const pool = buildCandidatePool(catalogue, "melee", { includePartial: true });
    const memo = createEligibilityMemo(pool, { weaponConfiguration: "dualwield" });
    const dual = validateBarEligibility(["cleave"], pool, {
      weaponConfiguration: "dualwield",
      memo,
    });
    expect(dual.some((i) => i.code === "weapon-requirement")).toBe(true);
    const twohand = validateBarEligibility(["cleave"], pool, {
      weaponConfiguration: "twohand",
      memo,
    });
    // twohand uses mismatched optionKey so runs fresh; must not return dual result.
    expect(twohand.some((i) => i.code === "weapon-requirement")).toBe(false);
  });
});
