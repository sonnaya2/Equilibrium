import type { SerializableSolverRequest, SolverResultDTO } from "./serializable";
import {
  isWorkerToHostMessage,
  type HostToWorkerMessage,
  type WorkerToHostMessage,
} from "./protocol";
import type { SolveFn, SolveProgressHandler } from "./solveTypes";

export type { SolveFn, SolveProgressHandler, SolveRuntimeOptions } from "./solveTypes";

/** After a hard worker failure, prefer main-thread for the rest of the tab session. */
let stickyMainThread = false;
let sharedClient: RevolutionSolverClient | null = null;

/**
 * Load the worker-facing entry. Pure search `solve(SolveInput)` is not the wire
 * API — look for `solveFromRequest` (or a same-shaped default) only.
 */
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

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && (err.name === "AbortError" || err.message === "solver cancelled"))
  );
}

export function isSolverPreferringMainThread(): boolean {
  return stickyMainThread;
}

/** Test / recovery hook. */
export function resetSolverHostForTests(): void {
  stickyMainThread = false;
  sharedClient?.dispose();
  sharedClient = null;
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
    // rAF + macrotask: let React commit and the browser paint between yields.
    yieldSlice: () =>
      new Promise((resolve) => {
        const done = () => setTimeout(resolve, 0);
        if (typeof requestAnimationFrame === "function") {
          requestAnimationFrame(done);
        } else {
          done();
        }
      }),
  }).finally(() => {
    cancelled = true;
  });
}

export type RunOptimizeOptions = {
  isCancelled?: () => boolean;
  signal?: AbortSignal;
  /** Force main-thread (tests / sticky recovery). */
  forceMainThread?: boolean;
};

/**
 * Product entry: dedicated Web Worker when available, cooperative main-thread
 * fallback otherwise. Sticky-falls-back for the tab after a hard worker death.
 */
export async function runOptimize(
  request: SerializableSolverRequest,
  onProgress?: SolveProgressHandler,
  options?: RunOptimizeOptions,
): Promise<SolverResultDTO> {
  const cancelled = () => options?.isCancelled?.() === true || options?.signal?.aborted === true;

  if (cancelled()) {
    throw new DOMException("revolution solver cancelled", "AbortError");
  }

  const forceMain =
    options?.forceMainThread === true || stickyMainThread || typeof Worker === "undefined";

  if (forceMain) {
    return runSolverOnMainThread(request, onProgress, { isCancelled: cancelled });
  }

  const client = getRevolutionSolverClient();
  try {
    return await client.start(request, onProgress, {
      isCancelled: cancelled,
      signal: options?.signal,
    });
  } catch (err) {
    if (isAbortError(err) || cancelled()) throw err;
    // Construct or runtime failure — leave the UI path alive on main thread.
    stickyMainThread = true;
    if (typeof console !== "undefined") {
      console.warn("[revo-solver] worker unavailable, main-thread fallback", err);
    }
    client.dispose();
    if (sharedClient === client) sharedClient = null;
    if (cancelled()) throw err;
    return runSolverOnMainThread(request, onProgress, { isCancelled: cancelled });
  }
}

/** Cancel the in-flight optimize (worker or main-thread shared client). */
export function cancelOptimize(): void {
  sharedClient?.cancel();
}

export function getRevolutionSolverClient(): RevolutionSolverClient {
  if (!sharedClient) sharedClient = new RevolutionSolverClient();
  return sharedClient;
}

/**
 * Prefer a dedicated Worker; fall back to async chunked main-thread solve when
 * Workers are unavailable. Terminates the worker after each run (cold start).
 * Prefer {@link runOptimize} / {@link RevolutionSolverClient} for UI.
 */
export async function runSolverInWorker(
  request: SerializableSolverRequest,
  onProgress?: SolveProgressHandler,
  options?: { signal?: AbortSignal; isCancelled?: () => boolean },
): Promise<SolverResultDTO> {
  const cancelled = () => options?.isCancelled?.() === true || options?.signal?.aborted === true;

  if (stickyMainThread || typeof Worker === "undefined") {
    return runSolverOnMainThread(request, onProgress, { isCancelled: cancelled });
  }

  const worker = createWorker();
  if (!worker) {
    stickyMainThread = true;
    return runSolverOnMainThread(request, onProgress, { isCancelled: cancelled });
  }

  const requestId = 1;
  return new Promise<SolverResultDTO>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

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

    const fallbackMain = () => {
      cleanup();
      stickyMainThread = true;
      if (typeof console !== "undefined") {
        console.warn("[revo-solver] one-shot worker failed, main-thread fallback");
      }
      if (cancelled()) {
        settle(() => reject(new DOMException("revolution solver cancelled", "AbortError")));
        return;
      }
      void runSolverOnMainThread(request, onProgress, { isCancelled: cancelled }).then(
        (result) => settle(() => resolve(result)),
        (err: unknown) => settle(() => reject(err instanceof Error ? err : new Error(String(err)))),
      );
    };

    const onError = () => {
      fallbackMain();
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
          settle(() => {
            cleanup();
            resolve(msg.result);
          });
          break;
        case "error":
          // Load/runtime failure → main-thread retry once.
          fallbackMain();
          break;
        case "cancelled":
          settle(() => {
            cleanup();
            reject(new DOMException("revolution solver cancelled", "AbortError"));
          });
          break;
      }
    };

    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    try {
      post(worker, { type: "start", requestId, payload: request });
    } catch {
      fallbackMain();
      return;
    }

    if (options?.signal?.aborted || cancelled()) onAbort();
  });
}

