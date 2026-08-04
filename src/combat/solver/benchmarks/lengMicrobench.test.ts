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
  it("runs dual-Leng + peer DW under 10s with zero Leng snapshots", () => {
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

    // Sim must run. Score-only dual Leng is residual-free EV approx (not full-tree).
    expect(leng.simOk).toBe(true);
    expect(peer.simOk).toBe(true);
    expect(peer.rankOk).toBe(true);
    expect(leng.bar).toEqual([...LENG_MICRO_BAR]);
    expect(peer.bar).toEqual([...LENG_MICRO_BAR]);
    expect(leng.wallMs).toBeGreaterThan(0);
    expect(peer.wallMs).toBeGreaterThan(0);
    expect(leng.totalExpected).toBeGreaterThan(0);
    // Residual free compact mass spine (exact / merged-exactly).
    expect(leng.residualWeight ?? 0).toBeLessThanOrEqual(1e-12);
    expect(
      leng.exactness == null ||
        ["exact", "merged-exactly", "approximated", "bounded-approximation"].includes(
          leng.exactness,
        ),
    ).toBe(true);
    // Prefer disclosed non-exact; if summary omits rng, snaps/maxLive still gate the win.

    if (report.branchProf) {
      expect(leng.branchProfile).toBeDefined();
      // Score-only Leng mass path: no multi-arm snapshotRuntime.
      expect(leng.branchProfile?.branchSnapshots ?? -1).toBe(0);
      expect(leng.branchProfile?.maxLiveBranches ?? 99).toBeLessThanOrEqual(1);
      expect((peer.branchProfile?.branchSnapshots ?? 0) === 0).toBe(true);
    }
  }, 15_000);
});
