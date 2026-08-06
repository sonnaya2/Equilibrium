import { describe, expect, it } from "vitest";
import {
  chunkUiRunCaps,
  isResidualFreeProbe,
  pickBestUiRunProbe,
  preferredUiRunWorkerCount,
  type UiRunProbeResult,
} from "./uiRunCore";
import { RESIDUAL_FREE_TOLERANCE } from "./branchFidelity";
import { simulateRevolution } from "../engine/simulation/revolution";
import { baseInput } from "../test/fixtures/inputs";
import { vulnerabilityModifier } from "../shared/vulnerability";
import { toSerializableUiRunSummary } from "./worker/uiRunTypes";

describe("uiRunCore", () => {
  it("pickBest prefers residual-free at lowest live (cheap full-analysis)", () => {
    const probes: UiRunProbeResult[] = [
      { maxLiveBranches: 256, residualWeight: 0, ok: true, totalExpected: 1 },
      { maxLiveBranches: 128, residualWeight: 0, ok: true, totalExpected: 1 },
      { maxLiveBranches: 512, residualWeight: 0.1, ok: true, totalExpected: 1 },
    ];
    const best = pickBestUiRunProbe(probes)!;
    expect(best.maxLiveBranches).toBe(128);
    expect(best.residualWeight).toBe(0);
  });

  it("pickBest among residual picks lowest residual then higher live", () => {
    const probes: UiRunProbeResult[] = [
      { maxLiveBranches: 256, residualWeight: 0.3, ok: true, totalExpected: 1 },
      { maxLiveBranches: 1024, residualWeight: 0.2, ok: true, totalExpected: 1 },
      {
        maxLiveBranches: 512,
        residualWeight: 0.2 + RESIDUAL_FREE_TOLERANCE / 2,
        ok: true,
        totalExpected: 1,
      },
    ];
    const best = pickBestUiRunProbe(probes)!;
    expect(best.residualWeight).toBeCloseTo(0.2, 9);
    expect(best.maxLiveBranches).toBe(1024);
  });

  it("probes the cheapest cap alone before parallel fallback waves", () => {
    expect(chunkUiRunCaps([128, 256, 512, 1024, 2048], 3)).toEqual([
      [128],
      [256, 512, 1024],
      [2048],
    ]);
    expect(chunkUiRunCaps([], 3)).toEqual([]);
  });

  it("wave early-exit policy: residual-free stops further waves; residual continues", () => {
    const waves = chunkUiRunCaps([128, 256, 512, 1024], 2);
    // Wave 1 all residual -> must continue.
    const wave1: UiRunProbeResult[] = [
      { maxLiveBranches: 128, residualWeight: 0.4, ok: true, totalExpected: 1 },
    ];
    expect(wave1.some(isResidualFreeProbe)).toBe(false);
    expect(waves.length).toBeGreaterThan(1);

    // Wave with residual-free allows stop.
    const waveFree: UiRunProbeResult[] = [
      { maxLiveBranches: 128, residualWeight: 0, ok: true, totalExpected: 1 },
    ];
    expect(waveFree.some(isResidualFreeProbe)).toBe(true);
    expect(
      isResidualFreeProbe({
        maxLiveBranches: 64,
        residualWeight: 1e-13,
        ok: true,
        totalExpected: 1,
      }),
    ).toBe(true);
    expect(
      isResidualFreeProbe({
        maxLiveBranches: 64,
        residualWeight: 0.01,
        ok: true,
        totalExpected: 1,
      }),
    ).toBe(false);
  });

  it("preferredUiRunWorkerCount is 2-4", () => {
    expect(preferredUiRunWorkerCount(2)).toBe(2);
    expect(preferredUiRunWorkerCount(4)).toBe(3);
    expect(preferredUiRunWorkerCount(8)).toBe(4);
    expect(preferredUiRunWorkerCount(16)).toBe(4);
  });

  it("removes modifier closures from full Run summaries before worker postMessage", () => {
    const fury = baseInput.abilities.find((ability) => ability.id === "fury")!;
    const summary = simulateRevolution({
      ...baseInput,
      bar: [fury],
      style: "melee",
      durationTicks: 6,
      modifiers: [vulnerabilityModifier()],
    });

    expect(() => structuredClone(summary)).toThrow();
    const wireSummary = toSerializableUiRunSummary(summary);
    expect(wireSummary.events.some((event) => "castSnap" in event)).toBe(false);
    expect(() => structuredClone(wireSummary)).not.toThrow();
    expect(wireSummary.totalExpected).toBe(summary.totalExpected);
  });
});
