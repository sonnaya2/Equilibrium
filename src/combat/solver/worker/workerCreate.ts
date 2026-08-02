/** Shared worker construction + ACK watchdog config for host and agent pool. */

export type WorkerFactory = () => Worker | null;

let workerFactoryForTests: WorkerFactory | null = null;
let firstAckMs = 12_000;

export function setWorkerFactoryForTests(factory: WorkerFactory | null): void {
  workerFactoryForTests = factory;
}

export function setWorkerHostTimeoutsForTests(opts: { firstAckMs?: number }): void {
  if (opts.firstAckMs != null) firstAckMs = opts.firstAckMs;
}

export function resetWorkerCreateForTests(): void {
  workerFactoryForTests = null;
  firstAckMs = 12_000;
}

export function getFirstAckMs(): number {
  return firstAckMs;
}

/** True when a factory is injected or the runtime has Worker. */
export function canCreateSolverWorker(): boolean {
  return workerFactoryForTests != null || typeof Worker !== "undefined";
}

export function createSolverWorker(): Worker | null {
  if (workerFactoryForTests) {
    try {
      return workerFactoryForTests();
    } catch {
      return null;
    }
  }
  if (typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("./revolutionSolver.worker.ts", import.meta.url));
  } catch {
    return null;
  }
}
