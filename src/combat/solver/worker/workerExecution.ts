import type { SolverProfileSnapshot } from "../profiling/counters";
import type { SerializableSolverRequest, SolverResultDTO } from "./serializable";
import type { SolveFn, SolveRuntimeOptions } from "./solveTypes";
import { SolverExecutionError } from "./failure";

async function loadSolve(): Promise<SolveFn> {
  try {
    const mod = (await import(/* webpackMode: "lazy" */ "../solveFromRequest")) as {
      solveFromRequest?: SolveFn;
      default?: SolveFn;
    };
    const solve = mod.solveFromRequest ?? mod.default;
    if (typeof solve !== "function") {
      throw new Error("revolution solver: solveFromRequest export missing");
    }
    return solve;
  } catch (error) {
    if (error instanceof SolverExecutionError) throw error;
    throw new SolverExecutionError(
      "infrastructure",
      error instanceof Error ? error.message : String(error),
      { cause: error },
    );
  }
}

export interface WorkerSolveExecution {
  readonly result: SolverResultDTO;
  readonly profile?: SolverProfileSnapshot;
}

export async function executeWorkerSolve(
  request: SerializableSolverRequest,
  options: Omit<SolveRuntimeOptions, "onProfile"> = {},
): Promise<WorkerSolveExecution> {
  const solve = await loadSolve();
  let profile: SolverProfileSnapshot | undefined;
  const result = await solve(request, {
    ...options,
    onProfile: (snapshot) => {
      profile = snapshot;
    },
  });
  return { result, ...(profile ? { profile } : {}) };
}
