import { describe, expect, it } from "vitest";
import { asTaskRecords } from "@/tasks";
import { fullRegionCounts, regionsInTaskData } from "./useTasksDesk";

const RECORDS = asTaskRecords([
  { name: "A", tier: "easy", regionId: "global" },
  { name: "B", tier: "easy", regionId: "misthalin" },
  { name: "C", tier: "easy", regionId: "karamja" },
  { name: "D", tier: "easy", regionId: "anachronia" },
  { name: "E", tier: "easy", regionId: "anachronia" },
  { name: "F", tier: "easy", regionId: "tirannwn" },
  { name: "G", tier: "easy", regionId: "misthalin" },
]);

describe("regionsInTaskData", () => {
  it("returns every region present, global first then league order", () => {
    const rail = regionsInTaskData(RECORDS);
    expect(rail[0]).toBe("global");
    expect(rail).toContain("misthalin");
    expect(rail).toContain("karamja");
    expect(rail).toContain("anachronia");
    expect(rail).toContain("tirannwn");
    // Full data rail — electives are not filtered out here
    expect(rail).toEqual(
      expect.arrayContaining(["global", "misthalin", "karamja", "anachronia", "tirannwn"]),
    );
    expect(rail).toHaveLength(5);
  });

  it("omits regions with no tasks", () => {
    expect(regionsInTaskData(RECORDS)).not.toContain("desert");
  });
});

describe("fullRegionCounts", () => {
  it("counts all records per region, ignoring build filter", () => {
    const counts = fullRegionCounts(RECORDS);
    expect(counts.get("all")).toBe(7);
    expect(counts.get("global")).toBe(1);
    expect(counts.get("misthalin")).toBe(2);
    expect(counts.get("karamja")).toBe(1);
    expect(counts.get("anachronia")).toBe(2);
    expect(counts.get("tirannwn")).toBe(1);
  });
});
