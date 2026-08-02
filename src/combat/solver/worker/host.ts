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
  getSolverAgentPool,
  resetSolverAgentPoolForTests,
  solverPoolSize,
} from "./pool";

export type { SolveFn, SolveProgressHandler, SolveRuntimeOptions } from "./solveTypes";
export { solverPoolSize } from "./pool";

/** After a hard worker failure, prefer main-thread for the rest of the tab session. */
let stickyMainThread = false;
let sharedClient: RevolutionSolverClient | null = null;

/** No progress/result/error within this window → treat worker as dead. */
const WORKER_FIRST_MESSAGE_MS = 12_000;

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

/** True AbortError only — do NOT match bare Error("solver cancelled") or we skip main fallback. */
function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
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
  resetSolverAgentPoolForTests();
}

/**
 * Main-thread solve with cooperative yields so the UI can paint.
 */
export async function runSolverOnMainThread(
  request: SerializableSolverRequest,
  onProgress?: SolveProgressHandler,
  options?: { isCancelled?: () => boolean },
): Promise<SolverResultDTO> {
  const solve = await loadSolve();
  let cancelled = false;
  const isCancelled = () => cancelled || options?.isCancelled?.() === true;

  try {
    return await solve(request, {
      onProgress,
      isCancelled,
      yieldSlice: () =>
        new Promise((resolve) => {
          const done = () => setTimeout(resolve, 0);
          if (typeof requestAnimationFrame === "function") {
            requestAnimationFrame(done);
          } else {
            done();
          }
        }),
    });
  } finally {
    cancelled = true;
  }
}

export type RunOptimizeOptions = {
  isCancelled?: () => boolean;
  signal?: AbortSignal;
  forceMainThread?: boolean;
  /** Override parallel agent count (default: hardware-derived, max 4). */
  agents?: number;
};

/**
 * Product entry: parallel Web Worker agents (different seeds) when possible;
 * sticky main-thread cooperative solve if workers cannot run.
 */
export async function runOptimize(
  request: SerializableSolverRequest,
  onProgress?: SolveProgressHandler,
  options?: RunOptimizeOptions,
): Promise<SolverResultDTO> {
  const cancelled = () =>
    options?.isCancelled?.() === true || options?.signal?.aborted === true;

  if (cancelled()) {
    throw new DOMException("revolution solver cancelled", "AbortError");
  }

  if (!isSerializableSimBase(request.loadout)) {
    stickyMainThread = true;
    return runSolverOnMainThread(request, onProgress, { isCancelled: cancelled });
  }

  let payload: SerializableSolverRequest;
  try {
    payload = structuredClone(request);
  } catch (err) {
    stickyMainThread = true;
    if (typeof console !== "undefined") {
      console.warn("[revo-solver] request not cloneable, main-thread only", err);
    }
    return runSolverOnMainThread(request, onProgress, { isCancelled: cancelled });
  }

  const forceMain =
    options?.forceMainThread === true || stickyMainThread || typeof Worker === "undefined";

  if (forceMain) {
    return runSolverOnMainThread(payload, onProgress, { isCancelled: cancelled });
  }

  try {
    const pool = getSolverAgentPool();
    const agents = options?.agents ?? solverPoolSize();
    if (typeof console !== "undefined" && agents > 1) {
      console.info(`[revo-solver] launching ${agents} parallel agents`);
    }
    return await pool.run(payload, onProgress, {
      isCancelled: cancelled,
      signal: options?.signal,
      agents,
    });
  } catch (err) {
    if (cancelled() || isAbortError(err)) {
      throw isAbortError(err)
        ? err
        : new DOMException("revolution solver cancelled", "AbortError");
    }
    if (typeof console !== "undefined") {
      console.warn("[revo-solver] agent pool failed, trying single worker", err);
    }
    try {
      cancelSolverAgentPool();
      const client = getRevolutionSolverClient();
      return await client.start(payload, onProgress, {
        isCancelled: cancelled,
        signal: options?.signal,
      });
    } catch (err2) {
      if (cancelled() || isAbortError(err2)) {
        throw isAbortError(err2)
          ? err2
          : new DOMException("revolution solver cancelled", "AbortError");
      }
      stickyMainThread = true;
      if (typeof console !== "undefined") {
        console.warn("[revo-solver] worker unavailable, main-thread fallback", err2);
      }
      try {
        getRevolutionSolverClient().disposeQuiet();
      } catch {
        // ignore
      }
      sharedClient = null;
      if (cancelled()) {
        throw new DOMException("revolution solver cancelled", "AbortError");
      }
      return runSolverOnMainThread(payload, onProgress, { isCancelled: cancelled });
    }
  }
}

