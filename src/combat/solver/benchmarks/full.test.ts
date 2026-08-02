/**
 * Full solver benchmark — production solveFromRequest on all case IDs.
 * Slow; gated by SOLVER_BENCH=full (scripts/benchmarks/solver.mjs).
 */
import { describe, expect, it } from "vitest";
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
      expect(c.contextFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(["ok", "degraded", "failed", "error"]).toContain(c.status);
      expect(c.status).not.toBe("error");
    }
  }, 600_000);
});
