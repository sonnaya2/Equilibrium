import { describe, expect, it } from "vitest";
import { hasCritualRecursiveSource, occurrenceModelNote } from "./rotationAnalysisFormat";

describe("rotation analysis presentation", () => {
  it("names Critual as a recursive geometric EV rather than a deterministic Inferno", () => {
    expect(
      occurrenceModelNote(
        {
          abilityId: "inferno-of-zamorak",
          blessingId: "unholy-critual",
          expectedActivations: 1,
          occurrenceModel: {
            kind: "geometric",
            startProbability: 0.5,
            continuationProbability: 0.5,
          },
        },
        "Inferno",
      ),
    ).toBe(
      "Critual recursive chain: 1 expected Inferno per eligible parent (50.0% start; 50.0% continuation)",
    );
  });

  it("identifies the Critual source on the effect ledger", () => {
    expect(
      hasCritualRecursiveSource({
        id: "inferno-of-zamorak",
        sourceBreakdown: [{ blessingId: "unholy-critual" }],
      }),
    ).toBe(true);
    expect(
      hasCritualRecursiveSource({
        id: "inferno-of-zamorak",
        sourceBreakdown: [{ blessingId: "abyssal-cinders" }],
      }),
    ).toBe(false);
  });
});
