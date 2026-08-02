import {
  isSerializableSimBase,
  type SerializableSolverRequest,
  type SolverResultDTO,
} from "./serializable";
import {
  isWorkerToHostMessage,
  type HostToWorkerMessage,
  type WorkerToHostMessage,
} from "./protocol";
import type { SolveFn, SolveProgressHandler } from "./solveTypes";
import {
  cancelSolverAgentPool,
  disposeSolverAgentPool,
  getSolverAgentPool,
  resetSolverAgentPoolForTests,
  solverPoolSize,
} from "./pool";
import {
  canCreateSolverWorker,
  createSolverWorker,
  getFirstAckMs,
  resetWorkerCreateForTests,
} from "./workerCreate";

export type { SolveFn, SolveProgressHandler, SolveRuntimeOptions } from "./solveTypes";
export { solverPoolSize } from "./pool";
export {
  setWorkerFactoryForTests,
  setWorkerHostTimeoutsForTests,
} from "./workerCreate";

/** After a hard worker failure, prefer main-thread for the rest of the tab session. */
let stickyMainThread = false;
let sharedClient: RevolutionSolverClient | null = null;

/**
 * Product-level run token shared by pool, single worker, sticky/forced main, and fallback.
 * cancelOptimize always flips this so no path needs a separate AbortController.
 */
let productRun: ProductRunToken | null = null;

type ProductRunToken = { cancelled: boolean };

async function loadSolve(): Promise<SolveFn> {
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
  return createSolverWorker();
}

function post(worker: Worker, message: HostToWorkerMessage): void {
  worker.postMessage(message);
}

/** True AbortError only — bare Error("solver cancelled") is not intentional user cancel. */
function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

function abortError(message = "revolution solver cancelled"): DOMException {
  return new DOMException(message, "AbortError");
}

export function isSolverPreferringMainThread(): boolean {
  return stickyMainThread;
}

/** Test / recovery hook — not part of the product combat barrel. */
export function resetSolverHostForTests(): void {
  stickyMainThread = false;
  if (productRun) productRun.cancelled = true;
  productRun = null;
  // disposeQuiet settles active without requiring callers to have attached handlers yet.
  try {
    sharedClient?.disposeQuiet();
  } catch {
    // ignore
  }
  sharedClient = null;
  resetSolverAgentPoolForTests();
  resetWorkerCreateForTests();
}

/**
 * Main-thread solve with cooperative yields so the UI can paint.
 * Checks cancellation on every yieldSlice so cancelOptimize stays responsive.
 */
export async function runSolverOnMainThread(
  request: SerializableSolverRequest,
  onProgress?: SolveProgressHandler,
  options?: { isCancelled?: () => boolean },
): Promise<SolverResultDTO> {
  const solve = await loadSolve();
  let finished = false;
  const isCancelled = () => finished || options?.isCancelled?.() === true;

  try {
    if (isCancelled()) throw abortError();
    return await solve(request, {
      onProgress,
      isCancelled,
      isPaused: () => false,
      // Yield only for paint; cancellation is observed via isCancelled after each yield
      // so abandoned yield promises never reject unhandled.
      yieldSlice: () =>
        new Promise((resolve) => {
          if (finished) {
            resolve();
            return;
          }
          const done = () => resolve();
          if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(() => setTimeout(done, 0));
          } else {
            setTimeout(done, 0);
          }
        }),
    });
  } finally {
    finished = true;
  }
}

export type RunOptimizeOptions = {
  isCancelled?: () => boolean;
  signal?: AbortSignal;
  forceMainThread?: boolean;
  /** Override parallel agent count (tiers: 6 / 12 / 18). */
  agents?: number;
};

export type PauseResumeResult =
  | { ok: true }
  | { ok: false; reason: "no-active-run" | "main-thread" | "worker-unavailable" };

/**
 * Product entry: parallel worker agents when possible; sticky main fallback after
 * infrastructure failure. Cancellation is always via {@link cancelOptimize}
 * (or options.isCancelled / signal) — one path for every mode.
 */
