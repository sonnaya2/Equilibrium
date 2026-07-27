import { describe, expect, it } from "vitest";
import { regionRank, sortByRegionOrder } from "./regionOrder";

const ORDER = ["misthalin", "karamja", "desert"] as const;

describe("regionRank", () => {
  it("returns declared index for known ids", () => {
    expect(regionRank("misthalin", ORDER)).toBe(0);
    expect(regionRank("desert", ORDER)).toBe(2);
  });

  it("ranks unknown ids after all known ids", () => {
    expect(regionRank("future_region", ORDER)).toBe(ORDER.length);
    expect(regionRank("zzz", ORDER)).toBeGreaterThan(regionRank("desert", ORDER));
  });
});

describe("sortByRegionOrder", () => {
  it("orders known regions by the declared list", () => {
    const sorted = sortByRegionOrder(
      [{ id: "desert" }, { id: "misthalin" }, { id: "karamja" }],
      ORDER,
    );
    expect(sorted.map((r) => r.id)).toEqual(["misthalin", "karamja", "desert"]);
  });

  it("places unknown regions after known ones and keeps relative order", () => {
    const sorted = sortByRegionOrder(
      [{ id: "beta" }, { id: "desert" }, { id: "alpha" }, { id: "misthalin" }, { id: "gamma" }],
      ORDER,
    );
    expect(sorted.map((r) => r.id)).toEqual(["misthalin", "desert", "beta", "alpha", "gamma"]);
  });

  it("does not promote unknowns ahead of known ids (indexOf -1 bug)", () => {
    // indexOf("unknown") === -1 used to sort before index 0.
    const sorted = sortByRegionOrder([{ id: "unknown_future" }, { id: "misthalin" }], ORDER);
    expect(sorted[0]?.id).toBe("misthalin");
    expect(sorted[1]?.id).toBe("unknown_future");
  });
});
