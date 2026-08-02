import { describe, expect, it } from "vitest";
import { createRuntime } from "../runtime/runtime";
import { mergeBranches, snapshotRuntime } from "./branch";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";

/**
 * Lightweight branch-merge throughput check. Not a golden performance gate —
 * reports ms for a fixed synthetic workload so refactors can compare before/after.
 */
describe("branch merge throughput", () => {
  it("merges a large set of future-equivalent historical variants quickly", () => {
    const base = createRuntime({
      base: 1000,
      level: 99,
      accuracy: 1,
      crit: { chance: 0 },
      abilities: MELEE_ABILITIES,
      context: { style: "melee" },
    });

    const N = 2_000;
    const branches = Array.from({ length: N }, (_, i) => {
      const rt = snapshotRuntime(base);
      rt.totalExpected = i * 10;
      rt.perAbility.attack = i * 10;
      return { weight: 1 / N, rt };
    });

    const start = performance.now();
    const merged = mergeBranches(branches);
    const elapsedMs = performance.now() - start;

    expect(merged).toHaveLength(1);
    expect(merged[0]!.weight).toBeCloseTo(1, 10);
    // Sanity bound: 2k JSON keys + merges should stay well under 250ms on CI/dev.
    expect(elapsedMs).toBeLessThan(250);
    // Surface for manual comparison in vitest output.
    console.warn(`[branch-bench] merge ${N} historical variants: ${elapsedMs.toFixed(2)}ms`);
  });
});