export async function runOptimize(
  request: SerializableSolverRequest,
  onProgress?: SolveProgressHandler,
  options?: RunOptimizeOptions,
): Promise<SolverResultDTO> {
  // Supersede any prior product run (pool, worker, or main).
  cancelOptimize();

  const token: ProductRunToken = { cancelled: false };
  productRun = token;

  const cancelled = () =>
    token.cancelled ||
    options?.isCancelled?.() === true ||
    options?.signal?.aborted === true;

  const onAbort = () => {
    token.cancelled = true;
    cancelSolverAgentPool();
    sharedClient?.cancel();
  };
  options?.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    if (cancelled()) throw abortError();

    if (!isSerializableSimBase(request.loadout)) {
      // Shape limitation for this request only — not a worker infrastructure failure.
      return await runTrackedMain(request, onProgress, cancelled);
    }

    let payload: SerializableSolverRequest;
    try {
      payload = structuredClone(request);
    } catch (err) {
      // This request is not cloneable; next cloneable request may still use workers.
      if (typeof console !== "undefined") {
        console.warn("[revo-solver] request not cloneable, main-thread only", err);
      }
      return await runTrackedMain(request, onProgress, cancelled);
    }

    const forceMain =
      options?.forceMainThread === true ||
      stickyMainThread ||
      !canCreateSolverWorker();

    if (forceMain) {
      return await runTrackedMain(payload, onProgress, cancelled);
    }

    // Parallel agent pool (product path)
    try {
      const pool = getSolverAgentPool();
      const agents = options?.agents ?? solverPoolSize();
      if (typeof console !== "undefined" && agents > 1) {
        console.warn(`[revo-solver] launching ${agents} parallel agents`);
      }
      return await pool.run(payload, onProgress, {
        isCancelled: cancelled,
        signal: options?.signal,
        agents,
      });
    } catch (err) {
      if (cancelled() || isAbortError(err)) {
        throw isAbortError(err) ? err : abortError();
      }
      if (typeof console !== "undefined") {
        console.warn("[revo-solver] agent pool failed, trying single worker", err);
      }
    }

    if (cancelled()) throw abortError();

    // Single-worker fallback — terminate pool agents first so work does not overlap.
    const client = getRevolutionSolverClient();
    try {
      disposeSolverAgentPool();
      return await client.start(payload, onProgress, {
        isCancelled: cancelled,
        signal: options?.signal,
        preferWorker: true,
      });
    } catch (err2) {
      if (cancelled() || isAbortError(err2)) {
        throw isAbortError(err2) ? err2 : abortError();
      }
      stickyMainThread = true;
      if (typeof console !== "undefined") {
        console.warn("[revo-solver] worker unavailable, main-thread fallback", err2);
      }
      try {
        client.disposeQuiet();
      } catch {
        // ignore
      }
      if (sharedClient === client) sharedClient = null;
      if (cancelled()) throw abortError();
      return await runTrackedMain(payload, onProgress, cancelled);
    }
  } finally {
    options?.signal?.removeEventListener("abort", onAbort);
    if (productRun === token) productRun = null;
  }
}

/**
 * Cancel every execution mode: agent pool, single worker, direct/sticky/forced
 * main, fallback, and any superseded previous run.
 *
 * Soft cancel messages alone cannot interrupt a sync full-horizon simulation on
 * a worker — so product cancel also **terminates** pool/single workers. The next
 * optimize recreates them. Main-thread runs still rely on cooperative isCancelled
 * between candidates (and after the current sim finishes).
 */
export function cancelOptimize(): void {
  if (productRun) productRun.cancelled = true;
  // Soft cancel first so awaiters settle as AbortError, then hard-kill workers
  // so a long finalize sim cannot keep burning CPU after the user hit Cancel.
  cancelSolverAgentPool();
  sharedClient?.cancel();
  disposeSolverAgentPool();
  try {
    sharedClient?.disposeQuiet();
  } catch {
    // ignore
  }
  sharedClient = null;
}

export function getRevolutionSolverClient(): RevolutionSolverClient {
  if (!sharedClient) sharedClient = new RevolutionSolverClient();
  return sharedClient;
}

/** Main path always registered on the shared client so cancelOptimize can abort it. */
async function runTrackedMain(
  request: SerializableSolverRequest,
  onProgress: SolveProgressHandler | undefined,
  isCancelled: () => boolean,
): Promise<SolverResultDTO> {
  const client = getRevolutionSolverClient();
  return client.start(request, onProgress, {
    isCancelled,
    forceMainThread: true,
  });
}

type ActiveRun = {
  requestId: number;
  resolve: (result: SolverResultDTO) => void;
  reject: (error: Error) => void;
  onProgress?: SolveProgressHandler;
  /** Explicit abort — never infer cancel from active===null. */
  aborted: boolean;
  settled: boolean;
  mode: "worker" | "main";
  acknowledged: boolean;
  bootTimer?: ReturnType<typeof setTimeout>;
};

/**
 * Long-lived host: one Worker, cancel/pause/resume, main-thread tracking.
 * Settle-once: every resolve/reject goes through settleActive.
 */
