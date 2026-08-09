import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearSolverHostDiagnostics,
  getSolverHostDiagnostics,
  isSolverHostDebugEnabled,
  noteSolverHost,
  snapshotSolverHostHeap,
} from "./hostDiagnostics";

describe("hostDiagnostics", () => {
  afterEach(() => {
    clearSolverHostDiagnostics();
    try {
      const g = globalThis as { localStorage?: { removeItem(key: string): void } };
      g.localStorage?.removeItem("eq-solver-debug");
    } catch {
      // ignore
    }
  });

  it("rings events and reports pool worker count", () => {
    noteSolverHost("optimize-start", { agents: 4 });
    noteSolverHost("pool-ensure", { after: 4 });
    const snap = getSolverHostDiagnostics(4);
    expect(snap.poolWorkers).toBe(4);
    expect(snap.events.map((e) => e.kind)).toEqual(["optimize-start", "pool-ensure"]);
    expect(snap.events[0]?.detail).toEqual({ agents: 4 });
  });

  it("caps the ring buffer", () => {
    for (let i = 0; i < 60; i++) noteSolverHost(`e${i}`);
    const snap = getSolverHostDiagnostics(0);
    expect(snap.events.length).toBe(48);
    expect(snap.events[0]?.kind).toBe("e12");
    expect(snap.events[47]?.kind).toBe("e59");
  });

  it("reads debug flag from localStorage when window exists", () => {
    const store = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    };
    vi.stubGlobal("window", {
      localStorage,
      location: { search: "" },
    });
    expect(isSolverHostDebugEnabled()).toBe(false);
    localStorage.setItem("eq-solver-debug", "1");
    expect(isSolverHostDebugEnabled()).toBe(true);
    vi.unstubAllGlobals();
  });

  it("heap snapshot is null or finite numbers", () => {
    const heap = snapshotSolverHostHeap();
    if (heap == null) {
      expect(heap).toBeNull();
      return;
    }
    expect(heap.jsHeapUsedMB).toBeGreaterThanOrEqual(0);
    expect(heap.jsHeapTotalMB).toBeGreaterThanOrEqual(heap.jsHeapUsedMB);
  });
});
