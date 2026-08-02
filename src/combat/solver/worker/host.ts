import type { SerializableSolverRequest, SolverResultDTO } from "./serializable";
import {
  isWorkerToHostMessage,
  type HostToWorkerMessage,
  type WorkerToHostMessage,
} from "./protocol";
import type { SolveFn, SolveProgressHandler } from "./solveTypes";

export type { SolveFn, SolveProgressHandler, SolveRuntimeOptions } from "./solveTypes";

/**
 * Load the worker-facing entry. Pure search `solve(SolveInput)` is not the wire
 * API — look for `solveFromRequest` (or a same-shaped default) only.
 */
async function loadSolve(): Promise<SolveFn> {
  // Prefer the request-bound entry (avoids a solve ↔ solveFromRequest cycle).
  const mod = (await import(
    /* webpackMode: "lazy" */ "../solveFromRequest"
  )) as {
    solveFromRequest?: SolveFn;
    default?: SolveFn;
  };
  const fn = mod.solveFromRequest ?? mod.default;
  if (typeof fn !== "function") {
    throw new Error("revolution solver: solveFromRequest export missing");
  }
  return fn;
}

function createWorker(): Worker | null {
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./revolutionSolver.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}

function post(worker: Worker, message: HostToWorkerMessage): void {
  worker.postMessage(message);
}

/**
 * Main-thread fallback: run solve with cooperative yields so the UI can paint.
 * Used when Worker construction fails (SSR, test env, bundler quirks).
 */
export async function runSolverOnMainThread(
  request: SerializableSolverRequest,
  onProgress?: SolveProgressHandler,
  options?: { isCancelled?: () => boolean },
): Promise<SolverResultDTO> {
  const solve = await loadSolve();
  let cancelled = false;
  const isCancelled = () => cancelled || options?.isCancelled?.() === true;

  return solve(request, {
    onProgress,
    isCancelled,
    yieldSlice: () =>
      new Promise((resolve) => {
        setTimeout(resolve, 0);
      }),
  }).finally(() => {
    cancelled = true;
  });
}

/**
 * Prefer a dedicated Worker; fall back to async chunked main-thread solve when
 * Workers are unavailable.
 */
export async function runSolverInWorker(
  request: SerializableSolverRequest,
  onProgress?: SolveProgressHandler,
  options?: { signal?: AbortSignal },
): Promise<SolverResultDTO> {
  const worker = createWorker();
  if (!worker) {
    return runSolverOnMainThread(request, onProgress, {
      isCancelled: () => options?.signal?.aborted === true,
    });
  }

  const requestId = 1;
  return new Promise<SolverResultDTO>((resolve, reject) => {
    const onAbort = () => {
      post(worker, { type: "cancel", requestId });
    };
    options?.signal?.addEventListener("abort", onAbort, { once: true });

    const cleanup = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      worker.terminate();
    };

    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || "revolution solver worker failed"));
    };

    const onMessage = (event: MessageEvent<unknown>) => {
      if (!isWorkerToHostMessage(event.data)) return;
      const msg = event.data as WorkerToHostMessage;
      if (msg.requestId !== requestId) return;
      switch (msg.type) {
        case "progress":
          onProgress?.(msg.progress);
          break;
        case "result":
          cleanup();
          resolve(msg.result);
          break;
        case "error":
          cleanup();
          reject(new Error(msg.error));
          break;
        case "cancelled":
          cleanup();
          reject(new DOMException("revolution solver cancelled", "AbortError"));
          break;
      }
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    post(worker, { type: "start", requestId, payload: request });

    if (options?.signal?.aborted) onAbort();
  });
}

/**
 * Long-lived main-thread helper: one Worker, cancel/pause/resume, Promise API.
 */
export class RevolutionSolverClient {
  private worker: Worker | null = null;
  private seq = 0;
  private active:
    | {
        requestId: number;
        resolve: (result: SolverResultDTO) => void;
        reject: (error: Error) => void;
        onProgress?: SolveProgressHandler;
      }
    | null = null;

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    this.worker = createWorker();
    if (!this.worker) return null;
    this.worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      this.onWorkerMessage(event.data);
    });
    this.worker.addEventListener("error", (event: ErrorEvent) => {
      const active = this.active;
      this.active = null;
      active?.reject(new Error(event.message || "revolution solver worker failed"));
    });
    return this.worker;
  }

  private onWorkerMessage(data: unknown): void {
    if (!isWorkerToHostMessage(data)) return;
    const msg = data;
    const active = this.active;
    if (!active || msg.requestId !== active.requestId) return;
    switch (msg.type) {
      case "progress":
        active.onProgress?.(msg.progress);
        break;
      case "result":
        this.active = null;
        active.resolve(msg.result);
        break;
      case "error":
        this.active = null;
        active.reject(new Error(msg.error));
        break;
      case "cancelled":
        this.active = null;
        active.reject(new DOMException("revolution solver cancelled", "AbortError"));
        break;
    }
  }

  start(
    request: SerializableSolverRequest,
    onProgress?: SolveProgressHandler,
  ): Promise<SolverResultDTO> {
    this.cancel();
    const requestId = ++this.seq;
    const worker = this.ensureWorker();

    if (!worker) {
      return new Promise<SolverResultDTO>((resolve, reject) => {
        this.active = { requestId, resolve, reject, onProgress };
        void runSolverOnMainThread(request, onProgress, {
          isCancelled: () => this.active?.requestId !== requestId,
        })
          .then((result) => {
            if (this.active?.requestId !== requestId) return;
            this.active = null;
            resolve(result);
          })
          .catch((err: unknown) => {
            if (this.active?.requestId !== requestId) return;
            this.active = null;
            reject(err instanceof Error ? err : new Error(String(err)));
          });
      });
    }

    return new Promise<SolverResultDTO>((resolve, reject) => {
      this.active = { requestId, resolve, reject, onProgress };
      post(worker, { type: "start", requestId, payload: request });
    });
  }

  cancel(): void {
    const active = this.active;
    if (!active) return;
    if (this.worker) {
      post(this.worker, { type: "cancel", requestId: active.requestId });
    }
    this.active = null;
    active.reject(new DOMException("revolution solver cancelled", "AbortError"));
  }

  pause(): void {
    const active = this.active;
    if (!active || !this.worker) return;
    post(this.worker, { type: "pause", requestId: active.requestId });
  }

  resume(): void {
    const active = this.active;
    if (!active || !this.worker) return;
    post(this.worker, { type: "resume", requestId: active.requestId });
  }

  dispose(): void {
    this.cancel();
    this.worker?.terminate();
    this.worker = null;
  }
}
