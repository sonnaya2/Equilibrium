import { describe, expect, it } from "vitest";
import {
  completedCount,
  EMPTY_PROGRESS,
  isComplete,
  legacyTaskId,
  migrateProgressIds,
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

const CATALYST_RECORDS: TaskRecord[] = [
  {
    name: "Complete the base camp tutorial on Anachronia.",
    tier: "easy",
    id: "wiki:462",
    wikiTaskId: 462,
  },
  {
    name: "Equip an Eldritch Crossbow.",
    tier: "master",
    id: "wiki:900",
    wikiTaskId: 900,
  },
];

const TIERS = { easy: 10, medium: 30, hard: 80, elite: 200, master: 400 };

describe("taskId", () => {
  it("uses record.id when present", () => {
    expect(taskId(RECORDS[1])).toBe("custom-elvarg");
  });

  it("uses wikiTaskId when id is absent", () => {
    expect(taskId({ name: "X", tier: "easy", wikiTaskId: 462 })).toBe("wiki:462");
  });

  it("falls back to tier:name lowercased", () => {
    expect(taskId(RECORDS[0])).toBe("easy:catch a lobster");
  });
});

describe("migrateProgressIds", () => {
  it("rewrites legacy tier:name keys to wiki ids", () => {
    const legacy = {
      completed: [
        legacyTaskId(CATALYST_RECORDS[0]),
        legacyTaskId(CATALYST_RECORDS[1]),
      ],
    };
    const migrated = migrateProgressIds(legacy, CATALYST_RECORDS);
    expect(migrated.completed).toEqual(["wiki:462", "wiki:900"]);
  });

  it("returns the same object when nothing needs migrating", () => {
    const state = { completed: ["wiki:462"] };
    expect(migrateProgressIds(state, CATALYST_RECORDS)).toBe(state);
  });

  it("dedupes when both legacy and canonical ids are present", () => {
    const state = {
      completed: ["wiki:462", legacyTaskId(CATALYST_RECORDS[0])],
    };
    const migrated = migrateProgressIds(state, CATALYST_RECORDS);
    expect(migrated.completed).toEqual(["wiki:462"]);
  });

  it("leaves unknown ids alone", () => {
    const state = { completed: ["wiki:462", "something-else"] };
    const migrated = migrateProgressIds(state, CATALYST_RECORDS);
    expect(migrated).toBe(state);
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
