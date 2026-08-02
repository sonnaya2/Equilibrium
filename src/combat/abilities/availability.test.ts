import { describe, expect, it } from "vitest";
import { isObtainableInRegions, resolveAvailability, resolveRegionMode } from "./availability";

describe("resolveAvailability", () => {
  it("missing unlock → unknown", () => {
    expect(resolveAvailability(undefined)).toBe("unknown");
    expect(resolveAvailability(null)).toBe("unknown");
  });

  it("type level with empty regions → global", () => {
    expect(resolveAvailability({ type: "level", regions: [], requirement: "1" })).toBe("global");
  });

  it("type codex with empty regions → unknown", () => {
    expect(resolveAvailability({ type: "codex", regions: [], requirement: "Some codex" })).toBe(
      "unknown",
    );
  });

  it("regions with forinthry → regional", () => {
    expect(
      resolveAvailability({
        type: "codex",
        regions: ["forinthry"],
        requirement: "Verak Lith",
      }),
    ).toBe("regional");
  });

  it("type removed → removed", () => {
    expect(resolveAvailability({ type: "removed", regions: [] })).toBe("removed");
  });

  it("explicit availability overrides inference", () => {
    expect(
      resolveAvailability({
        type: "codex",
        regions: [],
        availability: "global",
      }),
    ).toBe("global");
    expect(
      resolveAvailability({
        type: "level",
        regions: ["desert"],
        availability: "unknown",
      }),
    ).toBe("unknown");
  });
});

describe("resolveRegionMode", () => {
  it("defaults to any", () => {
    expect(resolveRegionMode({ type: "level", regions: ["a", "b"] })).toBe("any");
  });

  it("honours regionMode", () => {
    expect(resolveRegionMode({ type: "drop", regions: ["a", "b"], regionMode: "all" })).toBe("all");
  });
});

describe("isObtainableInRegions", () => {
  it("global always obtainable", () => {
    const r = isObtainableInRegions({ type: "level", regions: [] }, []);
    expect(r).toEqual({ obtainable: true, availability: "global" });
  });

  it("removed never obtainable", () => {
    const r = isObtainableInRegions({ type: "removed", regions: [] }, ["misthalin"]);
    expect(r.obtainable).toBe(false);
    expect(r.availability).toBe("removed");
  });

  it("unknown only with includeUnknown", () => {
    const unlock = { type: "codex" as const, regions: [] as const };
    expect(isObtainableInRegions(unlock, ["misthalin"]).obtainable).toBe(false);
    expect(isObtainableInRegions(unlock, ["misthalin"], { includeUnknown: true }).obtainable).toBe(
      true,
    );
  });

  it("regional mode any: some region unlocked", () => {
    const unlock = {
      type: "codex" as const,
      regions: ["forinthry", "desert"] as const,
      regionMode: "any" as const,
    };
    expect(isObtainableInRegions(unlock, ["forinthry"]).obtainable).toBe(true);
    expect(isObtainableInRegions(unlock, ["misthalin"]).obtainable).toBe(false);
  });

  it("regional mode all: every listed region unlocked", () => {
    const unlock = {
      type: "drop" as const,
      regions: ["forinthry", "desert"] as const,
      regionMode: "all" as const,
    };
    expect(isObtainableInRegions(unlock, ["forinthry"]).obtainable).toBe(false);
    expect(isObtainableInRegions(unlock, ["forinthry", "desert"]).obtainable).toBe(true);
  });
});
