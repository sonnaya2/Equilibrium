/**
 * Multi-worker UI Run host: parallel score-only live-cap probes + one full-analysis.
 * Isolated from Optimize pool cancel/dispose.
 */
import type { AdaptiveBranchFidelityResult } from "../branchFidelity";
import {
  UI_RUN_BRANCH_FIDELITY_LADDER,
  UI_RUN_INITIAL_LIVE_BRANCH_CAP,
  UI_RUN_MAX_LIVE_BRANCH_CAP,
} from "../branchFidelity";
import {
  preferredUiRunWorkerCount,
  simulateRevolutionForUiHybrid,
  type UiRunProbeResult,
} from "../uiRunCore";
import type { RevolutionInput } from "../../engine/simulation/revolution";
import type { SerializableUiRunRequest } from "./uiRunTypes";
import {
  isWorkerToHostMessage,
  type HostToWorkerMessage,
  type WorkerToHostMessage,
} from "./protocol";
import { canCreateSolverWorker, createSolverWorker } from "./workerCreate";
import { buildRevolutionInput, requireSimBase } from "./revive";
import {
  resolveAbilityCatalogue,
  resolveAbilitySpecsFromCatalogue,
} from "../../abilities/catalogue";

export type UiRunProgress = {
  phase: "probes" | "full";
  done: number;
  total: number;
  maxLiveBranches?: number;
  residualWeight?: number;
};

export type UiRunHostOptions = {
  isCancelled?: () => boolean;
  onProgress?: (p: UiRunProgress) => void;
  /** Override worker count (tests). Default 2-4 from hardware. */
  workers?: number;
  /** Force main-thread hybrid (tests / no Worker). */
  forceMainThread?: boolean;
};

let nextRequestId = 1;

function allocId(): number {
  const id = nextRequestId;
  nextRequestId += 1;
  return id;
}

type Slot = {
  worker: Worker;
  /** Chain jobs so one worker never runs two posts at once. */
  tail: Promise<void>;
};

let slots: Slot[] = [];

function disposeSlots(): void {
  for (const s of slots) {
    try {
      s.worker.terminate();
    } catch {
      // ignore
    }
  }
  slots = [];
}

function ensureSlots(n: number): Slot[] {
  while (slots.length < n) {
    const w = createSolverWorker();
    if (!w) break;
    slots.push({ worker: w, tail: Promise.resolve() });
  }
  return slots;
}

function enqueueSlot<T>(slot: Slot, job: () => Promise<T>): Promise<T> {
  const run = slot.tail.then(job, job);
  slot.tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function post(worker: Worker, message: HostToWorkerMessage): void {
  worker.postMessage(message);
}

function waitWorkerJob(
  worker: Worker,
  requestId: number,
  payload: SerializableUiRunRequest,
  isCancelled?: () => boolean,
): Promise<import("./uiRunTypes").UiRunWorkerResult> {
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isWorkerToHostMessage(event.data)) return;
      const msg = event.data as WorkerToHostMessage;
      if (msg.requestId !== requestId) return;
      if (msg.type === "started") return;
      if (msg.type === "ui_run_result") {
        cleanup();
        resolve(msg.result);
        return;
      }
      if (msg.type === "error") {
        cleanup();
        reject(new Error(msg.error));
        return;
      }
      if (msg.type === "cancelled") {
        cleanup();
        const err = new Error("ui run cancelled");
        err.name = "AbortError";
        reject(err);
      }
    };
    const onError = (ev: ErrorEvent) => {
      cleanup();
      reject(new Error(ev.message || "ui run worker error"));
    };
    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      clearInterval(poll);
    };
    const poll = setInterval(() => {
      if (isCancelled?.()) {
        post(worker, { type: "cancel", requestId });
        try {
          worker.terminate();
        } catch {
          // ignore
        }
        cleanup();
        // Drop broken slot; recreate later.
        slots = slots.filter((s) => s.worker !== worker);
        const err = new Error("ui run cancelled");
        err.name = "AbortError";
        reject(err);
      }
    }, 50);

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    post(worker, { type: "ui_run", requestId, payload });
  });
}

async function runProbeOnSlot(
  slot: Slot,
  base: Omit<SerializableUiRunRequest, "maxLiveBranches" | "fullAnalysis">,
  maxLiveBranches: number,
  isCancelled?: () => boolean,
): Promise<UiRunProbeResult> {
  return enqueueSlot(slot, async () => {
    const requestId = allocId();
    const result = await waitWorkerJob(
      slot.worker,
      requestId,
      { ...base, maxLiveBranches, fullAnalysis: false },
      isCancelled,
    );
    if (result.kind !== "probe") {
      throw new Error("ui run: expected probe result");
    }
    return result.probe;
  });
}

async function runFullOnSlot(
  slot: Slot,
  base: Omit<SerializableUiRunRequest, "maxLiveBranches" | "fullAnalysis">,
  maxLiveBranches: number,
  isCancelled?: () => boolean,
): Promise<AdaptiveBranchFidelityResult> {
  return enqueueSlot(slot, async () => {
    const requestId = allocId();
    const result = await waitWorkerJob(
      slot.worker,
      requestId,
      { ...base, maxLiveBranches, fullAnalysis: true },
      isCancelled,
    );
    if (result.kind !== "full") {
      throw new Error("ui run: expected full result");
    }
    return { summary: result.summary, meta: result.meta };
  });
}

