import { describe, expect, it, beforeEach } from "vitest";
import { clearUiRunCache, getUiRunCache, setUiRunCache } from "./uiRunCache";
import type { RotationSummary } from "@/combat/engine/simulation/simulate";

function fakeSummary(n: number): RotationSummary {
  return {
    ok: true,
    totalExpected: n,
    dps: n,
    ticks: 10,
    horizonTicks: 10,
    casts: [],
    damageByTick: {},
    totalMin: n,
    totalMax: n,
    analysis: { byEffect: [], bySource: [] },
  } as unknown as RotationSummary;
}

describe("uiRunCache", () => {
  beforeEach(() => clearUiRunCache());

  it("returns null on miss and stores hits", () => {
    expect(getUiRunCache("a")).toBeNull();
    setUiRunCache("a", {
      summary: fakeSummary(1),
    });
    expect(getUiRunCache("a")?.summary.totalExpected).toBe(1);
  });

  it("evicts oldest when over capacity", () => {
    for (let i = 0; i < 14; i++) {
      setUiRunCache(`k${i}`, {
        summary: fakeSummary(i),
      });
    }
    expect(getUiRunCache("k0")).toBeNull();
    expect(getUiRunCache("k1")).toBeNull();
    expect(getUiRunCache("k13")?.summary.totalExpected).toBe(13);
  });
});
