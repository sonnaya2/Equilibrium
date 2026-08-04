# Solver performance baseline — phase 0

**Status: PRE-OPTIMIZATION baseline.**  
This document records measured wall-clock numbers on the current tree **before** Phase 1 solver performance optimizations. It is **not** a regression budget, success target, or claim of improvement. Do not cite these numbers as “X× faster” without a later phase report against the same harness.

| Field | Value |
|-------|--------|
| **Commit** | `fa7abcb5db7aab892fea40de43ec55d2d4e10ef1` (`fa7abcb5`) |
| **Commit subject** | merge main into combat-event-provenance |
| **Branch** | `grok/solver-performance-rewrite` |
| **Worktree** | Dirty — Phase 0 profiling instrumentation uncommitted on top of `fa7abcb5` |
| **Date (UTC)** | 2026-08-04 (report generated; source bench `2026-08-04T02:26:25.519Z`) |
| **Mode** | `quick` (`npm run benchmark:solver:quick`) |
| **Quick budget** | `evaluationBudget=28` (tier label `quick@28`) |
| **Thorough budget (reference)** | `2400` (not used in this run) |
| **Host** | Node `v26.5.1`, win32 x64, AMD Ryzen 9 9950X 16-Core Processor (32 logical CPUs) |
| **Source JSON** | [`solver-benchmark-quick.json`](./solver-benchmark-quick.json) |
| **Baseline JSON** | [`solver-performance-baseline-phase0.json`](./solver-performance-baseline-phase0.json) |

## Profile flags (this run)

| Flag | State | Package / surface |
|------|-------|-------------------|
| `SOLVER_PROFILE` | **off** | `src/combat/solver/profiling/*` |
| `RS3_HIT_PROFILE` | **off** | `src/combat/profiling/hitPipeline` |
| `RS3_ALLOC_PROFILE` | **off** | `src/combat/profiling/allocation` |
| `RS3_BRANCH_PROF` | **off** | `branchCore` / `getBranchProfile` |

All measure-only env flags were **unset**. Case rows therefore omit `hitPipeline` / `allocation` / `solverProfile` / `branchProfile` fields. `runBenchmark` will attach those snapshots when the corresponding flag is set to `1` (or `true` for branch).

## Suite total

| Metric | Value |
|--------|------:|
| Cases | 6 |
| **Total wall time** | **23 239 ms** |
| Status mix | 5× `ok`, 1× `degraded`, 0× `failed`/`error` |
| Rankable | 5 / 6 |

## Case table

| Case | Status | Score | Evals | Unique | Duration (ms) | Rankable | Proof |
|------|--------|------:|------:|-------:|-------------:|----------|-------|
| `melee-2h-4slot` | ok | 100767.93 | 30 | 28 | **41** | yes | heuristic-best-found |
| `leng-icy-context` | degraded | 124752.84 | 30 | 28 | **23 081** | no | degraded-exploratory-fallback |
| `igneous-context` | ok | 100767.93 | 30 | 28 | **32** | yes | heuristic-best-found |
| `four-slot-fixed` | ok | 101510.89 | 30 | 28 | **37** | yes | heuristic-best-found |
| `melee-norng-4slot` | ok | 95970.29 | 30 | 28 | **14** | yes | heuristic-best-found |
| `equipment-procs` | ok | 116824.06 | 30 | 28 | **22** | yes | heuristic-best-found |

### Winner bars (recorded)

| Case | Bar |
|------|-----|
| `melee-2h-4slot` | berserk, assault, adaptive_strike_2h, meteor_strike |
| `leng-icy-context` | berserk, assault, adaptive_strike_dw, meteor_strike |
| `igneous-context` | berserk, assault, adaptive_strike_2h, meteor_strike |
| `four-slot-fixed` | berserk, assault, adaptive_strike_dw, meteor_strike |
| `melee-norng-4slot` | berserk, assault, adaptive_strike_2h, meteor_strike |
| `equipment-procs` | berserk, assault, adaptive_strike_dw, meteor_strike |

### Context fingerprints

| Case | Fingerprint |
|------|-------------|
| `melee-2h-4slot` | `f86326266c0a6f6b890e6d9f64e2310f07b38aa75b56d699c10e51d18e8a51ab` |
| `leng-icy-context` | `ad8a219a002f612f655481854e42b7d9f2034d008c08f04af3cf1f2e7f4333bd` |
| `igneous-context` | `a5a270a9ab5651afeeab20ccffce33450ccb6422fa1cfd339796ea34d56e88c4` |
| `four-slot-fixed` | `d5a2e7f533dfc6a86f7fa3c059dfbb0269ae93e240fe05ad49b4c52f165a0d14` |
| `melee-norng-4slot` | `8fdf690eb2425c3284b8462f8ca06a479f392bfd1e4d63ab07c8ff805bd84e75` |
| `equipment-procs` | `67c408376ca9647fb8c6e09436663b85d4ed8b5f28488c55f3ea0dc14750f402` |

## Observations (descriptive only)

- Five of six quick cases complete in ~14–41 ms under the tiny budget.
- Suite wall time is dominated by **`leng-icy-context` (~23.1 s)** with status `degraded` / unrankable and proof `degraded-exploratory-fallback`. Same eval/unique counts (30/28) as the fast cases — wall time is not explained by evaluation count alone in this report.
- Two additional cases vs earlier 4-case phase0 snapshot: `melee-norng-4slot`, `equipment-procs` (from Phase 0 cases expansion).
- Profile packages coexist and are wired into `runBenchmark`; this baseline intentionally ran with all flags **off** for clean wall-clock numbers.

## Phase 0 instrumentation (integrated, measure-only)

| Surface | Gate | Location |
|---------|------|----------|
| Solver search counters | `SOLVER_PROFILE=1` | `src/combat/solver/profiling/*` |
| Hit-pipeline counters | `RS3_HIT_PROFILE=1` | `src/combat/profiling/hitPipeline.ts` |
| Allocation counters | `RS3_ALLOC_PROFILE=1` | `src/combat/profiling/allocation.ts` |
| Branch cost counters | `RS3_BRANCH_PROF=1\|true` | `src/combat/engine/simulation/branchCore.ts` |
| Pool metrics | always (pool path) | `protocol.SolverPoolMetrics` / `SolverResultDTO.poolMetrics` |

No Phase 1 optimizations were implemented in this integration pass.

## How to reproduce

```text
# from worktree root (with node_modules + .generated available)
npm run benchmark:solver:quick
# -> reports/solver-benchmark-quick.json

# optional profile-enriched run (does not replace wall-clock baseline)
# $env:SOLVER_PROFILE=1; $env:RS3_HIT_PROFILE=1; $env:RS3_ALLOC_PROFILE=1; $env:RS3_BRANCH_PROF=1
# npm run benchmark:solver:quick
```

## Disclaimer

**PRE-OPTIMIZATION.** Numbers above are a single-host snapshot for later comparison only. They do not authorize budget cuts, threshold lowering, or marketing of performance gains.
