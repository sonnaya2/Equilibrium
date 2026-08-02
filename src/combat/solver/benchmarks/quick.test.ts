/**
 * Quick solver benchmark — real evaluate, tiny budgets, 4-slot subset.
 * Writes reports/solver-benchmark-quick.json and must finish under ~60s.
 *
 * Gated: only runs when SOLVER_BENCH=1|quick (see scripts/benchmarks/solver.mjs).
 * Keeps default `npm run test:solver` free of multi-second benches.
 */
import { describe, expect, it } from "vitest";
import { formatReportSummary, runBenchmark } from "./runBenchmark";
import { quickCases } from "./cases";

const enabled =
  process.env.SOLVER_BENCH === "1" ||
  process.env.SOLVER_BENCH === "quick" ||
  process.env.SOLVER_BENCH === "json";

describe.skipIf(!enabled)("solver benchmark (quick)", () => {
  it("runs 4-slot cases under budget and writes JSON report", async () => {
    const defs = quickCases();
    expect(defs.length).toBeGreaterThanOrEqual(3);
    expect(defs.every((c) => c.quick)).toBe(true);

    const report = await runBenchmark({ mode: "quick", writeReport: true });
    // eslint-disable-next-line no-console
    console.log(formatReportSummary(report));

    expect(report.schemaVersion).toBe(1);
    expect(report.mode).toBe("quick");
    expect(report.cases.length).toBe(defs.length);
    expect(report.totalDurationMs).toBeLessThan(60_000);

    for (const c of report.cases) {
      expect(c.id).toBeTruthy();
      expect(c.contextFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(c.seed).toBeGreaterThan(0);
      expect(c.bounds.min).toBeLessThanOrEqual(c.bounds.max);
      expect(c.durationMs).toBeGreaterThanOrEqual(0);
      expect(["ok", "degraded", "failed", "error"]).toContain(c.status);
      // Hard fail only on unexpected crashes — degraded/failed still record schema.
      expect(c.status).not.toBe("error");
      expect(c.evaluations).toBeGreaterThan(0);
    }
  }, 60_000);
});
