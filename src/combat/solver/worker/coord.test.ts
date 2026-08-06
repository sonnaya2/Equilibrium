import { describe, expect, it } from "vitest";
import { PoolCoordHost, WorkerCoordState } from "./coord";

describe("PoolCoordHost unique set", () => {
  it("counts distinct bar keys once across agents (not a sum)", () => {
    const host = new PoolCoordHost(2, 100);
    expect(host.globalBudget).toBe(200);
    host.noteKeys(["a\0b", "c\0d"]);
    host.noteKeys(["c\0d", "e\0f"]); // overlap + one new
    expect(host.uniqueCandidates).toBe(3);
    host.noteBar(["a", "b"]); // already present
    expect(host.uniqueCandidates).toBe(3);
  });

  it("tracks max evaluations per agent toward global budget", () => {
    const host = new PoolCoordHost(2, 50);
    host.noteAgentEvaluations(0, 40);
    host.noteAgentEvaluations(0, 30); // ignore regression
    host.noteAgentEvaluations(1, 50);
    expect(host.globalEvaluations).toBe(90);
    expect(host.budgetExhausted).toBe(false);
    host.noteAgentEvaluations(0, 50);
    expect(host.globalEvaluations).toBe(100);
    expect(host.budgetExhausted).toBe(true);
    expect(host.shouldStop).toBe(true);
  });

  it("keeps the higher exploratory incumbent and upgrades fullScore", () => {
    const host = new PoolCoordHost(1, 10);
    expect(host.noteIncumbent(100, ["x", "y"])).toBe(true);
    expect(host.noteIncumbent(90, ["worse"])).toBe(false);
    expect(host.getIncumbent()?.score).toBe(100);
    expect(host.noteIncumbent(100, ["x", "y"], 200)).toBe(true);
    expect(host.getIncumbent()?.fullScore).toBe(200);
    expect(host.noteIncumbent(150, ["z"])).toBe(true);
    expect(host.getIncumbent()?.bar).toEqual(["z"]);
  });

  it("noteBar does not mark unique authoritative; noteKeys does", () => {
    const host = new PoolCoordHost(2, 10);
    expect(host.hasAuthoritativeUnique).toBe(false);
    host.noteBar(["a", "b"]);
    expect(host.uniqueCandidates).toBe(1);
    expect(host.hasAuthoritativeUnique).toBe(false);
    host.noteKeys(["c\0d"]);
    expect(host.uniqueCandidates).toBe(2);
    expect(host.hasAuthoritativeUnique).toBe(true);
  });
  it("batches only unpushed keys per agent", () => {
    const host = new PoolCoordHost(2, 10);
    host.noteKeys(["k1", "k2"]);
    const b0 = host.batchFor(0);
    expect(b0.visitedKeys).toEqual(expect.arrayContaining(["k1", "k2"]));
    const b0again = host.batchFor(0);
    expect(b0again.visitedKeys).toBeUndefined();
    const b1 = host.batchFor(1);
    expect(b1.visitedKeys?.length).toBe(2);
  });
});

describe("WorkerCoordState", () => {
  it("skips peer-visited keys not evaluated locally", () => {
    const w = new WorkerCoordState();
    w.applyHostBatch({
      seq: 1,
      globalBudget: 100,
      globalEvaluations: 0,
      stop: false,
      visitedKeys: ["peer"],
    });
    expect(w.shouldSkip("peer")).toBe(true);
    w.noteLocalSeen("local");
    expect(w.shouldSkip("local")).toBe(false);
    expect(w.drainSeenKeys()).toEqual(["local"]);
    expect(w.drainSeenKeys()).toEqual([]);
  });

  it("soft-stops on host stop batch", () => {
    const w = new WorkerCoordState();
    w.applyHostBatch({
      seq: 2,
      globalBudget: 100,
      globalEvaluations: 100,
      stop: true,
    });
    expect(w.stopped).toBe(true);
  });
});
