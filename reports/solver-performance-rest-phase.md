# Solver performance — rest-phase remeasure

**Status: REMEASURE after rest-phase landings.**  
Single-host wall-clock snapshot against Phase 0 / Phase 1. **No 3× claim.** Suite total is ~**1.7×** wall-clock of phase0 (see tables); that is **not** 3×.

| Field | Value |
|-------|--------|
| **Commit** | `e1450fd4c377fe8069b6cda18109bc5b414532c2` (`e1450fd4`) |
| **Commit subject** | Merge pull request #1 from sonnaya2/grok/solver-performance-rewrite |
| **Branch** | `grok/solver-performance-rest` (tracking `origin/main`) |
| **Worktree** | Dirty — additional uncommitted solver/score-only/compiled-context edits + new fidelity/coord files |
| **Date (UTC)** | 2026-08-04 (bench `2026-08-04T03:12:34.144Z`) |
| **Mode** | `quick` (`npm run benchmark:solver:quick`) |
| **Quick budget** | `evaluationBudget=28` (tier label `quick@28`) |
| **Thorough budget (reference)** | `2400` (not used in this run) |
| **Host** | Node `v26.5.1`, win32 x64, AMD Ryzen 9 9950X (same class of host as phase0/1) |
| **JSON artifact** | `reports/solver-benchmark-quick.json` (local / gitignored) |
| **Phase 0 baseline** | [`solver-performance-baseline-phase0.md`](./solver-performance-baseline-phase0.md) |
| **Phase 1 check** | [`solver-performance-phase1-check.md`](./solver-performance-phase1-check.md) |

Wait: ~5 minutes after other agents, then remeasure (this document).

## Profile flags (this run)

All measure-only env flags **unset** (same clean wall-clock mode as phase0/1).

| Flag | State |
|------|-------|
| `SOLVER_PROFILE` | **off** |
| `RS3_HIT_PROFILE` | **off** |
| `RS3_ALLOC_PROFILE` | **off** |
| `RS3_BRANCH_PROF` | **off** |

## Verification results

| Check | Result |
|-------|--------|
| `npm run benchmark:solver:quick` | **GREEN** — 6 cases, `totalMs=13365`, wrote `reports/solver-benchmark-quick.json` |
| `npx vitest run src/combat/solver src/combat/pipeline src/combat/engine/simulation/scoreOnlyParity.test.ts` | **1 FAIL** — see below |

### Vitest summary

| Metric | Count |
|--------|------:|
| Test files | 1 failed / 36 passed / 2 skipped (39) |
| Tests | **1 failed** / **291 passed** / 2 skipped (294) |
| Duration | ~18.6 s |

Skipped under plain vitest solver glob (expected): `benchmarks/full.test.ts`, `benchmarks/quick.test.ts` (quick harness exercised via `npm run benchmark:solver:quick`).

### Failure (honest)

```text
FAIL  src/combat/solver/worker/pool.test.ts
  > Phase-0 pool metrics > reports per-agent budget vs global sum and known-wrong unique sum

Expected: reservedCore: false
Received: reservedCore: true
```

`mergeProgress` now reports `reservedCore: true` while the Phase-0 pool metrics test still expects `false`. **Not** a score/eval regression on the quick bench cases; test/expectation drift after rest-phase pool work. Score-only parity suites under this glob were green (`scoreOnlyParity.test.ts` engine + solver).

## Suite total vs Phase 0 / Phase 1

Profile flags **off**.

| Metric | Phase 0 | Phase 1 | **Rest (this)** | vs P0 | vs P1 |
|--------|--------:|--------:|----------------:|------:|------:|
| **Suite total (ms)** | **23 239** | **23 756** | **13 365** | **−9 874 (−42%)** | **−10 391 (−44%)** |
| Wall ratio (earlier ÷ rest) | — | — | — | **~1.74×** | **~1.78×** |
| Cases | 6 | 6 | 6 | — | — |
| Status mix | 5 ok / 1 degraded | 5 ok / 1 degraded | 5 ok / 1 degraded | same | same |
| Rankable | 5 / 6 | 5 / 6 | 5 / 6 | same | same |

**Not 3×.** Suite wall time improved by less than 2× vs phase0. Do not round this up to “3× faster.”

## Per-case duration (ms)

