#!/usr/bin/env node
/**
 * Solver benchmark CLI.
 * Spawns vitest on the permanent harness under src/combat/solver/benchmarks/.
 *
 * Usage:
 *   node scripts/benchmarks/solver.mjs            # quick
 *   node scripts/benchmarks/solver.mjs quick
 *   node scripts/benchmarks/solver.mjs full
 *   node scripts/benchmarks/solver.mjs json        # quick + print report path
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const modeArg = (process.argv[2] ?? "quick").toLowerCase();
const mode = modeArg === "json" ? "quick" : modeArg;

if (mode !== "quick" && mode !== "full") {
  console.error(`Usage: node scripts/benchmarks/solver.mjs [quick|full|json]`);
  process.exit(2);
}

const testFile =
  mode === "full"
    ? "src/combat/solver/benchmarks/full.test.ts"
    : "src/combat/solver/benchmarks/quick.test.ts";

const reportName =
  mode === "full" ? "solver-benchmark-full.json" : "solver-benchmark-quick.json";
const reportPath = join(root, "reports", reportName);

const benchEnv =
  modeArg === "json" ? "json" : mode === "full" ? "full" : "quick";

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npx,
  ["vitest", "run", testFile, "--reporter=verbose"],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      FORCE_COLOR: process.env.FORCE_COLOR ?? "1",
      SOLVER_BENCH: benchEnv,
    },
    shell: process.platform === "win32",
  },
);

const code = result.status ?? 1;
if (code === 0) {
  if (existsSync(reportPath)) {
    console.log(`[solver-bench] wrote ${reportPath}`);
  } else {
    console.warn(`[solver-bench] expected report missing: ${reportPath}`);
  }
  if (modeArg === "json" && existsSync(reportPath)) {
    // Path-only line for scripts that pipe the report.
    console.log(reportPath);
  }
}

process.exit(code);
