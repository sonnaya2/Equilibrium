import {
  resolveAbilityCatalogue,
  resolveAbilitySpecsFromCatalogue,
} from "../../abilities/catalogue";
import type { RevolutionInput } from "../../engine/simulation/revolution";
import { simulateRevolutionForUi, type UiRunResult } from "../uiRunCore";
import {
  isWorkerToHostMessage,
  type HostToWorkerMessage,
  type WorkerToHostMessage,
} from "./protocol";
import { buildRevolutionInput, requireSimBase } from "./revive";
import type { SerializableUiRunRequest } from "./uiRunTypes";
import { canCreateSolverWorker, createSolverWorker } from "./workerCreate";

export type UiRunProgress = {
  phase: "full";
  done: number;
  total: number;
};

export type UiRunHostOptions = {
  isCancelled?: () => boolean;
  onProgress?: (progress: UiRunProgress) => void;
  forceMainThread?: boolean;
};

let nextRequestId = 1;
const activeWorkerCancels = new Map<Worker, () => void>();

function throwIfCancelled(isCancelled?: () => boolean): void {
  if (!isCancelled?.()) return;
  const error = new Error("ui run cancelled");
  error.name = "AbortError";
  throw error;
}

function buildInput(request: SerializableUiRunRequest): RevolutionInput {
  const sim = requireSimBase(request.loadout);
  const catalogue = resolveAbilityCatalogue({ strengthCape99: sim.strengthCape99 === true });
  const bar = resolveAbilitySpecsFromCatalogue(catalogue, request.barIds);
  return buildRevolutionInput(sim, {
    bar,
    style: request.style,
    durationTicks: request.durationTicks,
    abilities: catalogue.catalogue,
  });
}

function post(worker: Worker, message: HostToWorkerMessage): void {
  worker.postMessage(message);
}

function waitForUiRun(
  worker: Worker,
  requestId: number,
  payload: SerializableUiRunRequest,
  isCancelled?: () => boolean,
): Promise<UiRunResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cancelPoll = setInterval(() => {
      if (!isCancelled?.()) return;
      post(worker, { type: "cancel", requestId });
    }, 50);
    const cleanup = () => {
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      clearInterval(cancelPoll);
      activeWorkerCancels.delete(worker);
      worker.terminate();
    };
    const abort = () => {
      if (settled) return;
      settled = true;
      cleanup();
      const error = new Error("ui run cancelled");
      error.name = "AbortError";
      reject(error);
    };
    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isWorkerToHostMessage(event.data)) return;
      const message = event.data as WorkerToHostMessage;
      if (message.requestId !== requestId || message.type === "started") return;
      if (message.type === "ui_run_result") {
        settled = true;
        cleanup();
        resolve(message.result);
        return;
      }
      if (message.type === "error") {
        settled = true;
        cleanup();
        reject(new Error(message.error));
        return;
      }
      if (message.type === "cancelled") abort();
    };
    const onError = (event: ErrorEvent) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(event.message || "ui run worker error"));
    };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    activeWorkerCancels.set(worker, abort);
    post(worker, { type: "ui_run", requestId, payload });
  });
}

export async function runUiRevolution(
  request: SerializableUiRunRequest,
  options?: UiRunHostOptions,
): Promise<UiRunResult> {
  throwIfCancelled(options?.isCancelled);
  options?.onProgress?.({ phase: "full", done: 0, total: 1 });

  if (options?.forceMainThread === true) {
    const result = simulateRevolutionForUi(buildInput(request));
    throwIfCancelled(options.isCancelled);
    options.onProgress?.({ phase: "full", done: 1, total: 1 });
    return result;
  }
  if (!canCreateSolverWorker()) {
    throw new Error("Revolution analysis workers are unavailable in this browser");
  }
  const worker = createSolverWorker();
  if (!worker) throw new Error("Revolution analysis worker could not be started");
  const result = await waitForUiRun(worker, nextRequestId++, request, options?.isCancelled);
  options?.onProgress?.({ phase: "full", done: 1, total: 1 });
  return result;
}

export function cancelUiRevolutionWorkers(): void {
  for (const cancel of [...activeWorkerCancels.values()]) cancel();
}

export function resetUiRunHostForTests(): void {
  cancelUiRevolutionWorkers();
  nextRequestId = 1;
}