| Case | Phase 0 | Phase 1 | **Rest** | Δ vs P0 (ms) | Ratio P0÷rest | Score (rest) | Status |
|------|--------:|--------:|---------:|-------------:|--------------:|-------------:|--------|
| `melee-2h-4slot` | 41 | 45 | **33** | −8 | ~1.24× | 100767.93 | ok |
| `leng-icy-context` | 23 081 | 23 604 | **13 265** | −9 816 | ~1.74× | 124750.82 | degraded |
| `igneous-context` | 32 | 31 | **14** | −18 | ~2.29× | 100767.93 | ok |
| `four-slot-fixed` | 37 | 30 | **15** | −22 | ~2.47× | 101510.89 | ok |
| `melee-norng-4slot` | 14 | 13 | **11** | −3 | ~1.27× | 95970.29 | ok |
| `equipment-procs` | 22 | 22 | **16** | −6 | ~1.38× | 116824.06 | ok |

### Fast-cases subtotal (exclude `leng-icy-context`)

| Set | Duration sum (ms) |
|-----|------------------:|
| Phase 0 | 146 |
| Phase 1 | 141 |
| **Rest** | **89** |
| P0 ÷ rest | **~1.64×** |

Fast cases remain tens of milliseconds under the tiny budget; absolute wins are small even where ratios look larger (noise + short walls).

### Winner bars (rest run — unchanged vs phase0/1)

| Case | Bar |
|------|-----|
| `melee-2h-4slot` | berserk, assault, adaptive_strike_2h, meteor_strike |
| `leng-icy-context` | berserk, assault, adaptive_strike_dw, meteor_strike |
| `igneous-context` | berserk, assault, adaptive_strike_2h, meteor_strike |
| `four-slot-fixed` | berserk, assault, adaptive_strike_dw, meteor_strike |
| `melee-norng-4slot` | berserk, assault, adaptive_strike_2h, meteor_strike |
| `equipment-procs` | berserk, assault, adaptive_strike_dw, meteor_strike |

### Context fingerprints (rest — match phase0/1)

| Case | Fingerprint |
|------|-------------|
| `melee-2h-4slot` | `f86326266c0a6f6b890e6d9f64e2310f07b38aa75b56d699c10e51d18e8a51ab` |
| `leng-icy-context` | `ad8a219a002f612f655481854e42b7d9f2034d008c08f04af3cf1f2e7f4333bd` |
| `igneous-context` | `a5a270a9ab5651afeeab20ccffce33450ccb6422fa1cfd339796ea34d56e88c4` |
| `four-slot-fixed` | `d5a2e7f533dfc6a86f7fa3c059dfbb0269ae93e240fe05ad49b4c52f165a0d14` |
| `melee-norng-4slot` | `8fdf690eb2425c3284b8462f8ca06a479f392bfd1e4d63ab07c8ff805bd84e75` |
| `equipment-procs` | `67c408376ca9647fb8c6e09436663b85d4ed8b5f28488c55f3ea0dc14750f402` |

### Scores

| Case | Phase 0 / 1 | Rest | Note |
|------|------------:|-----:|------|
| `melee-2h-4slot` | 100767.93 | 100767.93 | identical (reported) |
| `leng-icy-context` | 124752.84 | **124750.82** | ~2 pt drift; still degraded / unrankable; same bar |
| `igneous-context` | 100767.93 | 100767.93 | identical |
| `four-slot-fixed` | 101510.89 | 101510.89 | identical |
| `melee-norng-4slot` | 95970.29 | 95970.29 | identical |
| `equipment-procs` | 116824.06 | 116824.06 | identical |

Evals / unique still **30 / 28** on every case (budget-bound; wall time not explained by eval count alone).

## Observations (descriptive only)

- Suite wall time still dominated by **`leng-icy-context` (~13.3 s)** with `degraded-exploratory-fallback` / unrankable. That case accounts for almost all of the suite total and almost all of the absolute improvement vs phase0 (−9.8 s of −9.9 s suite Δ).
- Suite ratio vs phase0 is **~1.74×**, not 3×. Phase 1 was approximately flat vs phase0; rest-phase is the first measured suite-level wall drop on this harness.
- Winner bars and context fingerprints unchanged. Ranking scores match on five cases; `leng-icy-context` has a tiny score drift under degraded status — do not treat as a ranking win.
- One unit test failure (`pool.test.ts` `reservedCore`) is unrelated to quick-case scores; fix expectation or pool default before claiming full green.

## How to reproduce

```text
# from worktree root
npm run benchmark:solver:quick
# -> reports/solver-benchmark-quick.json

npx vitest run src/combat/solver src/combat/pipeline src/combat/engine/simulation/scoreOnlyParity.test.ts
```

## Disclaimer

**No 3× claim.** Measured suite speedup vs phase0 is **~1.74×** wall-clock on one host, one run. Do not market ratios above what the tables show. Thorough / full suites were not re-run here.
