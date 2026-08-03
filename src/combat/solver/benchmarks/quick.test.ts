/**
 * Quick solver benchmark — real evaluate, tiny budgets, 4-slot subset.
 * Writes reports/solver-benchmark-quick.json and must finish under ~60s.
 *
 * Gated: only runs when SOLVER_BENCH=1|quick (see scripts/benchmarks/solver.mjs).
 * Keeps default `npm run test:solver` free of multi-second benches.
 */
import { describe, expect, it } from "vitest";
import { engineSpecs } from "../../abilities/registry";
import { formatReportSummary, runBenchmark } from "./runBenchmark";
import { quickCases } from "./cases";
import { fingerprintSolveContext } from "../solutionStore";

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
    // Soft wall-clock guard only — avoid brittle per-case thresholds.
    expect(report.totalDurationMs).toBeLessThan(90_000);

    for (const c of report.cases) {
      const def = defs.find((d) => d.id === c.id)!;
      const request = def.build();

      expect(c.id).toBeTruthy();
      expect(c.contextFingerprint).toMatch(/^[a-f0-9]{64}$/);
      expect(c.seed).toBe(request.seed);
      expect(c.bounds.min).toBe(request.minBarSize);
      expect(c.bounds.max).toBe(request.maxBarSize);
      expect(c.bounds.min).toBeLessThanOrEqual(c.bounds.max);
      expect(c.durationMs).toBeGreaterThanOrEqual(0);
      expect(["ok", "degraded", "failed", "error"]).toContain(c.status);
      // Hard fail only on unexpected crashes — degraded/failed still record schema.
      expect(c.status).not.toBe("error");
      expect(c.evaluations).toBeGreaterThan(0);

      if (c.bar?.length) {
        expect(c.bar.length).toBeGreaterThanOrEqual(c.bounds.min);
        expect(c.bar.length).toBeLessThanOrEqual(c.bounds.max);
        for (const id of c.bar) {
          expect(engineSpecs.has(id) || typeof id === "string").toBe(true);
        }
      }

      if (c.status === "ok" && c.winnerScore != null) {
        expect(c.rankable).toBe(true);
        expect(Number.isFinite(c.winnerScore)).toBe(true);
      }
    }

    // Deterministic repeat on first quick case: fingerprint + winner stable.
    const first = defs[0]!;
    const again = await runBenchmark({
      mode: "quick",
      caseIds: [first.id],
      writeReport: false,
    });
    const firstCase = report.cases.find((c) => c.id === first.id)!;
    const secondCase = again.cases[0]!;
    expect(secondCase.contextFingerprint).toBe(firstCase.contextFingerprint);
    expect(secondCase.winnerScore).toBe(firstCase.winnerScore);
    expect(secondCase.bar).toEqual(firstCase.bar);

    // Context change moves fingerprint (melee vs leng equipment).
    const plain = await fingerprintSolveContext(defs.find((d) => d.id === "melee-2h-4slot")!.build());
    const leng = await fingerprintSolveContext(defs.find((d) => d.id === "leng-icy-context")!.build());
    expect(plain).not.toBe(leng);
  }, 90_000);
});
