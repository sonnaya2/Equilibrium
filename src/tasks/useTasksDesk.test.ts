import { describe, expect, it } from "vitest";
import { asTaskRecords } from "@/tasks";
import { taskId } from "@/tasks/progress";
import {
  aggregateDifficulties,
  aggregateTaskStats,
  countActiveFilters,
  filterTaskPage,
  fullRegionCounts,
  prioritizePinnedTasks,
  recommendTasks,
  regionsInTaskData,
  sortTasks,
  taskSkillNames,
  type TaskPageFilters,
} from "./useTasksDesk";

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

const FILTER_RECORDS = asTaskRecords([
  {
    id: "fish",
    name: "Catch a shark",
    tier: "easy",
    points: 10,
    regionId: "karamja",
    requirements: "76 Fishing",
    catalystCompletionRate: 72,
  },
  {
    id: "boss",
    name: "Defeat a boss",
    tier: "master",
    points: 400,
    regionId: "morytania",
    requirements: "90 Attack, 90 Strength",
    catalystCompletionRate: 4.2,
  },
  {
    id: "global",
    name: "Reach a total level",
    tier: "medium",
    points: 30,
    regionId: "global",
    category: "Progression",
  },
]);

const BASE_FILTERS: TaskPageFilters = {
  search: "",
  tier: "all",
  region: "all",
  category: "all",
  skill: "all",
  buildOnly: false,
  status: "all",
  sort: "points",
};

describe("task page view model", () => {
  it("derives Catalyst skill tags from requirements without changing records", () => {
    expect(taskSkillNames(FILTER_RECORDS[0])).toEqual(["Fishing"]);
    expect(taskSkillNames(FILTER_RECORDS[1])).toEqual(["Attack", "Strength"]);
    expect(FILTER_RECORDS[0].skills).toBeUndefined();
  });

  it("composes build, skill, category, and completion filters", () => {
    const completed = new Set([taskId(FILTER_RECORDS[0])]);
    const unlocked = new Set(["karamja"]);
    expect(
      filterTaskPage(
        FILTER_RECORDS,
        { ...BASE_FILTERS, buildOnly: true, status: "completed", skill: "Fishing" },
        completed,
        unlocked,
      ),
    ).toEqual([FILTER_RECORDS[0]]);
    expect(
      filterTaskPage(
        FILTER_RECORDS,
        { ...BASE_FILTERS, category: "Progression" },
        completed,
        unlocked,
      ),
    ).toEqual([FILTER_RECORDS[2]]);
  });

  it("derives stats, difficulty totals, and deterministic recommendations", () => {
    const completed = new Set(["fish"]);
    const unlocked = new Set(["karamja"]);
    const buildRecords = FILTER_RECORDS.filter(
      (record) => record.regionId === "global" || unlocked.has(record.regionId ?? ""),
    );
    const stats = aggregateTaskStats(
      FILTER_RECORDS,
      buildRecords,
      completed,
      { easy: 10, medium: 30, master: 400 },
      2,
    );
    expect(stats).toMatchObject({
      totalTasks: 3,
      completedTasks: 1,
      totalPoints: 440,
      completedPoints: 10,
      activeFilterCount: 2,
      buildTaskCount: 2,
      completedBuildTaskCount: 1,
    });
    const difficulty = aggregateDifficulties(
      [...FILTER_RECORDS, { ...FILTER_RECORDS[0], id: "fish-2" }],
      completed,
    );
    expect(difficulty.map((row) => [row.count, row.pointsPerTask])).toEqual([
      [2, 10],
      [1, 30],
      [1, 400],
    ]);
    expect(recommendTasks(FILTER_RECORDS, completed, {}, unlocked, 2).map(taskId)).toEqual([
      "global",
      "boss",
    ]);
  });

  it("sorts and counts active filters", () => {
    expect(sortTasks(FILTER_RECORDS, "points", {}).map(taskId)).toEqual([
      "boss",
      "global",
      "fish",
    ]);
    expect(sortTasks(FILTER_RECORDS, "rarest", {}).map(taskId)).toEqual([
      "boss",
      "fish",
      "global",
    ]);
    expect(
      countActiveFilters({ ...BASE_FILTERS, search: "boss", tier: "master", buildOnly: true }),
    ).toBe(3);
  });

  it("puts pinned tasks first in pin order", () => {
    expect(
      prioritizePinnedTasks(FILTER_RECORDS, ["global", "fish"]).map(taskId),
    ).toEqual(["global", "fish", "boss"]);
  });
});