export function cancelOptimize(): void {
  cancelSolverAgentPool();
  sharedClient?.cancel();
}

export function getRevolutionSolverClient(): RevolutionSolverClient {
  if (!sharedClient) sharedClient = new RevolutionSolverClient();
  return sharedClient;
}

/**
 * One-shot worker (terminates after run). Prefer {@link runOptimize}.
 */
export async function runSolverInWorker(
  request: SerializableSolverRequest,
  onProgress?: SolveProgressHandler,
  options?: { signal?: AbortSignal; isCancelled?: () => boolean },
): Promise<SolverResultDTO> {
  return runOptimize(request, onProgress, options);
}

type ActiveRun = {
  requestId: number;
  resolve: (result: SolverResultDTO) => void;
  reject: (error: Error) => void;
  onProgress?: SolveProgressHandler;
  /** Explicit abort — never infer cancel from active===null. */
  aborted: boolean;
  settled: boolean;
  bootTimer?: ReturnType<typeof setTimeout>;
};

/**
 * Long-lived host: one Worker, cancel/pause/resume.
 */
export class RevolutionSolverClient {
  private worker: Worker | null = null;
  private seq = 0;
  private active: ActiveRun | null = null;

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    this.worker = createWorker();
    if (!this.worker) return null;
    this.worker.addEventListener("message", (event: MessageEvent<unknown>) => {
      this.onWorkerMessage(event.data);
    });
    this.worker.addEventListener("error", (event: ErrorEvent) => {
      this.failActive(new Error(event.message || "revolution solver worker failed"));
      this.dropWorker();
    });
    this.worker.addEventListener("messageerror", () => {
      this.failActive(new Error("revolution solver worker messageerror (clone failed)"));
      this.dropWorker();
    });
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
    if (kind === "resolve") run.resolve(value as SolverResultDTO);
    else run.reject(value as Error);
  }

  private failActive(error: Error): void {
    const run = this.active;
    if (!run) return;
    this.settleActive(run, "reject", error);
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
    if (!isWorkerToHostMessage(data)) {
      if (typeof console !== "undefined" && this.active) {
        console.warn("[revo-solver] ignored non-protocol worker message", data);
      }
      return;
    }
    const msg = data;
    const run = this.active;
    if (!run) return;
    if (msg.requestId !== run.requestId) {
      if (typeof console !== "undefined") {
        console.warn(
          "[revo-solver] worker message requestId mismatch",
          msg.requestId,
          "expected",
          run.requestId,
          msg.type,
        );
      }
      return;
    }
    // Any protocol message clears the boot watchdog.
    if (run.bootTimer != null) {
      clearTimeout(run.bootTimer);
      run.bootTimer = undefined;
    }
    switch (msg.type) {
      case "progress":
        if (run.aborted) return;
        try {
          run.onProgress?.(msg.progress);
        } catch {
          // UI progress must never kill the solve.
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
        this.settleActive(
          run,
          "reject",
          new DOMException("revolution solver cancelled", "AbortError"),
        );
        break;
    }
  }

  start(
    request: SerializableSolverRequest,
    onProgress?: SolveProgressHandler,
    options?: { isCancelled?: () => boolean; signal?: AbortSignal },
  ): Promise<SolverResultDTO> {
    // Soft-cancel previous run (do not throw into the new caller's stack).
    this.cancelQuiet();

    const requestId = ++this.seq;
    const externalCancelled = () =>
      options?.isCancelled?.() === true || options?.signal?.aborted === true;

    if (externalCancelled()) {
      return Promise.reject(new DOMException("revolution solver cancelled", "AbortError"));
    }

    const worker = stickyMainThread ? null : this.ensureWorker();

    // ── Main-thread path ──────────────────────────────────────────────────
    if (!worker) {
      return new Promise<SolverResultDTO>((resolve, reject) => {
        const run: ActiveRun = {
          requestId,
          resolve,
          reject,
          onProgress,
          aborted: false,
          settled: false,
        };
        this.active = run;

        const onAbort = () => {
          run.aborted = true;
          this.settleActive(
            run,
            "reject",
            new DOMException("revolution solver cancelled", "AbortError"),
          );
        };
        options?.signal?.addEventListener("abort", onAbort, { once: true });

        void runSolverOnMainThread(request, onProgress, {
          isCancelled: () => run.aborted || externalCancelled(),
        })
          .then((result) => {
            options?.signal?.removeEventListener("abort", onAbort);
            if (run.aborted || externalCancelled()) {
              this.settleActive(
                run,
                "reject",
                new DOMException("revolution solver cancelled", "AbortError"),
              );
              return;
            }
            this.settleActive(run, "resolve", result);
          })
          .catch((err: unknown) => {
            options?.signal?.removeEventListener("abort", onAbort);
            if (run.settled) return;
            this.settleActive(
              run,
              "reject",
              err instanceof Error ? err : new Error(String(err)),
            );
          });
      });
    }

    // ── Worker path ───────────────────────────────────────────────────────
    return new Promise<SolverResultDTO>((resolve, reject) => {
      const run: ActiveRun = {
        requestId,
        resolve,
        reject,
        onProgress,
        aborted: false,
        settled: false,
      };
      this.active = run;

      const onAbort = () => {
        run.aborted = true;
        try {
          post(worker, { type: "cancel", requestId });
        } catch {
          // ignore
        }
        this.settleActive(
          run,
          "reject",
          new DOMException("revolution solver cancelled", "AbortError"),
        );
      };
      options?.signal?.addEventListener("abort", onAbort, { once: true });

      // Wrap settle to drop abort listener.
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

      run.bootTimer = setTimeout(() => {
        if (run.settled) return;
        this.dropWorker();
        this.settleActive(
          run,
          "reject",
          new Error(
            `revolution solver worker watchdog: no message after ${WORKER_FIRST_MESSAGE_MS}ms`,
          ),
        );
      }, WORKER_FIRST_MESSAGE_MS);

      try {
        post(worker, { type: "start", requestId, payload: request });
      } catch (err) {
        options?.signal?.removeEventListener("abort", onAbort);
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

  /** Reject active run as cancelled (user Cancel / new start). */
  cancel(): void {
    const run = this.active;
    if (!run || run.settled) return;
    run.aborted = true;
    if (this.worker) {
      try {
        post(this.worker, { type: "cancel", requestId: run.requestId });
      } catch {
        // ignore
      }
    }
    this.settleActive(
      run,
      "reject",
      new DOMException("revolution solver cancelled", "AbortError"),
    );
  }

  /** Cancel without rejecting if already settled; used when replacing a run. */
  cancelQuiet(): void {
    const run = this.active;
    if (!run || run.settled) {
      this.active = null;
      return;
    }
    run.aborted = true;
    if (this.worker) {
      try {
        post(this.worker, { type: "cancel", requestId: run.requestId });
      } catch {
        // ignore
      }
    }
    // Still reject so the previous awaiter unblocks — but only once.
    this.settleActive(
      run,
      "reject",
      new DOMException("revolution solver cancelled", "AbortError"),
    );
  }

  /** Dispose worker without a loud cancel if idle. */
  disposeQuiet(): void {
    const run = this.active;
    if (run && !run.settled) {
      run.aborted = true;
      this.settleActive(
        run,
        "reject",
        new DOMException("revolution solver cancelled", "AbortError"),
      );
    }
    this.active = null;
    this.dropWorker();
  }

  pause(): void {
    const run = this.active;
    if (!run || !this.worker) return;
    post(this.worker, { type: "pause", requestId: run.requestId });
  }

  resume(): void {
    const run = this.active;
    if (!run || !this.worker) return;
    post(this.worker, { type: "resume", requestId: run.requestId });
  }

  dispose(): void {
    this.cancel();
    this.dropWorker();
  }
}
