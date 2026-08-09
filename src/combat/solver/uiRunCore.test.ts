import { describe, expect, it } from "vitest";
import { baseInput } from "../test/fixtures/inputs";
import { vulnerabilityModifier } from "../shared/vulnerability";
import { simulateRevolutionForUi } from "./uiRunCore";
import { toSerializableUiRunSummary } from "./worker/uiRunTypes";

describe("uiRunCore", () => {
  it("uses one lane when the loadout has no future-changing RNG", () => {
    const attack = baseInput.abilities.find((ability) => ability.id === "attack")!;
    const input = { ...baseInput, bar: [attack], style: "melee" as const, durationTicks: 30 };
    const first = simulateRevolutionForUi(input);
    const second = simulateRevolutionForUi(input);

    expect(first.meta.lanes).toBe(1);
    expect(first.summary.rng).toBeUndefined();
    expect(first.summary.totalExpected).toBe(second.summary.totalExpected);
  });

  it("uses the fixed 128-lane ensemble for future-changing RNG", () => {
    const attack = baseInput.abilities.find((ability) => ability.id === "attack")!;
    const result = simulateRevolutionForUi({
      ...baseInput,
      bar: [attack],
      style: "melee",
      durationTicks: 30,
      adrenaline: { impatientRank: 4 },
    });

    expect(result.meta.lanes).toBe(128);
    expect(result.summary.rng?.residualWeight).toBe(0);
  });

  it("removes modifier closures before worker postMessage", () => {
    const fury = baseInput.abilities.find((ability) => ability.id === "fury")!;
    const { summary } = simulateRevolutionForUi({
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
