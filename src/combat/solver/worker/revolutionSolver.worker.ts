/// <reference lib="webworker" />

import type { SerializableSolverRequest } from "./serializable";
import type { HostToWorkerMessage, SolverProgress, WorkerToHostMessage } from "./protocol";
import { WorkerCoordState } from "./coord";
import { executeWorkerSolve } from "./workerExecution";
import { SolverExecutionError } from "./failure";

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

async function waitWhilePaused(requestId: number): Promise<void> {
  while (paused.has(requestId) && !cancelled.has(requestId)) {
    await new Promise((resolve) => setTimeout(resolve, 16));
  }
}

async function runUiJob(
  requestId: number,
  payload: import("./uiRunTypes").SerializableUiRunRequest,
): Promise<void> {
  runningId = requestId;
  clearRequestState(requestId);
  activeCoord = null;
  post({ type: "started", requestId });

  try {
    if (cancelled.has(requestId)) {
      post({ type: "cancelled", requestId });
      return;
    }

    const { requireSimBase, buildRevolutionInput } = await import("./revive");
    const { resolveAbilityCatalogue, resolveAbilitySpecsFromCatalogue } =
      await import("../../abilities/catalogue");
    const { simulateUiRunProbe, simulateUiRunFullAnalysis } = await import("../uiRunCore");
    const { UI_RUN_BRANCH_FIDELITY_LADDER } = await import("../branchFidelity");

    if (cancelled.has(requestId) || runningId !== requestId) {
      post({ type: "cancelled", requestId });
      return;
    }

    const sim = requireSimBase(payload.loadout);
    const cat = resolveAbilityCatalogue({
      strengthCape99: sim.strengthCape99 === true,
    });
    let bar;
    try {
      bar = resolveAbilitySpecsFromCatalogue(cat, payload.barIds);
    } catch (e) {
      post({
        type: "error",
        requestId,
        error: e instanceof Error ? e.message : "ui_run: bar resolve failed",
      });
      return;
    }
    const input = buildRevolutionInput(sim, {
      bar,
      style: payload.style,
      durationTicks: payload.durationTicks,
      abilities: cat.catalogue,
    });

    const live =
      payload.maxLiveBranches ??
      UI_RUN_BRANCH_FIDELITY_LADDER.liveCaps[UI_RUN_BRANCH_FIDELITY_LADDER.liveCaps.length - 1]!;

    if (payload.fullAnalysis) {
      const { summary, meta } = simulateUiRunFullAnalysis(
        input,
        live,
        UI_RUN_BRANCH_FIDELITY_LADDER,
      );
      if (cancelled.has(requestId) || runningId !== requestId) {
        post({ type: "cancelled", requestId });
        return;
      }
      const { toSerializableUiRunSummary } = await import("./uiRunTypes");
      post({
        type: "ui_run_result",
        requestId,
        result: { kind: "full", summary: toSerializableUiRunSummary(summary), meta },
      });
      return;
    }

    const probe = simulateUiRunProbe(input, live, UI_RUN_BRANCH_FIDELITY_LADDER);
    if (cancelled.has(requestId) || runningId !== requestId) {
      post({ type: "cancelled", requestId });
      return;
    }
    post({
      type: "ui_run_result",
      requestId,
      result: { kind: "probe", probe },
    });
  } catch (err) {
    if (cancelled.has(requestId) || runningId !== requestId) {
      post({ type: "cancelled", requestId });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    post({ type: "error", requestId, error: message });
  } finally {
    clearRequestState(requestId);
    if (runningId === requestId) {
      runningId = null;
    }
  }
}

async function runStart(
  requestId: number,
  payload: SerializableSolverRequest,
  profileEnabled?: boolean,
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

    if (cancelled.has(requestId) || runningId !== requestId) {
      post({ type: "cancelled", requestId });
      return;
    }

    const isDead = () => cancelled.has(requestId) || runningId !== requestId;

    const execution = await executeWorkerSolve(payload, {
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
      profile: profileEnabled === true,
    });

    if (isDead()) {
      post({ type: "cancelled", requestId });
      return;
    }
    try {
      post({
        type: "result",
        requestId,
        result: execution.result,
        ...(execution.profile ? { profile: execution.profile } : {}),
      });
    } catch (cloneErr) {
      post({
        type: "error",
        requestId,
        failureKind: "infrastructure",
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
    post({
      type: "error",
      requestId,
      error: message,
      failureKind: err instanceof SolverExecutionError ? err.failureKind : "domain",
    });
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
      void runStart(typed.requestId, typed.payload, typed.profile, typed.coord);
      break;
    case "ui_run":
      if (runningId !== null && runningId !== typed.requestId) {
        cancelled.add(runningId);
      }
      void runUiJob(typed.requestId, typed.payload);
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
