#!/usr/bin/env node
/**
 * Fast Leng microbench CLI (score-only, single dual-Leng bar + peer DW).
 *
 * Usage:
 *   node scripts/benchmarks/leng-micro.mjs
 *   $env:RS3_BRANCH_PROF='1'; node scripts/benchmarks/leng-micro.mjs
 *
 * Or via vitest:
 *   $env:RS3_LENG_MICRO='1'; npx vitest run src/combat/solver/benchmarks/lengMicrobench.test.ts
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const testFile = "src/combat/solver/benchmarks/lengMicrobench.test.ts";
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
      RS3_LENG_MICRO: process.env.RS3_LENG_MICRO ?? "1",
      SOLVER_BENCH: process.env.SOLVER_BENCH ?? "leng",
    },
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
