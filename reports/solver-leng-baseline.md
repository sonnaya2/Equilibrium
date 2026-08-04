# Solver Leng microbench baseline

**Status: BASELINE (score-only single bar, not full suite).**  
Fast wall-time reference for dual-Leng vs peer DW. Use for hotpath remeasures; do not treat as a regression budget or "X times faster" claim without a later paired report.

| Field | Value |
|-------|--------|
| **Commit** | `588641de` |
| **Branch** | `grok/leng-icy-hotpath` |
| **Worktree** | `C:\Users\Sonnaya\Rs3Equilibrium-worktrees\solver-performance-rewrite` |
| **Date (UTC)** | 2026-08-03 |
| **Host** | Node `v26.5.1`, win32 x64, AMD Ryzen 9 9950X 16-Core Processor (32 logical CPUs) |
| **Harness** | `src/combat/solver/benchmarks/lengMicrobench.ts` |
| **Detail level** | `score-only` |
| **Horizon** | **50 ticks** (MIN_RANKABLE / explore-style full window) |
| **Bar** | `assault`, `flurry`, `fury`, `dismember` (fixed DW 4-slot) |
| **Packing** | `cases.ts` `leng-icy-context` + peer `four-slot-fixed` |

## What this is (and is not)

| Is | Is not |
|----|--------|
| One score-only eval of a fixed dual-Leng bar | Full `solveAsync` / quick suite search |
| Same equipment/passives packing as `leng-icy-context` | Production UI loadout packing |
| Peer DW bar with identical abilities (`four-slot-fixed`) | Multi-bar beam / 28-eval budget |
| Target runtime **under 10s** (typically ~1-2s) | Phase-0 full-suite ~20s wall |

## How to re-run

```powershell
# Unprofiled wall (default)
npm run benchmark:solver:leng-micro
# or:
node scripts/benchmarks/leng-micro.mjs

# With branch snapshots (RS3_BRANCH_PROF)
$env:RS3_BRANCH_PROF = '1'
npm run benchmark:solver:leng-micro

# Direct vitest
$env:RS3_LENG_MICRO = '1'
npx vitest run src/combat/solver/benchmarks/lengMicrobench.test.ts --reporter=verbose
```

Exports: `runLengMicrobench`, `formatLengMicroSummary`, `LENG_MICRO_BAR`, `LENG_MICRO_TICKS`.

## Baseline numbers (this host)

Single-process measure after a cold first pass; report the **stable repeat** (second process). Single-host, single-run class: treat as order-of-magnitude, not CI gate.

### Unprofiled (`RS3_BRANCH_PROF` unset)

| Arm | wallMs | simOk | rankOk | totalExpected | residual | exactness |
|-----|-------:|:-----:|:------:|--------------:|---------:|-----------|
| **`leng-icy-context`** | **710.9** | yes | no | 41162.5 | 0.0064 | approximated |
| **`four-slot-fixed`** (peer) | **1.08** | yes | yes | 40277.3 | n/a | n/a |

| Metric | Value |
|--------|------:|
| total harness wall (both arms) | **713 ms** |
| **leng / peer wall ratio** | **~658x** |
| peer score (rankable) | 79952.64 |

### Profiled (`RS3_BRANCH_PROF=1`)

| Arm | wallMs | snaps | keySer | maxLive | mergeCap | discards |
|-----|-------:|------:|-------:|--------:|---------:|---------:|
| **`leng-icy-context`** | **748.6** | **30 648** | **307 379** | **128** | 497 | 2 592 |
| **`four-slot-fixed`** | **1.07** | **0** | 19 | 1 | 19 | 0 |

| Metric | Value |
|--------|------:|
| total harness wall | **751 ms** |
| leng residual / exactness | 0.0064 / approximated |
| leng totalExpected | 41162.5 (same as unprofiled) |
| **leng / peer wall ratio** | **~698x** |

### Interpretation

1. **Per-eval cost**, not search thrash: one bar, score-only, 50 ticks.
2. Dual Leng still pays **~650-700x** peer DW wall on this bar (multi-hit land fan-out).
3. **~30.6k branch snapshots** per 50-tick Leng eval; peer has **0** snapshots (single branch).
4. Ranking stays **unrankable** under residual (`rankOk=false`, `exactness=approximated`) while physics completes (`simOk=true`, `totalExpected` present). Matches product residual policy.
5. Branch profiling overhead on this sample is small (~5% wall) after warm process; first cold measure can inflate snaps/wall - always report a stable repeat.

## Equipment packing (from `cases.ts`)

**Leng (`leng-icy-context`):**

- style: melee, weaponConfiguration: dualwield
- equipmentIds: `item:dark-shard-of-leng`, `item:dark-sliver-of-leng`
- passiveIds: `leng-endless-frost`, `leng-boundless-chill`
- seed: 106, min/max bar: 4

**Peer (`four-slot-fixed`):**

- style: melee, weaponConfiguration: dualwield
- no Leng equipment / passives
- seed: 108, min/max bar: 4

## Related reports

- `reports/solver-leng-icy-hotspot.md` - full quick-suite Leng dominance diagnosis
- `reports/solver-leng-icy-gate.md` - hotpath gate (exactness preserve)
- `reports/solver-performance-baseline-phase0.md` - pre-opt full quick suite
- `docs/solver-benchmarks.md` - permanent suite commands
