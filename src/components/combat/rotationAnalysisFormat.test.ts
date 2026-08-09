import { describe, expect, it } from "vitest";
import {
  eventTimelineMarks,
  occurrenceModelNote,
  resolvedEventPreview,
} from "./rotationAnalysisFormat";

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

  it("returns every resolved event without a truncated preview", () => {
    const events = Array.from({ length: 20 }, (_, index) => ({
      abilityId: index === 15 ? "perfect_equilibrium" : `ability_${index}`,
    }));

    const preview = resolvedEventPreview(events);

    expect(preview.events).toHaveLength(20);
    expect(preview.events[15]?.abilityId).toBe("perfect_equilibrium");
    expect(preview.pinnedPerfectEquilibrium).toBe(false);
  });

  it("marks land-tick and source-cast group starts for timeline chrome", () => {
    const marks = eventTimelineMarks([
      { tick: 0, sourceCast: 0 },
      { tick: 0, sourceCast: 0 },
      { tick: 0, sourceCast: 1 },
      { tick: 3, sourceCast: 1 },
      { tick: 3, sourceCast: 2 },
    ]);
    expect(marks).toEqual([
      { isTickStart: true, isCastStart: true },
      { isTickStart: false, isCastStart: false },
      { isTickStart: false, isCastStart: true },
      { isTickStart: true, isCastStart: true },
      { isTickStart: false, isCastStart: true },
    ]);
  });
});