function throwIfCancelled(isCancelled?: () => boolean): void {
  if (!isCancelled?.()) return;
  const err = new Error("ui run cancelled");
  err.name = "AbortError";
  throw err;
}

/**
 * Parallel score-only probes across 2-4 workers, then one full-analysis at best cap.
 * Main-thread execution remains an explicit test/dev option.
 */
export async function runUiRevolution(
  request: SerializableUiRunRequest,
  options?: UiRunHostOptions,
): Promise<AdaptiveBranchFidelityResult> {
  throwIfCancelled(options?.isCancelled);

  if (options?.forceMainThread === true) {
    options?.onProgress?.({ phase: "probes", done: 0, total: 1 });
    const sim = requireSimBase(request.loadout);
    const cat = resolveAbilityCatalogue({
      strengthCape99: sim.strengthCape99 === true,
    });
    const bar = resolveAbilitySpecsFromCatalogue(cat, request.barIds);
    const input: RevolutionInput = buildRevolutionInput(sim, {
      bar,
      style: request.style,
      durationTicks: request.durationTicks,
      abilities: cat.catalogue,
    });
    options?.onProgress?.({ phase: "full", done: 0, total: 1 });
    const out = simulateRevolutionForUiHybrid(input);
    options?.onProgress?.({ phase: "full", done: 1, total: 1 });
    return out;
  }
  if (!canCreateSolverWorker()) {
    throw new Error("Revolution analysis workers are unavailable in this browser");
  }

  const caps = [...UI_RUN_BRANCH_FIDELITY_LADDER.liveCaps];
  const workerN = Math.min(options?.workers ?? preferredUiRunWorkerCount(), caps.length);
  const pool = ensureSlots(workerN);
  if (pool.length === 0) {
    throw new Error("Revolution analysis worker could not be started");
  }

  const base = {
    loadout: request.loadout,
    barIds: request.barIds,
    style: request.style,
    durationTicks: request.durationTicks,
  };

  const firstLive = caps[0] ?? UI_RUN_INITIAL_LIVE_BRANCH_CAP;
  options?.onProgress?.({ phase: "full", done: 0, total: 1, maxLiveBranches: firstLive });
  const firstFull = await runFullOnSlot(pool[0]!, base, firstLive, options?.isCancelled);
  options?.onProgress?.({
    phase: "full",
    done: 1,
    total: 1,
    maxLiveBranches: firstLive,
    residualWeight: firstFull.meta.residualWeight,
  });
  if (!firstFull.summary.ok || firstFull.meta.complete || caps.length === 1) {
    return firstFull;
  }

  // The first full result doubles as its fidelity probe when widening is still cheap.
  const { chunkUiRunCaps, isResidualFreeProbe, pickBestUiRunProbe } = await import("../uiRunCore");
  const waves = chunkUiRunCaps(caps.slice(1), workerN);
  const filled: UiRunProbeResult[] = [
    {
      maxLiveBranches: firstLive,
      residualWeight: firstFull.meta.residualWeight,
      ok: firstFull.summary.ok,
      totalExpected: firstFull.summary.totalExpected,
      exactness: firstFull.meta.exactness,
    },
  ];
  let completed = 1;
  const totalCapCount = caps.length;

  options?.onProgress?.({
    phase: "probes",
    done: completed,
    total: totalCapCount,
  });

  for (const wave of waves) {
    throwIfCancelled(options?.isCancelled);
    const waveResults = await Promise.all(
      wave.map(async (live, i) => {
        const slot = pool[i % pool.length]!;
        const probe = await runProbeOnSlot(slot, base, live, options?.isCancelled);
        completed += 1;
        options?.onProgress?.({
          phase: "probes",
          done: completed,
          total: totalCapCount,
          maxLiveBranches: probe.maxLiveBranches,
          residualWeight: probe.residualWeight,
        });
        return probe;
      }),
    );
    filled.push(...waveResults);
    if (waveResults.some(isResidualFreeProbe)) break;
  }

  throwIfCancelled(options?.isCancelled);

  const bestLive = pickBestUiRunProbe(filled)?.maxLiveBranches;
  const live = bestLive ?? caps[caps.length - 1] ?? UI_RUN_MAX_LIVE_BRANCH_CAP;

  if (live === firstLive) {
    return {
      summary: firstFull.summary,
      meta: { ...firstFull.meta, attempts: filled.length },
    };
  }

  options?.onProgress?.({
    phase: "full",
    done: 0,
    total: 1,
    maxLiveBranches: live,
  });

  const slot = pool[0]!;
  const full = await runFullOnSlot(slot, base, live, options?.isCancelled);
  options?.onProgress?.({
    phase: "full",
    done: 1,
    total: 1,
    maxLiveBranches: live,
    residualWeight: full.meta.residualWeight,
  });
  return {
    summary: full.summary,
    meta: {
      ...full.meta,
      attempts: filled.length + 1,
    },
  };
}

/** Hard-stop UI Run workers (does not touch Optimize pool). */
export function cancelUiRevolutionWorkers(): void {
  disposeSlots();
}

/** Test hook. */
export function resetUiRunHostForTests(): void {
  disposeSlots();
  nextRequestId = 1;
}
