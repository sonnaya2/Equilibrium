/// <reference lib="webworker" />

import type { SerializableSolverRequest, SolverResultDTO } from "./serializable";
import type { HostToWorkerMessage, SolverProgress, WorkerToHostMessage } from "./protocol";
import type { SolveFn, SolveRuntimeOptions } from "./solveTypes";
import { WorkerCoordState } from "./coord";

declare const self: DedicatedWorkerGlobalScope;

const cancelled = new Set<number>();
const paused = new Set<number>();
let runningId: number | null = null;
/** Active coord mirror for the running request (message-batch only). */
let activeCoord: WorkerCoordState | null = null;

function post(message: WorkerToHostMessage): void {
  self.postMessage(message);
}

function clearRequestState(requestId: number): void {
  cancelled.delete(requestId);
  paused.delete(requestId);
}

async function loadSolve(): Promise<SolveFn> {
  const mod = (await import(/* webpackMode: "lazy" */ "../solveFromRequest")) as {
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

async function runStart(
  requestId: number,
  payload: SerializableSolverRequest,
  coordBootstrap?: {
    agentIndex: number;
    agentCount: number;
    perAgentBudget: number;
    globalBudget: number;
  },
): Promise<void> {
  runningId = requestId;
  clearRequestState(requestId);
  const coord = new WorkerCoordState();
  if (coordBootstrap) {
    coord.globalBudget = coordBootstrap.globalBudget;
  }
  activeCoord = coord;
  post({ type: "started", requestId });

  try {
    if (cancelled.has(requestId)) {
      post({ type: "cancelled", requestId });
      return;
    }

    const solve = await loadSolve();
    if (cancelled.has(requestId) || runningId !== requestId) {
      post({ type: "cancelled", requestId });
      return;
    }

    const isDead = () => cancelled.has(requestId) || runningId !== requestId;

    const options: SolveRuntimeOptions = {
      onProgress: (progress: SolverProgress) => {
        if (isDead()) return;
        try {
          post({ type: "progress", requestId, progress });
        } catch {
          // Progress clone failure must not abort the solve.
        }
      },
      isCancelled: isDead,
      isPaused: () => paused.has(requestId),
      yieldSlice: async () => {
        await waitWhilePaused(requestId);
        if (isDead()) {
          const err = new Error("solver cancelled");
          err.name = "AbortError";
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      coord,
    };

    const result: SolverResultDTO = await solve(payload, options);

    if (isDead()) {
      post({ type: "cancelled", requestId });
      return;
    }
    try {
      post({ type: "result", requestId, result });
    } catch (cloneErr) {
      post({
        type: "error",
        requestId,
        error:
          cloneErr instanceof Error
            ? `result post failed: ${cloneErr.message}`
            : "result post failed",
      });
    }
  } catch (err) {
    if (cancelled.has(requestId) || runningId !== requestId) {
      post({ type: "cancelled", requestId });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const aborted =
      (err instanceof Error && err.name === "AbortError") || message === "solver cancelled";
    if (aborted) {
      post({ type: "cancelled", requestId });
      return;
    }
    post({ type: "error", requestId, error: message });
  } finally {
    clearRequestState(requestId);
    if (runningId === requestId) {
      runningId = null;
      activeCoord = null;
    }
  }
}

self.onmessage = (event: MessageEvent<unknown>) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;
  const typed = msg as HostToWorkerMessage;
  if (typeof (typed as { requestId?: unknown }).requestId !== "number") return;

  switch (typed.type) {
    case "start":
      if (runningId !== null && runningId !== typed.requestId) {
        cancelled.add(runningId);
      }
      void runStart(typed.requestId, typed.payload, typed.coord);
      break;
    case "coord":
      if (runningId === typed.requestId && activeCoord) {
        try {
          activeCoord.applyHostBatch(typed.batch);
        } catch {
          // ignore bad batch
        }
      }
      break;
    case "cancel":
      cancelled.add(typed.requestId);
      paused.delete(typed.requestId);
      if (runningId !== typed.requestId) {
        clearRequestState(typed.requestId);
      }
      break;
    case "pause":
      if (runningId === typed.requestId) {
        paused.add(typed.requestId);
      }
      break;
    case "resume":
      paused.delete(typed.requestId);
      break;
  }
};
