import { describe, expect, it } from "vitest";
import { asTaskRecords, filterTasks, taskPoints } from "./index";

const RECORDS = asTaskRecords([
  { name: "Catch a lobster", tier: "easy", region: "karamja", skills: ["Fishing"] },
  { name: "Defeat Elvarg", tier: "master", points: 400, description: "Slay the dragon of Crandor.", region: "karamja" },
  { name: 42, tier: "easy" },
  { name: "No tier given" },
  "junk",
  null,
]);

describe("asTaskRecords", () => {
  it("keeps only records with a name and tier", () => {
    expect(RECORDS).toHaveLength(2);
    expect(asTaskRecords("not an array")).toEqual([]);
    expect(asTaskRecords(undefined)).toEqual([]);
  });
});

describe("taskPoints", () => {
  const tiers = { easy: 10, master: 400 };
  it("prefers record points, falls back to the tier table, else null", () => {
    expect(taskPoints(RECORDS[1], tiers)).toBe(400);
    expect(taskPoints(RECORDS[0], tiers)).toBe(10);
    expect(taskPoints({ name: "x", tier: "grandmaster" }, tiers)).toBeNull();
  });
});

describe("filterTasks", () => {
  it("filters by tier", () => {
    expect(filterTasks(RECORDS, "easy", "")).toEqual([RECORDS[0]]);
    expect(filterTasks(RECORDS, "all", "")).toHaveLength(2);
  });

  it("searches name, description, region, and skills", () => {
    expect(filterTasks(RECORDS, "all", "elvarg")).toEqual([RECORDS[1]]);
    expect(filterTasks(RECORDS, "all", "crandor")).toEqual([RECORDS[1]]);
    expect(filterTasks(RECORDS, "all", "fishing")).toEqual([RECORDS[0]]);
    expect(filterTasks(RECORDS, "all", "karamja")).toHaveLength(2);
    expect(filterTasks(RECORDS, "master", "fishing")).toEqual([]);
  });
});
