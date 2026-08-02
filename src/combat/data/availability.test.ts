import { describe, expect, it } from "vitest";
import {
  isObtainableInRegions,
  resolveAvailability,
  resolveRegionMode,
} from "./availability";

describe("data/availability", () => {
  it("level empty regions is global; codex empty is unknown", () => {
    expect(resolveAvailability({ type: "level", regions: [] })).toBe("global");
    expect(resolveAvailability({ type: "codex", regions: [] })).toBe("unknown");
  });

  it("regional forinthry and removed", () => {
    expect(resolveAvailability({ type: "codex", regions: ["forinthry"] })).toBe("regional");
    expect(resolveAvailability({ type: "removed", regions: [] })).toBe("removed");
  });

  it("any vs all region modes", () => {
    expect(resolveRegionMode(undefined)).toBe("any");
    const anyUnlock = { type: "codex" as const, regions: ["a", "b"] as const };
    const allUnlock = { ...anyUnlock, regionMode: "all" as const };
    expect(isObtainableInRegions(anyUnlock, ["a"]).obtainable).toBe(true);
    expect(isObtainableInRegions(allUnlock, ["a"]).obtainable).toBe(false);
    expect(isObtainableInRegions(allUnlock, ["a", "b"]).obtainable).toBe(true);
  });
});
