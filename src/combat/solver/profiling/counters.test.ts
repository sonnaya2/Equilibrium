import { describe, expect, it } from "vitest";
import {
  createProfileCounters,
  noteEval,
  noteProgressEmit,
  noteUniqueBar,
  noteWorkerWait,
  snapshotProfile,
} from "./counters";

describe("solver profiling counters", () => {
  it("no-ops when disabled and returns zero snapshot", () => {
    const c = createProfileCounters(false);
    noteEval(c, "search", false);
    noteEval(c, "full", true);
    noteUniqueBar(c);
    noteProgressEmit(c);
    noteWorkerWait(c, 12);
    const snap = snapshotProfile(c);
    expect(snap).toEqual({
      wallMs: 0,
      evaluations: 0,
      searchEvals: 0,
      fullEvals: 0,
      evalsPerSec: 0,
      memoHits: 0,
      uniqueBars: 0,
      progressEmits: 0,
      workerWaitMs: 0,
      neighborGenerated: 0,
      neighborDeduped: 0,
      neighborDuplicateSkipped: 0,
      barKeysSeenWithinWorker: 0,
      duplicateEvalAttempts: 0,
      fingerprintJoins: 0,
      beamChildrenGenerated: 0,
      beamChildrenUniqueKeys: 0,
    });
  });

  it("tracks evals, memo hits, unique bars, progress, worker wait", () => {
    const c = createProfileCounters(true);
    noteEval(c, "search", false);
    noteEval(c, "search", true);
    noteEval(c, "full", false);
    noteEval(c, "full", true);
    noteUniqueBar(c);
    noteUniqueBar(c);
    noteProgressEmit(c);
    noteWorkerWait(c, 5);
    noteWorkerWait(c, -1);
    const snap = snapshotProfile(c);
    expect(snap.evaluations).toBe(4);
    expect(snap.searchEvals).toBe(2);
    expect(snap.fullEvals).toBe(2);
    expect(snap.memoHits).toBe(2);
    expect(snap.uniqueBars).toBe(2);
    expect(snap.progressEmits).toBe(1);
    expect(snap.workerWaitMs).toBe(5);
    expect(snap.neighborGenerated).toBe(0);
    expect(snap.duplicateEvalAttempts).toBe(0);
    expect(snap.fingerprintJoins).toBe(0);
    expect(snap.wallMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(snap.evalsPerSec)).toBe(true);
    expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
  });

  it("note* accepts undefined without throwing", () => {
    expect(() => {
      noteEval(undefined, "search", false);
      noteUniqueBar(undefined);
      noteProgressEmit(undefined);
      noteWorkerWait(undefined, 1);
    }).not.toThrow();
  });
});
