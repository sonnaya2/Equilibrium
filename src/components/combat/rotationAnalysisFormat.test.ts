import { describe, expect, it } from "vitest";
import { occurrenceModelNote } from "./rotationAnalysisFormat";

describe("rotation analysis presentation", () => {
  it("keeps the legacy Quick geometric note separate from concrete runtime events", () => {
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
});