export class RevolutionSolverClient {
  private worker: Worker | null = null;
  private seq = 0;
  private active: ActiveRun | null = null;
  private readonly boundMessage = (event: MessageEvent<unknown>) => {
    this.onWorkerMessage(event.data);
  };
  private readonly boundError = (event: ErrorEvent) => {
    this.failActive(new Error(event.message || "revolution solver worker failed"));
    this.dropWorker();
  };
  private readonly boundMessageError = () => {
    this.failActive(new Error("revolution solver worker messageerror (clone failed)"));
    this.dropWorker();
  };

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    this.worker = createWorker();
    if (!this.worker) return null;
    this.worker.addEventListener("message", this.boundMessage);
    this.worker.addEventListener("error", this.boundError);
    this.worker.addEventListener("messageerror", this.boundMessageError);
    return this.worker;
  }

  private settleActive(
    run: ActiveRun,
    kind: "resolve" | "reject",
    value: SolverResultDTO | Error,
  ): void {
    if (run.settled) return;
    run.settled = true;
    if (run.bootTimer != null) {
      clearTimeout(run.bootTimer);
      run.bootTimer = undefined;
    }
    if (this.active === run) this.active = null;
    // Defer settle so supersede/cancel never races the caller's .then/.catch attach.
    queueMicrotask(() => {
      if (kind === "resolve") run.resolve(value as SolverResultDTO);
      else run.reject(value as Error);
    });
  }

  private failActive(error: Error): void {
    const run = this.active;
    if (!run) return;
    this.settleActive(run, "reject", error);
  }

  private dropWorker(): void {
    if (!this.worker) return;
    try {
      this.worker.removeEventListener("message", this.boundMessage);
      this.worker.removeEventListener("error", this.boundError);
      this.worker.removeEventListener("messageerror", this.boundMessageError);
    } catch {
      // ignore
    }
    try {
      this.worker.terminate();
    } catch {
      // ignore
    }
    this.worker = null;
  }

  private onWorkerMessage(data: unknown): void {
    if (!isWorkerToHostMessage(data)) {
      // Malformed protocol must not kill a healthy solve.
      if (typeof console !== "undefined" && this.active) {
        console.warn("[revo-solver] ignored non-protocol worker message", data);
      }
      return;
    }
    const msg: WorkerToHostMessage = data;
    const run = this.active;
    if (!run) return;
    // Wrong request id cannot resolve the active run.
    if (msg.requestId !== run.requestId) return;

    if (run.bootTimer != null) {
      clearTimeout(run.bootTimer);
      run.bootTimer = undefined;
    }

    switch (msg.type) {
      case "started":
        run.acknowledged = true;
        break;
      case "progress":
        if (run.aborted) return;
        try {
          run.onProgress?.(msg.progress);
        } catch {
          // Progress callback exceptions must not kill the worker or the solve.
        }
        break;
      case "result":
        this.settleActive(run, "resolve", msg.result);
        break;
      case "error":
        this.dropWorker();
        this.settleActive(run, "reject", new Error(msg.error));
        break;
      case "cancelled":
        this.settleActive(run, "reject", abortError());
        break;
    }
  }

  start(
    request: SerializableSolverRequest,
    onProgress?: SolveProgressHandler,
    options?: {
      isCancelled?: () => boolean;
      signal?: AbortSignal;
      forceMainThread?: boolean;
      preferWorker?: boolean;
    },
  ): Promise<SolverResultDTO> {
    // Soft-cancel previous run; previous awaiter rejects exactly once via settleActive.
    this.cancelQuiet();

    const requestId = ++this.seq;
    const externalCancelled = () =>
      options?.isCancelled?.() === true || options?.signal?.aborted === true;

    if (externalCancelled()) {
      return Promise.reject(abortError());
    }

    const useMain = options?.forceMainThread === true || stickyMainThread;

    if (!useMain) {
      const worker = this.ensureWorker();
      if (worker) {
        return this.startOnWorker(worker, requestId, request, onProgress, options, externalCancelled);
      }
      if (options?.preferWorker) {
        return Promise.reject(new Error("revolution solver worker unavailable"));
      }
      // No Worker global and no test factory — fall through to main.
    }

    return this.startOnMain(requestId, request, onProgress, options, externalCancelled);
  }

  private startOnMain(
    requestId: number,
    request: SerializableSolverRequest,
    onProgress: SolveProgressHandler | undefined,
    options: { signal?: AbortSignal } | undefined,
    externalCancelled: () => boolean,
  ): Promise<SolverResultDTO> {
    return new Promise<SolverResultDTO>((resolve, reject) => {
      const run: ActiveRun = {
        requestId,
        resolve,
        reject,
        onProgress,
        aborted: false,
        settled: false,
        mode: "main",
        acknowledged: true,
      };
      this.active = run;

      const onAbort = () => {
        run.aborted = true;
        this.settleActive(run, "reject", abortError());
      };
      options?.signal?.addEventListener("abort", onAbort, { once: true });

      const rawResolve = run.resolve;
      const rawReject = run.reject;
      run.resolve = (result) => {
        options?.signal?.removeEventListener("abort", onAbort);
        rawResolve(result);
      };
      run.reject = (error) => {
        options?.signal?.removeEventListener("abort", onAbort);
        rawReject(error);
      };

      void runSolverOnMainThread(request, onProgress, {
        isCancelled: () => run.aborted || externalCancelled(),
      })
        .then((result) => {
          if (run.aborted || externalCancelled()) {
            this.settleActive(run, "reject", abortError());
            return;
          }
          this.settleActive(run, "resolve", result);
        })
        .catch((err: unknown) => {
          if (run.settled) return;
          if (run.aborted || externalCancelled() || isAbortError(err)) {
            this.settleActive(run, "reject", abortError());
            return;
          }
          this.settleActive(
            run,
            "reject",
            err instanceof Error ? err : new Error(String(err)),
          );
        });
    });
  }

  private startOnWorker(
    worker: Worker,
    requestId: number,
    request: SerializableSolverRequest,
    onProgress: SolveProgressHandler | undefined,
    options: { signal?: AbortSignal } | undefined,
    externalCancelled: () => boolean,
  ): Promise<SolverResultDTO> {
    return new Promise<SolverResultDTO>((resolve, reject) => {
      const run: ActiveRun = {
        requestId,
        resolve,
        reject,
        onProgress,
        aborted: false,
        settled: false,
        mode: "worker",
        acknowledged: false,
      };
      this.active = run;

      const onAbort = () => {
        run.aborted = true;
        try {
          post(worker, { type: "cancel", requestId });
        } catch {
          // ignore
        }
        this.settleActive(run, "reject", abortError());
      };
      options?.signal?.addEventListener("abort", onAbort, { once: true });

      const rawResolve = run.resolve;
      const rawReject = run.reject;
      run.resolve = (result) => {
        options?.signal?.removeEventListener("abort", onAbort);
        rawResolve(result);
      };
      run.reject = (error) => {
        options?.signal?.removeEventListener("abort", onAbort);
        rawReject(error);
      };

      // ACK watchdog only — slow import after started must not trigger fallback.
      const ackMs = getFirstAckMs();
      run.bootTimer = setTimeout(() => {
        if (run.settled || run.acknowledged) return;
        this.dropWorker();
        this.settleActive(
          run,
          "reject",
          new Error(
            `revolution solver worker did not acknowledge start within ${ackMs}ms`,
          ),
        );
      }, ackMs);

      try {
        post(worker, { type: "start", requestId, payload: request });
      } catch (err) {
        this.dropWorker();
        this.settleActive(
          run,
          "reject",
          err instanceof Error ? err : new Error(String(err)),
        );
        return;
      }

      if (externalCancelled()) onAbort();
    });
  }

  /** Reject active run as cancelled (user Cancel / product cancelOptimize). */
  cancel(): void {
    const run = this.active;
    if (!run || run.settled) return;
    run.aborted = true;
    if (run.mode === "worker" && this.worker) {
      try {
        post(this.worker, { type: "cancel", requestId: run.requestId });
      } catch {
        // ignore
      }
    }
    this.settleActive(run, "reject", abortError());
  }

  /** Cancel previous run when superseding; settles the old awaiter once. */
  cancelQuiet(): void {
    const run = this.active;
    if (!run || run.settled) {
      this.active = null;
      return;
    }
    run.aborted = true;
    if (run.mode === "worker" && this.worker) {
      try {
        post(this.worker, { type: "cancel", requestId: run.requestId });
      } catch {
        // ignore
      }
    }
    this.settleActive(run, "reject", abortError());
  }

  disposeQuiet(): void {
    const run = this.active;
    if (run && !run.settled) {
      run.aborted = true;
      this.settleActive(run, "reject", abortError());
    }
    this.active = null;
    this.dropWorker();
  }

  /**
   * Pause the active worker solve. Main-thread runs report unavailable rather
   * than silently ignoring the call.
   */
  pause(): PauseResumeResult {
    const run = this.active;
    if (!run || run.settled) return { ok: false, reason: "no-active-run" };
    if (run.mode === "main") return { ok: false, reason: "main-thread" };
    if (!this.worker) return { ok: false, reason: "worker-unavailable" };
    try {
      post(this.worker, { type: "pause", requestId: run.requestId });
      return { ok: true };
    } catch {
      return { ok: false, reason: "worker-unavailable" };
    }
  }

  resume(): PauseResumeResult {
    const run = this.active;
    if (!run || run.settled) return { ok: false, reason: "no-active-run" };
    if (run.mode === "main") return { ok: false, reason: "main-thread" };
    if (!this.worker) return { ok: false, reason: "worker-unavailable" };
    try {
      post(this.worker, { type: "resume", requestId: run.requestId });
      return { ok: true };
    } catch {
      return { ok: false, reason: "worker-unavailable" };
    }
  }

  dispose(): void {
    this.disposeQuiet();
    if (sharedClient === this) sharedClient = null;
  }
}
