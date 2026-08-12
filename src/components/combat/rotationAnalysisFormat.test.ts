import { describe, expect, it } from "vitest";
import {
  eventTimelineMarks,
  occurrenceModelNote,
  resolvedEventPreview,
} from "./rotationAnalysisFormat";

describe("rotation analysis presentation", () => {
  it("omits Critual Bernoulli Inferno; still labels generic geometric packs", () => {
    expect(
      occurrenceModelNote(
        {
          abilityId: "inferno-of-zamorak",
          blessingId: "unholy-critual",
          expectedActivations: 0.5,
          occurrenceModel: {
            kind: "bernoulli",
            probability: 0.5,
          },
        },
        "Inferno",
      ),
    ).toBeNull();
    expect(
      occurrenceModelNote(
        {
          abilityId: "recursive-proc",
          expectedActivations: 0.05 / 0.95,
          occurrenceModel: {
            kind: "geometric",
            startProbability: 0.05,
            continuationProbability: 0.05,
          },
        },
        "proc",
      ),
    ).toBe(
      "Recursive geometric chain: 0.05 expected proc per eligible parent (5.0% start; 5.0% continuation)",
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
