import { describe, expect, it } from "vitest";
import {
  completedCount,
  EMPTY_PROGRESS,
  isComplete,
  normalizeProgress,
  pointsEarned,
  pointsTotal,
  taskId,
  toggleComplete,
} from "./progress";
import type { TaskRecord } from "./index";

const RECORDS: TaskRecord[] = [
  { name: "Catch a lobster", tier: "easy" },
  { name: "Defeat Elvarg", tier: "master", points: 400, id: "custom-elvarg" },
  { name: "Mine coal", tier: "medium" },
];

const TIERS = { easy: 10, medium: 30, hard: 80, elite: 200, master: 400 };

describe("taskId", () => {
  it("uses record.id when present", () => {
    expect(taskId(RECORDS[1])).toBe("custom-elvarg");
  });

  it("falls back to tier:name lowercased", () => {
    expect(taskId(RECORDS[0])).toBe("easy:catch a lobster");
  });
});

describe("normalizeProgress", () => {
  it("returns empty for junk", () => {
    expect(normalizeProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(normalizeProgress("x")).toEqual(EMPTY_PROGRESS);
    expect(normalizeProgress({ completed: "nope" })).toEqual(EMPTY_PROGRESS);
  });

  it("dedupes and keeps only non-empty strings", () => {
    expect(
      normalizeProgress({ completed: ["a", "a", "", 3, "b", null] }),
    ).toEqual({ completed: ["a", "b"] });
  });
});

describe("toggle / complete helpers", () => {
  it("toggles membership and counts against a record set", () => {
    let state = EMPTY_PROGRESS;
    const id = taskId(RECORDS[0]);
    state = toggleComplete(state, id);
    expect(isComplete(state, id)).toBe(true);
    expect(completedCount(state)).toBe(1);
    expect(completedCount(state, RECORDS)).toBe(1);
    expect(completedCount(state, [RECORDS[2]])).toBe(0);

    state = toggleComplete(state, id);
    expect(isComplete(state, id)).toBe(false);
  });
});

describe("pointsEarned / pointsTotal", () => {
  it("sums points for completed tasks only", () => {
    const state = {
      completed: [taskId(RECORDS[0]), taskId(RECORDS[1])],
    };
    expect(pointsTotal(RECORDS, TIERS)).toBe(10 + 400 + 30);
    expect(pointsEarned(state, RECORDS, TIERS)).toBe(10 + 400);
    expect(pointsEarned(state, [RECORDS[0]], TIERS)).toBe(10);
  });
});
