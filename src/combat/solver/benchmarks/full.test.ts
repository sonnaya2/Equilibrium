/**
 * Full solver benchmark - production solveFromRequest on all case IDs.
 * Slow; gated by SOLVER_BENCH=full (scripts/benchmarks/solver.mjs).
 */
import { describe, expect, it } from "vitest";
import { engineSpecs } from "../../abilities/registry";
import { allCases } from "./cases";
import { formatReportSummary, runBenchmark } from "./runBenchmark";

const enabled = process.env.SOLVER_BENCH === "full";

describe.skipIf(!enabled)("solver benchmark (full)", () => {
  it("runs all cases via solveFromRequest and writes JSON report", async () => {
    const defs = allCases();
    expect(defs.length).toBeGreaterThanOrEqual(11);

    const report = await runBenchmark({ mode: "full", writeReport: true });
    // eslint-disable-next-line no-console
    console.log(formatReportSummary(report));

    expect(report.schemaVersion).toBe(1);
    expect(report.mode).toBe("full");
    expect(report.cases.length).toBe(defs.length);

    for (const c of report.cases) {
      const def = defs.find((d) => d.id === c.id)!;
      const request = def.build();
      expect(c.contextFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(c.seed).toBe(request.seed);
      expect(c.bounds).toEqual({ min: request.minBarSize, max: request.maxBarSize });
      expect(["ok", "degraded", "failed", "error"]).toContain(c.status);
      if (def.expectedFullError) {
        expect(c.status).toBe("error");
        expect(c.error).toContain(def.expectedFullError);
        continue;
      }
      expect(c.status).not.toBe("error");
      if (c.bar?.length) {
        expect(c.bar.length).toBeGreaterThanOrEqual(c.bounds.min);
        expect(c.bar.length).toBeLessThanOrEqual(c.bounds.max);
        for (const id of c.bar) {
          expect(engineSpecs.has(id) || typeof id === "string").toBe(true);
        }
      }
      if (c.status === "ok") {
        expect(c.rankable).toBe(true);
        expect(c.winnerScore).not.toBeNull();
      }
    }
  }, 600_000);
});
