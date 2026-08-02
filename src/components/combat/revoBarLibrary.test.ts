import { describe, expect, it } from "vitest";
import {
  emptyBarLibrary,
  isBarAlreadySaved,
  libraryForStyle,
  MAX_RECENT_BARS,
  normalizeBarLibrary,
  withPermanentBar,
  withRecentBar,
  withoutRecentBar,
  withoutSavedBar,
  type RevoBarLibrary,
} from "./revoBarLibrary";

const BAR_A = ["slice", "fury", "assault", "destroy", "pulverise"];
const BAR_B = ["slice", "fury", "assault", "destroy", "meteor_strike"];
const BAR_C = ["slice", "fury", "assault", "cleave", "pulverise"];
const BAR_D = ["slice", "fury", "assault", "sever", "pulverise"];
const BAR_E = ["slice", "fury", "assault", "smash", "pulverise"];
const BAR_F = ["slice", "fury", "assault", "havoc", "pulverise"];

function empty(): RevoBarLibrary {
  return emptyBarLibrary();
}

describe("revoBarLibrary", () => {
  it("normalizes corrupt storage to empty lists", () => {
    expect(normalizeBarLibrary(null).recents).toEqual([]);
    expect(normalizeBarLibrary({ version: 1, recents: "nope" }).saved).toEqual([]);
    expect(
      normalizeBarLibrary({
        version: 1,
        recents: [{ id: "x", style: "melee", bar: [] }],
        saved: [{ id: "y", style: "melee", bar: ["ok", "ok2"] }],
      }).saved,
    ).toHaveLength(1);
  });

  it("auto-keeps only the last five autosaves (MRU)", () => {
    const bars = [BAR_A, BAR_B, BAR_C, BAR_D, BAR_E, BAR_F];
    let store = empty();
    bars.forEach((bar, i) => {
      store = withRecentBar(store, {
        bar,
        style: "melee",
        score: 1000 + i,
        now: 1_000 + i,
      });
    });
    expect(store.recents).toHaveLength(MAX_RECENT_BARS);
    expect([...store.recents[0]!.bar]).toEqual(BAR_F);
    expect(store.recents.map((e) => e.score)).toEqual([1005, 1004, 1003, 1002, 1001]);
    expect(store.recents.some((e) => e.bar.join() === BAR_A.join())).toBe(false);
  });

  it("re-pushing the same bar bumps it to front with a new score", () => {
    let store = withRecentBar(empty(), { bar: BAR_A, style: "melee", score: 10, now: 1 });
    store = withRecentBar(store, { bar: BAR_B, style: "melee", score: 20, now: 2 });
    store = withRecentBar(store, { bar: BAR_A, style: "melee", score: 99, now: 3 });
    expect(store.recents).toHaveLength(2);
    expect([...store.recents[0]!.bar]).toEqual(BAR_A);
    expect(store.recents[0]!.score).toBe(99);
  });

  it("keeps autosaves per style separate for the style filter", () => {
    let store = withRecentBar(empty(), { bar: BAR_A, style: "melee", score: 1, now: 1 });
    store = withRecentBar(store, { bar: BAR_B, style: "magic", score: 2, now: 2 });
    expect(libraryForStyle(store, "melee").recents).toHaveLength(1);
    expect(libraryForStyle(store, "magic").recents).toHaveLength(1);
    expect([...libraryForStyle(store, "melee").recents[0]!.bar]).toEqual(BAR_A);
  });

  it("permanently saves and does not duplicate the same fingerprint", () => {
    let store = withPermanentBar(empty(), { bar: BAR_A, style: "melee", score: 50, now: 1 });
    store = withPermanentBar(store, {
      bar: BAR_A,
      style: "melee",
      score: 80,
      name: "Boss bar",
      now: 2,
    });
    expect(store.saved).toHaveLength(1);
    expect(store.saved[0]!.score).toBe(80);
    expect(store.saved[0]!.name).toBe("Boss bar");
    expect(isBarAlreadySaved(store, "melee", BAR_A)).toBe(true);
    expect(isBarAlreadySaved(store, "melee", BAR_B)).toBe(false);
  });

  it("Save does not touch autosaves and remove works", () => {
    let store = withRecentBar(empty(), { bar: BAR_A, style: "melee", score: 1, now: 1 });
    store = withPermanentBar(store, { bar: BAR_B, style: "melee", score: 2, now: 2 });
    expect(store.recents).toHaveLength(1);
    expect(store.saved).toHaveLength(1);
    const savedId = store.saved[0]!.id;
    const recentId = store.recents[0]!.id;
    store = withoutSavedBar(store, savedId);
    expect(store.saved).toHaveLength(0);
    expect(store.recents).toHaveLength(1);
    store = withoutRecentBar(store, recentId);
    expect(store.recents).toHaveLength(0);
  });
});
