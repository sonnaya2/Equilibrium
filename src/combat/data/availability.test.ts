import { describe, expect, it } from "vitest";
import {
  isObtainableInRegions,
  resolveAvailability,
  resolveRegionMode,
} from "./availability";

describe("data/availability", () => {
  it("missing unlock → unknown (obtainable without includeUnknown)", () => {
    expect(resolveAvailability(undefined)).toBe("unknown");
    expect(resolveAvailability(null)).toBe("unknown");
    expect(isObtainableInRegions(undefined, ["misthalin"]).obtainable).toBe(true);
  });

  it("level empty regions is global; codex empty is unknown", () => {
    expect(resolveAvailability({ type: "level", regions: [] })).toBe("global");
    expect(resolveAvailability({ type: "codex", regions: [] })).toBe("unknown");
  });

  it("equipment/drop/activity empty regions are global for region obtainability", () => {
    expect(resolveAvailability({ type: "equipment", regions: [] })).toBe("global");
    expect(resolveAvailability({ type: "drop", regions: [] })).toBe("global");
    expect(resolveAvailability({ type: "activity", regions: [] })).toBe("global");
    expect(resolveAvailability({ type: "ability", regions: [] })).toBe("global");
    expect(
      isObtainableInRegions({ type: "equipment", regions: [] }, ["misthalin"]).obtainable,
    ).toBe(true);
    expect(isObtainableInRegions({ type: "drop", regions: [] }, ["misthalin"]).obtainable).toBe(
      true,
    );
  });

  it("regional forinthry and removed", () => {
    expect(resolveAvailability({ type: "codex", regions: ["forinthry"] })).toBe("regional");
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

  it("resolveRegionMode defaults to any and honours regionMode", () => {
    expect(resolveRegionMode(undefined)).toBe("any");
    expect(resolveRegionMode({ type: "level", regions: ["a", "b"] })).toBe("any");
    expect(resolveRegionMode({ type: "drop", regions: ["a", "b"], regionMode: "all" })).toBe(
      "all",
    );
  });

  it("any vs all region modes", () => {
    const anyUnlock = { type: "codex" as const, regions: ["a", "b"] as const };
    const allUnlock = { ...anyUnlock, regionMode: "all" as const };
    expect(isObtainableInRegions(anyUnlock, ["a"]).obtainable).toBe(true);
    expect(isObtainableInRegions(allUnlock, ["a"]).obtainable).toBe(false);
    expect(isObtainableInRegions(allUnlock, ["a", "b"]).obtainable).toBe(true);
  });

  it("global always obtainable; removed never", () => {
    expect(isObtainableInRegions({ type: "level", regions: [] }, [])).toEqual({
      obtainable: true,
      availability: "global",
    });
    const removed = isObtainableInRegions({ type: "removed", regions: [] }, ["misthalin"]);
    expect(removed.obtainable).toBe(false);
    expect(removed.availability).toBe("removed");
  });

  it("unknown only with includeUnknown", () => {
    const unlock = { type: "codex" as const, regions: [] as const };
    expect(isObtainableInRegions(unlock, ["misthalin"]).obtainable).toBe(false);
    expect(isObtainableInRegions(unlock, ["misthalin"], { includeUnknown: true }).obtainable).toBe(
      true,
    );
  });
});