/**
 * Long-lived host helper: one Worker, cancel/pause/resume, Promise API.
 * Keeps the combat bundle warm across Optimize clicks.
 */
export class RevolutionSolverClient {
  private worker: Worker | null = null;
  private seq = 0;
  private active: {
    requestId: number;
    resolve: (result: SolverResultDTO) => void;
    reject: (error: Error) => void;
    onProgress?: SolveProgressHandler;
    isCancelled?: () => boolean;
  } | null = null;

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    this.worker = createWorker();
    if (!this.worker) return null;
    this.worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      this.onWorkerMessage(event.data);
    });
    this.worker.addEventListener("error", (event: ErrorEvent) => {
      this.onWorkerFailed(event.message || "revolution solver worker failed");
    });
    return this.worker;
  }

  private onWorkerFailed(message: string): void {
    const active = this.active;
    this.dropWorker();
    this.active = null;
    active?.reject(new Error(message));
  }

  private dropWorker(): void {
    try {
      this.worker?.terminate();
    } catch {
      // ignore
    }
    this.worker = null;
  }

  private onWorkerMessage(data: unknown): void {
    if (!isWorkerToHostMessage(data)) return;
    const msg = data;
    const active = this.active;
    if (!active || msg.requestId !== active.requestId) return;
    switch (msg.type) {
      case "progress":
        if (active.isCancelled?.()) return;
        active.onProgress?.(msg.progress);
        break;
      case "result":
        this.active = null;
        active.resolve(msg.result);
        break;
      case "error":
        this.active = null;
        // Kill the worker so the next start reconstructs cleanly.
        this.dropWorker();
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
    options?: { isCancelled?: () => boolean; signal?: AbortSignal },
  ): Promise<SolverResultDTO> {
    this.cancel();
    const requestId = ++this.seq;
    const cancelled = () => options?.isCancelled?.() === true || options?.signal?.aborted === true;

    if (cancelled()) {
      return Promise.reject(new DOMException("revolution solver cancelled", "AbortError"));
    }

    const worker = stickyMainThread ? null : this.ensureWorker();

    if (!worker) {
      return new Promise<SolverResultDTO>((resolve, reject) => {
        this.active = { requestId, resolve, reject, onProgress, isCancelled: cancelled };
        const onAbort = () => {
          if (this.active?.requestId !== requestId) return;
          this.active = null;
          reject(new DOMException("revolution solver cancelled", "AbortError"));
        };
        options?.signal?.addEventListener("abort", onAbort, { once: true });
        void runSolverOnMainThread(request, onProgress, {
          isCancelled: () => cancelled() || this.active?.requestId !== requestId,
        })
          .then((result) => {
            options?.signal?.removeEventListener("abort", onAbort);
            if (this.active?.requestId !== requestId) return;
            this.active = null;
            resolve(result);
          })
          .catch((err: unknown) => {
            options?.signal?.removeEventListener("abort", onAbort);
            if (this.active?.requestId !== requestId) return;
            this.active = null;
            reject(err instanceof Error ? err : new Error(String(err)));
          });
      });
    }

    return new Promise<SolverResultDTO>((resolve, reject) => {
      this.active = { requestId, resolve, reject, onProgress, isCancelled: cancelled };
      const onAbort = () => {
        if (this.active?.requestId !== requestId) return;
        post(worker, { type: "cancel", requestId });
      };
      options?.signal?.addEventListener("abort", onAbort, { once: true });

      // Wrap settle so abort listener is cleared.
      const prevResolve = resolve;
      const prevReject = reject;
      this.active.resolve = (result) => {
        options?.signal?.removeEventListener("abort", onAbort);
        prevResolve(result);
      };
      this.active.reject = (error) => {
        options?.signal?.removeEventListener("abort", onAbort);
        prevReject(error);
      };

      try {
        post(worker, { type: "start", requestId, payload: request });
      } catch (err) {
        this.active = null;
        options?.signal?.removeEventListener("abort", onAbort);
        this.dropWorker();
        reject(err instanceof Error ? err : new Error(String(err)));
      }

      if (cancelled()) onAbort();
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
    this.dropWorker();
  }
}
