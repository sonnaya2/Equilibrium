/**
 * Fast Leng microbench (score-only, single bar, ~50 ticks).
 * Gated: SOLVER_BENCH=leng|micro|1 or RS3_LENG_MICRO=1.
 */
import { describe, expect, it } from "vitest";
import {
  formatLengMicroSummary,
  LENG_MICRO_BAR,
  LENG_MICRO_TICKS,
  runLengMicrobench,
} from "./lengMicrobench";

const enabled =
  process.env.RS3_LENG_MICRO === "1" ||
  process.env.SOLVER_BENCH === "1" ||
  process.env.SOLVER_BENCH === "leng" ||
  process.env.SOLVER_BENCH === "micro";

describe.skipIf(!enabled)("leng microbench (score-only single bar)", () => {
  it("runs dual-Leng + peer DW under 10s", () => {
    const report = runLengMicrobench({
      durationTicks: LENG_MICRO_TICKS,
      bar: LENG_MICRO_BAR,
    });
    // eslint-disable-next-line no-console
    console.log(formatLengMicroSummary(report));

    expect(report.schemaVersion).toBe(1);
    expect(report.kind).toBe("leng-microbench");
    expect(report.durationTicks).toBe(50);
    expect(report.arms).toHaveLength(2);
    expect(report.totalWallMs).toBeLessThan(10_000);

    const leng = report.arms.find((a) => a.id === "leng-icy-context")!;
    const peer = report.arms.find((a) => a.id === "four-slot-fixed")!;

    // Sim must run. Dual Leng keeps its compact sparse state through score-only paths.
    expect(leng.simOk).toBe(true);
    expect(peer.simOk).toBe(true);
    expect(peer.rankOk).toBe(true);
    expect(leng.bar).toEqual([...LENG_MICRO_BAR]);
    expect(peer.bar).toEqual([...LENG_MICRO_BAR]);
    expect(leng.wallMs).toBeGreaterThan(0);
    expect(peer.wallMs).toBeGreaterThan(0);
    expect(leng.totalExpected).toBeGreaterThan(0);
    expect(leng.residualWeight ?? 0).toBeLessThanOrEqual(1e-12);
    expect(
      leng.exactness == null || ["exact", "estimated", "approximated"].includes(leng.exactness),
    ).toBe(true);
  }, 15_000);
});
