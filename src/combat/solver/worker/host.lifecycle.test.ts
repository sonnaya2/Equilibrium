/**
 * Deterministic Revolution solver host lifecycle tests.
 * Uses FakeWorker + fake timers - no real solveFromRequest runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import {
  cancelOptimize,
  getRevolutionSolverClient,
  resetSolverHostForTests,
  runOptimize,
  runSolverOnMainThread,
  setWorkerFactoryForTests,
  setWorkerHostTimeoutsForTests,
} from "./host";
import { isWorkerToHostMessage, type HostToWorkerMessage, type SolverProgress } from "./protocol";
import { cancelUiRevolutionWorkers, resetUiRunHostForTests, runUiRevolution } from "./uiRunHost";
import {
  defaultSerializableRequest,
  emptyModifierSources,
  type SerializableRevolutionSimBase,
  type SerializableSolverRequest,
  type SolverResultDTO,
} from "./serializable";
// Minimal stub - pure lifecycle tests must not pull #shard JSON.
const EQUIPMENT_SET_ACTIVATION = {} as never;

function sampleSimBase(): SerializableRevolutionSimBase {
  return {
    base: 1200,
    level: 99,
    accuracy: 1,
    crit: { chance: 0.1, damageBonus: 0 },
    equipmentEffects: {
      activation: EQUIPMENT_SET_ACTIVATION,
      setCritChance: { unconditional: 0, conditional: {} },
      passiveIds: [],
      enchantments: [],
      weaponClass: null,
      defenderEquipped: false,
      passage: { active: false, agonyActive: false },
      amZiFlatDamage: 0,
      amHejDamageBonus: 0,
      vestments: {
        pieces: 0,
        heraldOfChaos: false,
        berserkExtension: false,
        increasedAdrenalineCap: false,
      },
    },
    league: {
      ruleset: "base",
      blessings: [],
      blessingIds: [],
      totalArmour: 0,
      maximumLife: 10_000,
      powerburstUntilTick: 0,
      targetSize: 1,
      occupiedTiles: 1,
    },
    equipmentIds: [],
    weaponConfiguration: "twohand",
    modifierSources: emptyModifierSources(),
  };
}

function sampleRequest(): SerializableSolverRequest {
  return defaultSerializableRequest({
    loadout: sampleSimBase(),
    style: "melee",
    durationTicks: 100,
    tier: "thorough",
    seed: 1,
  });
}

function sampleResult(overrides?: Partial<SolverResultDTO>): SolverResultDTO {
  return {
    bar: ["melee:slice", "melee:fury"],
    score: 100,
    windowDpms: 100,
    evaluations: 10,
    uniqueCandidates: 5,
    seed: 1,
    profileId: "balanced",
    tier: "thorough",
    durationTicks: 100,
    solveIdentity: "",
    ...overrides,
  };
}

function sampleProgress(overrides?: Partial<SolverProgress>): SolverProgress {
  return {
    evaluations: 1,
    uniqueCandidates: 1,
    bestScore: 10,
    // Optional dual fields - callers may override; defaults keep exploratory scale only.
    bestExploratoryScore: 10,
    windowDpms: 10,
    phase: "explore",
    noImprovementCount: 0,
    topBarPreview: ["melee:slice"],
    evaluationMode: "search",
    ...overrides,
  };
}

type Listener = (event: { data?: unknown; message?: string }) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];
  static autoStarted = true;
  static failConstruct = false;

  private listeners = new Map<string, Set<Listener>>();
  terminated = false;
  lastStart: HostToWorkerMessage | null = null;
  posts: HostToWorkerMessage[] = [];

  constructor() {
    if (FakeWorker.failConstruct) throw new Error("Worker constructor failed");
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, fn: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }

  postMessage(data: unknown): void {
    if (this.terminated) return;
    const msg = data as HostToWorkerMessage;
    this.posts.push(msg);
    if (msg?.type === "start") {
      this.lastStart = msg;
      if (FakeWorker.autoStarted) {
        queueMicrotask(() => {
          if (!this.terminated && this.lastStart === msg) {
            this.emit({ type: "started", requestId: msg.requestId });
          }
        });
      }
    }
  }

  terminate(): void {
    this.terminated = true;
    this.listeners.clear();
  }

  emit(data: unknown): void {
    if (this.terminated) return;
    for (const fn of this.listeners.get("message") ?? []) fn({ data });
  }

  emitError(message: string): void {
    for (const fn of this.listeners.get("error") ?? []) fn({ message });
  }

  emitMessageError(): void {
    for (const fn of this.listeners.get("messageerror") ?? []) fn({});
  }
}

const solveMock: Mock = vi.fn();

vi.mock("../solveFromRequest", () => ({
  solveFromRequest: (...args: unknown[]) => solveMock(...args),
  default: (...args: unknown[]) => solveMock(...args),
}));

function isAbort(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

describe("solver host lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWorker.instances = [];
    FakeWorker.autoStarted = true;
    FakeWorker.failConstruct = false;
    resetSolverHostForTests();
    resetUiRunHostForTests();
    setWorkerHostTimeoutsForTests({ firstAckMs: 1000 });
    setWorkerFactoryForTests(() => new FakeWorker() as unknown as Worker);
    solveMock.mockReset();
    solveMock.mockImplementation(
      async (
        _req: unknown,
        opts?: { isCancelled?: () => boolean; yieldSlice?: () => Promise<void> },
      ) => {
        for (let i = 0; i < 5; i++) {
          if (opts?.isCancelled?.()) {
            throw new DOMException("revolution solver cancelled", "AbortError");
          }
          await opts?.yieldSlice?.();
        }
        return sampleResult();
      },
    );
  });

  afterEach(async () => {
    resetSolverHostForTests();
    // Flush deferred settle + any leftover yield timers from cancelled main solves.
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await vi.runOnlyPendingTimersAsync();
    await Promise.resolve();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("1. worker sends immediate started acknowledgement", async () => {
    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const p = client.start(sampleRequest());
    void p.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeWorker.instances.length).toBeGreaterThan(0);
    const w = FakeWorker.instances[0]!;
    expect(w.lastStart?.type).toBe("start");
    const requestId = (w.lastStart as { requestId: number }).requestId;
    w.emit({ type: "started", requestId });
    w.emit({ type: "result", requestId, result: sampleResult() });
    await expect(p).resolves.toMatchObject({ score: 100 });
  });

  it("2. slow import after acknowledgement does not trigger fallback", async () => {
    FakeWorker.autoStarted = false;
    setWorkerHostTimeoutsForTests({ firstAckMs: 500 });
    const client = getRevolutionSolverClient();
    const p = client.start(sampleRequest());
    await vi.advanceTimersByTimeAsync(0);
    const w = FakeWorker.instances[0]!;
    const requestId = (w.lastStart as { requestId: number }).requestId;
    w.emit({ type: "started", requestId });
    await vi.advanceTimersByTimeAsync(5_000);
    w.emit({ type: "result", requestId, result: sampleResult({ score: 42 }) });
    await expect(p).resolves.toMatchObject({ score: 42 });
  });

  it("3. no acknowledgement triggers reject", async () => {
    FakeWorker.autoStarted = false;
    setWorkerHostTimeoutsForTests({ firstAckMs: 200 });
    const client = getRevolutionSolverClient();
    const p = client.start(sampleRequest(), undefined, { preferWorker: true });
    const settled = p.then(
      () => "resolved",
      (e: Error) => e.message,
    );
    await vi.advanceTimersByTimeAsync(250);
    expect(String(await settled)).toMatch(/did not acknowledge start/);
  });

  it("4. intentional cancellation does not start a main-thread run", async () => {
    const p = runOptimize(sampleRequest(), undefined, { agents: 1 });
    const settled = expect(p).rejects.toSatisfy(isAbort);
    await vi.advanceTimersByTimeAsync(0);
    cancelOptimize();
    await vi.advanceTimersByTimeAsync(0);
    await settled;
  });

  it("5. direct main-thread solve is cancelled by cancelOptimize", async () => {
    let yieldCount = 0;
    solveMock.mockImplementation(
      async (
        _req: unknown,
        opts?: { isCancelled?: () => boolean; yieldSlice?: () => Promise<void> },
      ) => {
        for (let i = 0; i < 50; i++) {
          if (opts?.isCancelled?.()) {
            throw new DOMException("revolution solver cancelled", "AbortError");
          }
          yieldCount++;
          await opts?.yieldSlice?.();
        }
        return sampleResult();
      },
    );
    const p = runOptimize(sampleRequest(), undefined, { forceMainThread: true });
    const settled = expect(p).rejects.toSatisfy(isAbort);
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    cancelOptimize();
    await vi.advanceTimersByTimeAsync(100);
    await settled;
    expect(yieldCount).toBeLessThan(50);
  });

  it("6. forced-main-thread solve is cancelled", async () => {
    const p = runOptimize(sampleRequest(), undefined, { forceMainThread: true });
    const settled = expect(p).rejects.toSatisfy(isAbort);
    await vi.advanceTimersByTimeAsync(0);
    cancelOptimize();
    await vi.advanceTimersByTimeAsync(50);
    await settled;
  });

  it("7. superseding a run settles the old promise once", async () => {
    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const first = client.start(sampleRequest());
    await vi.advanceTimersByTimeAsync(0);
    const w = FakeWorker.instances[0]!;
    const firstId = (w.lastStart as { requestId: number }).requestId;

    let firstSettled = 0;
    const firstTracked = first.then(
      () => {
        firstSettled++;
        return "ok";
      },
      () => {
        firstSettled++;
        return "err";
      },
    );

    const second = client.start(sampleRequest());
    await vi.advanceTimersByTimeAsync(0);
    expect(await firstTracked).toBe("err");
    expect(firstSettled).toBe(1);

    w.emit({ type: "started", requestId: firstId });
    w.emit({ type: "result", requestId: firstId, result: sampleResult({ score: 1 }) });

    const secondId = (w.lastStart as { requestId: number }).requestId;
    w.emit({ type: "started", requestId: secondId });
    w.emit({ type: "result", requestId: secondId, result: sampleResult({ score: 99 }) });
    await expect(second).resolves.toMatchObject({ score: 99 });
  });

  it("8. stale worker progress is ignored", async () => {
    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const progress: number[] = [];
    const first = client.start(sampleRequest(), (p) => progress.push(p.bestScore));
    await vi.advanceTimersByTimeAsync(0);
    const w = FakeWorker.instances[0]!;
    const firstId = (w.lastStart as { requestId: number }).requestId;
    void first.catch(() => undefined);

    const second = client.start(sampleRequest(), (p) => progress.push(p.bestScore));
    await vi.advanceTimersByTimeAsync(0);
    const secondId = (w.lastStart as { requestId: number }).requestId;
    w.emit({ type: "started", requestId: secondId });
    w.emit({ type: "progress", requestId: firstId, progress: sampleProgress({ bestScore: 999 }) });
    w.emit({ type: "progress", requestId: secondId, progress: sampleProgress({ bestScore: 7 }) });
    w.emit({ type: "result", requestId: secondId, result: sampleResult() });
    await second;
    expect(progress).toEqual([7]);
  });

  it("9. stale worker results are ignored", async () => {
    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const first = client.start(sampleRequest());
    await vi.advanceTimersByTimeAsync(0);
    const w = FakeWorker.instances[0]!;
    const firstId = (w.lastStart as { requestId: number }).requestId;
    void first.catch(() => undefined);

    const second = client.start(sampleRequest());
    await vi.advanceTimersByTimeAsync(0);
    const secondId = (w.lastStart as { requestId: number }).requestId;
    w.emit({ type: "started", requestId: secondId });
    w.emit({ type: "result", requestId: firstId, result: sampleResult({ score: 1 }) });
    w.emit({ type: "result", requestId: secondId, result: sampleResult({ score: 50 }) });
    await expect(second).resolves.toMatchObject({ score: 50 });
  });

  it("10. wrong request IDs cannot resolve the active run", async () => {
    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const p = client.start(sampleRequest());
    await vi.advanceTimersByTimeAsync(0);
    const w = FakeWorker.instances[0]!;
    const requestId = (w.lastStart as { requestId: number }).requestId;
    w.emit({ type: "started", requestId });
    w.emit({ type: "result", requestId: requestId + 99, result: sampleResult({ score: 1 }) });
    w.emit({ type: "result", requestId, result: sampleResult({ score: 2 }) });
    await expect(p).resolves.toMatchObject({ score: 2 });
  });

  it("11. worker error fails closed after one single-worker retry", async () => {
    FakeWorker.autoStarted = false;
    let mainCalls = 0;
    solveMock.mockImplementation(async () => {
      mainCalls++;
      return sampleResult({ score: 77 });
    });

    const p = runOptimize(sampleRequest(), undefined, { agents: 1 });
    void p.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    for (const w of [...FakeWorker.instances]) {
      const id = (w.lastStart as { requestId: number } | null)?.requestId;
      if (id != null) {
        w.emit({ type: "started", requestId: id });
        w.emit({ type: "error", requestId: id, error: "boom", failureKind: "infrastructure" });
      }
    }
    await vi.advanceTimersByTimeAsync(0);
    for (const w of [...FakeWorker.instances]) {
      if (w.terminated) continue;
      const id = (w.lastStart as { requestId: number } | null)?.requestId;
      if (id != null) {
        w.emit({ type: "started", requestId: id });
        w.emit({ type: "error", requestId: id, error: "boom2", failureKind: "infrastructure" });
      }
    }
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).rejects.toThrow(/worker failed: boom2/);
    expect(mainCalls).toBe(0);
  });

  it("12. messageerror fails closed without running on main", async () => {
    FakeWorker.autoStarted = false;
    let mainCalls = 0;
    solveMock.mockImplementation(async () => {
      mainCalls++;
      return sampleResult({ score: 88 });
    });

    const p = runOptimize(sampleRequest(), undefined, { agents: 1 });
    void p.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    for (const w of [...FakeWorker.instances]) w.emitMessageError();
    await vi.advanceTimersByTimeAsync(0);
    for (const w of [...FakeWorker.instances]) {
      if (!w.terminated) w.emitMessageError();
    }
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).rejects.toThrow(/worker failed/);
    expect(mainCalls).toBe(0);
  });

  it("13. malformed messages do not kill a healthy solve", async () => {
    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const p = client.start(sampleRequest());
    await vi.advanceTimersByTimeAsync(0);
    const w = FakeWorker.instances[0]!;
    const requestId = (w.lastStart as { requestId: number }).requestId;
    w.emit({ type: "started", requestId });
    w.emit({ garbage: true });
    w.emit("not-an-object");
    w.emit({ type: "progress" });
    w.emit({ type: "result", requestId, result: sampleResult({ score: 11 }) });
    await expect(p).resolves.toMatchObject({ score: 11 });
  });

  it("14. progress callback exceptions do not kill the worker", async () => {
    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const p = client.start(sampleRequest(), () => {
      throw new Error("ui boom");
    });
    await vi.advanceTimersByTimeAsync(0);
    const w = FakeWorker.instances[0]!;
    const requestId = (w.lastStart as { requestId: number }).requestId;
    w.emit({ type: "started", requestId });
    w.emit({ type: "progress", requestId, progress: sampleProgress() });
    w.emit({ type: "result", requestId, result: sampleResult({ score: 12 }) });
    await expect(p).resolves.toMatchObject({ score: 12 });
  });

  it("15. paused runs can be cancelled", async () => {
    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const p = client.start(sampleRequest());
    await vi.advanceTimersByTimeAsync(0);
    const w = FakeWorker.instances[0]!;
    const requestId = (w.lastStart as { requestId: number }).requestId;
    w.emit({ type: "started", requestId });
    expect(client.pause()).toEqual({ ok: true });
    expect(w.posts.some((m) => m.type === "pause")).toBe(true);
    client.cancel();
    await expect(p).rejects.toSatisfy(isAbort);
  });

  it("15b. main-thread pause reports unavailable", async () => {
    const client = getRevolutionSolverClient();
    const p = client.start(sampleRequest(), undefined, { forceMainThread: true });
    const settled = expect(p).rejects.toSatisfy(isAbort);
    await vi.advanceTimersByTimeAsync(0);
    expect(client.pause()).toEqual({ ok: false, reason: "main-thread" });
    cancelOptimize();
    await vi.advanceTimersByTimeAsync(50);
    await settled;
  });

  it("16. dispose cleans timers, worker state, and active promises", async () => {
    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const p = client.start(sampleRequest());
    const settled = expect(p).rejects.toSatisfy(isAbort);
    await vi.advanceTimersByTimeAsync(0);
    const w = FakeWorker.instances[0]!;
    client.dispose();
    expect(w.terminated).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    await settled;
  });

  it("17. a new run after dispose succeeds", async () => {
    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const first = client.start(sampleRequest());
    void first.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    client.dispose();
    await vi.advanceTimersByTimeAsync(0);

    const client2 = getRevolutionSolverClient();
    const second = client2.start(sampleRequest());
    await vi.advanceTimersByTimeAsync(0);
    const w = FakeWorker.instances.find((x) => !x.terminated)!;
    const requestId = (w.lastStart as { requestId: number }).requestId;
    w.emit({ type: "started", requestId });
    w.emit({ type: "result", requestId, result: sampleResult({ score: 33 }) });
    await expect(second).resolves.toMatchObject({ score: 33 });
  });

  it("18. no unhandled rejection during cancellation races", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on("unhandledRejection", onUnhandled);

    FakeWorker.autoStarted = false;
    const client = getRevolutionSolverClient();
    const a = client.start(sampleRequest());
    const b = client.start(sampleRequest());
    const c = client.start(sampleRequest());
    const settled = Promise.allSettled([a, b, c]);
    cancelOptimize();
    await vi.advanceTimersByTimeAsync(0);
    const results = await settled;
    for (const r of results) expect(r.status).toBe("rejected");
    await vi.advanceTimersByTimeAsync(100);
    process.off("unhandledRejection", onUnhandled);
    expect(unhandled).toEqual([]);
  });

  it("19. public export surface: product API vs test-only", async () => {
    const combat = await import("../../../combat");
    expect(typeof combat.runOptimize).toBe("function");
    expect(typeof combat.cancelOptimize).toBe("function");
    expect("runSolverInWorker" in combat).toBe(false);
    expect("resetSolverHostForTests" in combat).toBe(false);
    expect("RevolutionSolverClient" in combat).toBe(false);

    const solver = await import("../../solver");
    expect(typeof solver.runOptimize).toBe("function");
    expect(typeof solver.cancelOptimize).toBe("function");
    expect(typeof solver.runSolverOnMainThread).toBe("function");
    expect(typeof solver.solverPoolSize).toBe("function");
    expect("runSolverInWorker" in solver).toBe(false);
    expect("resetSolverHostForTests" in solver).toBe(false);
  });

  it("20. protocol validators accept started and reject incomplete", () => {
    expect(isWorkerToHostMessage({ type: "started", requestId: 1 })).toBe(true);
    expect(isWorkerToHostMessage({ type: "progress", requestId: 1 })).toBe(false);
    expect(isWorkerToHostMessage({ type: "result", requestId: 1 })).toBe(false);
    expect(
      isWorkerToHostMessage({
        type: "progress",
        requestId: 1,
        progress: sampleProgress(),
      }),
    ).toBe(true);
  });

  it("returns worker profiling with measured host wait", async () => {
    FakeWorker.autoStarted = false;
    const onProfile = vi.fn();
    const client = getRevolutionSolverClient();
    const promise = client.start(sampleRequest(), undefined, {
      preferWorker: true,
      profile: true,
      onProfile,
    });
    await vi.advanceTimersByTimeAsync(0);
    const worker = FakeWorker.instances[0]!;
    const start = worker.lastStart;
    if (!start || start.type !== "start") throw new Error("expected worker start");
    expect(start.profile).toBe(true);
    worker.emit({ type: "started", requestId: start.requestId });
    worker.emit({
      type: "result",
      requestId: start.requestId,
      result: sampleResult(),
      profile: {
        wallMs: 5,
        evaluations: 2,
        searchEvals: 1,
        fullEvals: 1,
        evalsPerSec: 400,
        memoHits: 0,
        uniqueBars: 2,
        progressEmits: 1,
        workerWaitMs: 0,
        neighborGenerated: 2,
        neighborDeduped: 0,
        neighborDuplicateSkipped: 0,
        barKeysSeenWithinWorker: 2,
        duplicateEvalAttempts: 0,
        fingerprintJoins: 0,
        beamChildrenGenerated: 0,
        beamChildrenUniqueKeys: 0,
      },
    });
    await expect(promise).resolves.toMatchObject({ score: 100 });
    expect(onProfile).toHaveBeenCalledOnce();
    expect(onProfile.mock.calls[0]![0]).toMatchObject({ evaluations: 2 });
    expect(onProfile.mock.calls[0]![0].workerWaitMs).toBeGreaterThanOrEqual(0);
  });

  it("Worker constructor failure rejects preferWorker path", async () => {
    FakeWorker.failConstruct = true;
    const client = getRevolutionSolverClient();
    await expect(client.start(sampleRequest(), undefined, { preferWorker: true })).rejects.toThrow(
      /worker unavailable/,
    );
  });

  it("UI Run fails closed when its workers cannot start", async () => {
    setWorkerFactoryForTests(() => null);
    await expect(
      runUiRevolution({
        loadout: sampleSimBase(),
        barIds: ["slice"],
        style: "melee",
        durationTicks: 100,
      }),
    ).rejects.toThrow(/worker could not be started/);
    expect(solveMock).not.toHaveBeenCalled();
  });

  it("UI Run cancellation rejects the pending worker promise", async () => {
    const pending = runUiRevolution({
      loadout: sampleSimBase(),
      barIds: ["slice"],
      style: "melee",
      durationTicks: 100,
    });
    const rejected = expect(pending).rejects.toSatisfy(isAbort);
    await vi.advanceTimersByTimeAsync(0);
    const worker = FakeWorker.instances.at(-1)!;

    cancelUiRevolutionWorkers();

    await rejected;
    expect(worker.terminated).toBe(true);
  });

  it("plain loadout fails closed without disabling later worker runs", async () => {
    const plain = defaultSerializableRequest({
      loadout: { kind: "loadout", style: "melee" } as never,
      style: "melee",
      durationTicks: 100,
      tier: "thorough",
      seed: 1,
    });
    solveMock.mockImplementation(async () => sampleResult({ score: 1 }));
    await expect(runOptimize(plain)).rejects.toThrow(/worker-safe combat model/);

    FakeWorker.instances = [];
    FakeWorker.autoStarted = false;
    const p = runOptimize(sampleRequest(), undefined, { agents: 1 });
    void p.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeWorker.instances.length).toBeGreaterThan(0);
    cancelOptimize();
    await vi.advanceTimersByTimeAsync(0);
  });

  it("pool hard failure disposes agents before single-worker fallback", async () => {
    FakeWorker.autoStarted = false;
    let mainCalls = 0;
    solveMock.mockImplementation(async () => {
      mainCalls++;
      return sampleResult({ score: 55 });
    });
    const p = runOptimize(sampleRequest(), undefined, { agents: 1 });
    void p.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    const poolWorkers = [...FakeWorker.instances];
    expect(poolWorkers.length).toBeGreaterThan(0);
    for (const w of poolWorkers) {
      const id = (w.lastStart as { requestId: number } | null)?.requestId;
      if (id != null) {
        w.emit({ type: "started", requestId: id });
        w.emit({
          type: "error",
          requestId: id,
          error: "pool-boom",
          failureKind: "infrastructure",
        });
      }
    }
    await vi.advanceTimersByTimeAsync(0);
    // Pool agents must be terminated via dispose before/during fallback.
    for (const w of poolWorkers) {
      expect(w.terminated).toBe(true);
    }
    // Fail any remaining non-terminated workers (single-worker fallback instance)
    for (const w of [...FakeWorker.instances]) {
      if (w.terminated) continue;
      const id = (w.lastStart as { requestId: number } | null)?.requestId;
      if (id != null) {
        w.emit({ type: "started", requestId: id });
        w.emit({
          type: "error",
          requestId: id,
          error: "single-boom",
          failureKind: "infrastructure",
        });
      }
    }
    await vi.advanceTimersByTimeAsync(50);
    await expect(p).rejects.toThrow(/worker failed: single-boom/);
    expect(mainCalls).toBe(0);
  });

  it("does not retry a deterministic solver-domain error", async () => {
    FakeWorker.autoStarted = false;
    const p = runOptimize(sampleRequest(), undefined, { agents: 1 });
    void p.catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);
    const workers = [...FakeWorker.instances];
    expect(workers).toHaveLength(1);
    const worker = workers[0]!;
    const requestId = (worker.lastStart as { requestId: number }).requestId;
    worker.emit({ type: "started", requestId });
    worker.emit({
      type: "error",
      requestId,
      error: "deterministic solver-domain failure",
      failureKind: "domain",
    });
    await expect(p).rejects.toThrow(/deterministic solver-domain failure/);
    expect(FakeWorker.instances).toHaveLength(1);
  });

  it("runSolverOnMainThread is cooperative with isCancelled", async () => {
    let cancelled = false;
    solveMock.mockImplementation(
      async (
        _req: unknown,
        opts?: { isCancelled?: () => boolean; yieldSlice?: () => Promise<void> },
      ) => {
        for (let i = 0; i < 20; i++) {
          if (opts?.isCancelled?.()) {
            throw new DOMException("revolution solver cancelled", "AbortError");
          }
          await opts?.yieldSlice?.();
        }
        return sampleResult();
      },
    );
    const p = runSolverOnMainThread(sampleRequest(), undefined, {
      isCancelled: () => cancelled,
    });
    const settled = expect(p).rejects.toSatisfy(isAbort);
    await vi.advanceTimersByTimeAsync(0);
    cancelled = true;
    await vi.advanceTimersByTimeAsync(100);
    await settled;
  });
});
