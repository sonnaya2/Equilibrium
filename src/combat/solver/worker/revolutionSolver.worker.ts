/// <reference lib="webworker" />

import type { SerializableSolverRequest, SolverResultDTO } from "./serializable";
import type {
  HostToWorkerMessage,
  SolverProgress,
  WorkerToHostMessage,
} from "./protocol";
import type { SolveFn, SolveRuntimeOptions } from "./solveTypes";

declare const self: DedicatedWorkerGlobalScope;

const cancelled = new Set<number>();
const paused = new Set<number>();
let runningId: number | null = null;

function post(message: WorkerToHostMessage): void {
  self.postMessage(message);
}

/**
 * Wire API is `solveFromRequest(SerializableSolverRequest, options)`. The pure
 * search orchestrator `solve(SolveInput)` needs an EvaluateFn and is not called
 * from this boundary.
 */
async function loadSolve(): Promise<SolveFn> {
  const specifier = "../solve";
  const mod = (await import(/* webpackMode: "lazy" */ specifier)) as {
    solveFromRequest?: SolveFn;
    default?: SolveFn;
  };
  const fn = mod.solveFromRequest ?? mod.default;
  if (typeof fn !== "function") {
    throw new Error("revolution solver: solveFromRequest export missing");
  }
  return fn;
}

async function waitWhilePaused(requestId: number): Promise<void> {
  while (paused.has(requestId) && !cancelled.has(requestId)) {
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
}

async function runStart(requestId: number, payload: SerializableSolverRequest): Promise<void> {
  runningId = requestId;
  cancelled.delete(requestId);
  paused.delete(requestId);

  try {
    const solve = await loadSolve();
    if (cancelled.has(requestId)) {
      post({ type: "cancelled", requestId });
      return;
    }

    const options: SolveRuntimeOptions = {
      onProgress: (progress: SolverProgress) => {
        if (cancelled.has(requestId) || runningId !== requestId) return;
        post({ type: "progress", requestId, progress });
      },
      isCancelled: () => cancelled.has(requestId) || runningId !== requestId,
      isPaused: () => paused.has(requestId),
      yieldSlice: async () => {
        await waitWhilePaused(requestId);
        if (cancelled.has(requestId)) return;
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
    };

    const result: SolverResultDTO = await solve(payload, options);

    if (cancelled.has(requestId) || runningId !== requestId) {
      post({ type: "cancelled", requestId });
      return;
    }
    post({ type: "result", requestId, result });
  } catch (err) {
    if (cancelled.has(requestId) || runningId !== requestId) {
      post({ type: "cancelled", requestId });
      return;
    }
    post({
      type: "error",
      requestId,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    if (runningId === requestId) runningId = null;
  }
}

self.onmessage = (event: MessageEvent<HostToWorkerMessage>) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  switch (msg.type) {
    case "start":
      if (runningId !== null && runningId !== msg.requestId) {
        cancelled.add(runningId);
      }
      void runStart(msg.requestId, msg.payload);
      break;
    case "cancel":
      cancelled.add(msg.requestId);
      paused.delete(msg.requestId);
      if (runningId === msg.requestId) {
        // Cooperative cancel: solve checks isCancelled; also post if idle.
      }
      break;
    case "pause":
      paused.add(msg.requestId);
      break;
    case "resume":
      paused.delete(msg.requestId);
      break;
  }
};
