export type SolverFailureKind = "domain" | "infrastructure";

export class SolverExecutionError extends Error {
  readonly failureKind: SolverFailureKind;

  constructor(failureKind: SolverFailureKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SolverExecutionError";
    this.failureKind = failureKind;
  }
}

export function isInfrastructureFailure(error: unknown): boolean {
  return error instanceof SolverExecutionError && error.failureKind === "infrastructure";
}

export function solverFailureFromWorkerMessage(
  message: string,
  failureKind: SolverFailureKind | undefined,
): SolverExecutionError {
  return new SolverExecutionError(failureKind ?? "domain", message);
}
