# Solver hotspot: `leng-icy-context`

**Status: diagnosis + safe micro-fixes + sibling hotpath WIP; measure pass below.**  
Quick-suite wall time is dominated by one case: DW Leng (Endless Frost + Boundless Chill). Eval count matches peers; **per-eval sim cost** explodes.

| Field | Value |
|-------|--------|
| **Worktree** | `C:\Users\Sonnaya\Rs3Equilibrium-worktrees\solver-performance-rewrite` |
| **Commit** | `05b1582e` (+ dirty sibling Leng/branchKey/runtime edits; see measure pass) |
| **Date (UTC)** | 2026-08-04 |
| **Host** | Node `v26.5.1`, win32 x64 |
| **Mode** | `quick` (`evaluationBudget=28`, horizons explore=24 / full=50) |
| **Profile flags** | `SOLVER_PROFILE=1` `RS3_BRANCH_PROF=1` `RS3_HIT_PROFILE=1` `RS3_ALLOC_PROFILE=1` |

## TL;DR

| Question | Answer |
|----------|--------|
| Why ~23s vs ~30ms peers? | Same ~30 evals; each Leng eval does **~10k runtime snapshots** and **~60k+ branchKey serializations** because every eligible melee land forks Endless Frost × Boundless Chill arms across up to 64 live parents. |
| Why `degraded` / unrankable? | Hard branch cap leaves **`residualWeight > 0`** / `exactness=bounded-approximation` → `scoreSummary` hard-fails full-horizon objective → only short-horizon exploratory DPM ranks → `degraded-exploratory-fallback`. |
| Is it search thrashing? | No. Solver counters match peers (28 unique bars, 318 beam children, 10 duplicate eval attempts). |
| Did sibling hotpath fixes cut wall time? | **No (this single-run measure).** AFTER **16 310 ms** vs BEFORE post-micro **13 777 ms** → wall ratio **1.18× slower**. Rankability unchanged (`degraded` / unrankable). Unit gates green (54/54). |

## Measured wall times

### Pre-micro-fix profile run (prior session)

| Case | Status | Score | Evals | Uniq | ms | Rankable |
|------|--------|------:|------:|-----:|---:|----------|
| `melee-2h-4slot` | ok | 100767.93 | 30 | 28 | **36** | yes |
| **`leng-icy-context`** | **degraded** | 124752.84 | 30 | 28 | **18 514** | **no** |
| `igneous-context` | ok | 100767.93 | 30 | 28 | **18** | yes |
| `four-slot-fixed` | ok | 101510.89 | 30 | 28 | **15** | yes |
| `melee-norng-4slot` | ok | 95970.29 | 30 | 28 | **12** | yes |
| `equipment-procs` | ok | 116824.06 | 30 | 28 | **16** | yes |

Suite ≈ **18.6 s**, of which **leng ≈ 99%**.

Phase0 baseline had leng ≈ **23.1 s** (flags off; same qualitative dominance).

### Post micro-fix (BEFORE for sibling measure — same flags)

| Case | ms | Notes |
|------|---:|-------|
| **`leng-icy-context`** | **13 777** | still degraded / unrankable; exploratory score ~124750.82 |
| peers | 9–31 | unchanged character |

~**25%** wall cut on leng only vs pre-micro; **not** a 3× claim. Dominance remains.

### Sibling hotpath measure (AFTER — 2026-08-04T03:32Z UTC)

Tree at measure: `05b1582e` + uncommitted sibling edits (`branchKey.ts` structural key, `lengRng`/`lengLandBranch`/`branchCore`/`branch`/`context`, runtime/events/castHit, hitReuse, landHitIdentity). Waited ~4 min for siblings, then one profiled quick suite.

| Case | Status | Score | Evals | Uniq | ms | Rankable |
|------|--------|------:|------:|-----:|---:|----------|
| `melee-2h-4slot` | ok | 100767.93 | 30 | 28 | **34** | yes |
| **`leng-icy-context`** | **degraded** | 124753.02 | 30 | 28 | **16 310** | **no** |
| `igneous-context` | ok | 100767.93 | 30 | 28 | **22** | yes |
| `four-slot-fixed` | ok | 101510.89 | 30 | 28 | **17** | yes |
| `melee-norng-4slot` | ok | 95970.29 | 30 | 28 | **14** | yes |
| `equipment-procs` | ok | 116824.06 | 30 | 28 | **19** | yes |

Suite `totalDurationMs` = **16 425** (leng ≈ **99%**).

#### BEFORE vs AFTER (leng wall + honest ratios)

| Metric | BEFORE (post micro) | AFTER (sibling WIP) | Ratio AFTER/BEFORE |
|--------|--------------------:|--------------------:|-------------------:|
| **`leng-icy-context` ms** | **13 777** | **16 310** | **1.18×** (slower) |
| suite total ms | ~13.9k (leng-dominated) | **16 425** | **~1.18×** |
| status / rankable | degraded / no | degraded / no | unchanged |
| exploratory score | ~124750.82 | 124753.02 | ~same |
| evals / uniq bars | 30 / 28 | 30 / 28 | same search shape |
| beam children | 318 | 318 | same |
| peer `four-slot-fixed` ms | ~15 | **17** | noise |
| leng / four-slot wall | ~918× | **959×** | still ~10³× |

**Claim discipline:** single-host single-run. Do **not** market a speedup. Sibling WIP did **not** win wall time on this measure; structural counters mixed (see below).

## Profile deltas: leng vs `four-slot-fixed` (same DW 4-slot shape)

Counters are **per case** over the full 30 evals (explore+full).

| Counter | leng (pre micro) | leng (post micro = BEFORE) | leng (AFTER sibling) | four-slot (AFTER) | AFTER/BEFORE (leng) |
|---------|-----------------:|---------------------------:|---------------------:|------------------:|--------------------:|
| `branchSnapshots` | 257 520 | 257 311 | **257 170** | **0** | ~1.00× |
| `snapshotFieldsCloned` | 14.5M | 8.7M | **8.19M** | 0 | **0.94×** |
| `snapshotBytesEstimate` | ~2.74e9 | ~1.08e9 | **~8.48e8** | 0 | **0.78×** |
| `branchKeySerializations` | 1.82M | 1.88M | **2.17M** | 386 | **1.15×** (more) |
| `branchKeyChars` | ~8.00e9 | ~8.27e9 | **~2.83e9** | ~4.0e5 | **0.34×** (shorter keys) |
| `mergeAndCapCalls` | 430 | 1 508 | **6 052** | 386 | **4.01×** |
| `mergeAndCapDiscards` | 30 890 | 75 010 | **82 778** | 0 | 1.10× |
| `residualMassEvents` | 167 | 1 231 | **5 465** | 0 | 4.44× |
| `residualMassTotal` | ~1.43 | ~1.46 | **~1.44** | 0 | ~same mass |
| `maxLiveBranches` | **3 206** | **192** | **131** | 1 | **0.68×** peak |
| solver barKeys / beam | 28 / 318 | 28 / 318 | 28 / 318 | 28 / 318 | identical search |

Interpretation (AFTER measure):

1. **Snapshots still ~257k / 30 evals ≈ 8.6k snaps/eval** — Leng fan-out topology not reduced.
2. **Structural `branchKey`** (`branchKey.ts`) cuts key **chars ~3×** vs JSON post-micro, but **serialization count rose ~15%** and wall did not fall.
3. **More mergeAndCap / residual events** with similar residual **mass** — more intermediate folds, not less discarded mass.
4. **Peak live 131** (better than 192 post-micro) — still far from single-branch peers.
5. **Search shape unchanged** (28 bars, 318 beam children, 10 dup eval attempts).

## Root causes (ordered)

### 1. Land-time Leng state-branching (primary)

Case fixture (`cases.ts`):

- equipment: `item:dark-shard-of-leng`, `item:dark-sliver-of-leng`
- passives: `leng-endless-frost`, `leng-boundless-chill`

Mechanics (`styles/melee/lengRng.ts` + `lengLandBranch.ts`):

- Every **proc-eligible melee land** (not DoT / attached) rolls independent arms:
  - Endless Frost **10%** → +1 Primordial Ice stack (cap 10)
  - Boundless Chill **2%** → +1 stack + Frostblades window
- Product is up to **4** weighted outcomes per land; identical `(stacks|frostUntil)` merge.
- Non-primary outcomes call **`snapshotRuntime`** (deep state clone + map shells).
- Multi-hit channels (e.g. Assault in winner bar) expand **per hit** inside `advanceToBranches`, with soft intermediate `MAX_LENG_INTERMEDIATE_BRANCHES = 2 × MAX_LIVE_BRANCHES` (128) then hard cap **64**.

Peers never enter `expandLengOnLand` → **0 snapshots**, single live branch.

### 2. Live-set × cast outer product (secondary amplifier)

Revolution path (`revolution.ts` → `materializeCastPlans` → `commitCastBranches`):

- Up to **64 live parents** each commit a cast that Leng-expands again.
- Pre-fix: `out.push(...committed.branches)` with **no intermediate cap** → peak **~64×64** survivors (`maxLiveBranches=3206` observed).
- Each survivor continues to the next GCD, so cost compounds over the horizon.

`createCastContext.performCast` / `advanceTo` have the same accumulate-then-absorb pattern (manual path; not the quick bench driver but same class of bug).

### 3. Expensive merge identity (`branchKey`)

Historical `branchCore.branchKey`:

```text
JSON.stringify([state, queue.signature(), hitDetails, spiritMeta, tracks, hitCounts, endTick, nextSeq, nextCastSeq])
```

Sibling WIP adds `simulation/branchKey.ts` compact structural multi-field string (JSON restore via `RS3_BRANCH_KEY_JSON=1`). Measure shows **chars down, call count up, wall not improved**.

### 4. Residual mass ⇒ unrankable full scores (status, not just speed)

`objective.scoreSummary` hard-fails when:

- `rng.residualWeight > 0`, or
- `rng.exactness` ∈ non-exact lattice (`bounded-approximation`, …)

Leng under `MAX_LIVE_BRANCHES=64` routinely truncates stack-state mass over 50 ticks → residual → full-horizon objective fails.

Search (24 ticks) still returns exploratory DPM from `totalExpected` (no residual gate) → finite score on the report, **`proof=degraded-exploratory-fallback`**, `rankable=false`.

So the case is **both slow and structurally unrankable** under current exact-branch policy.

### 5. Quick harness used full-analysis detail (bench amplifier)

Production `evaluationSession` always passes `detailLevel: "score-only"`.

`runBenchmark.solveWithBudget` previously **omitted** `detailLevel` → default **full-analysis** (events/analysis/casts bookkeeping + analysis deep-clones on every snapshot). That inflated wall time without changing Leng fan-out topology.

## Safe micro-fixes landed (prior pass)

| Change | File | Effect | Risk |
|--------|------|--------|------|
| Quick bench `detailLevel: "score-only"` | `src/combat/solver/benchmarks/runBenchmark.ts` | Aligns with production search; lighter snapshots | Ranking-neutral (parity tests) |
| Intermediate merge+cap in `materializeCastPlans` when `out > 2*max` | `src/combat/engine/simulation/branch.ts` | Peak live **3206 → 192**; less giant merge arrays | Heaviest-k partial ≡ global heaviest-k; residual still disclosed |
| Skip `cloneAnalysisState` when `!keepsAnalysisLedgers` | `src/combat/engine/simulation/branchCore.ts` | Smaller score-only snapshots | Analysis unused on score-only hot path |

**Not done (would be mechanic/policy changes):** removing Leng forks, EV-only Leng, lowering production `MAX_LIVE_BRANCHES`, or relaxing residual gates.

## Sibling WIP at AFTER measure (dirty tree; not a claimed win)

Observed on disk at measure time (not asserted complete):

| Area | Paths | Measure impact |
|------|-------|----------------|
| Structural branch key | `simulation/branchKey.ts` (+ `branchCore` hook) | key **chars ~0.34×**; serializations **1.15×**; wall **not** down |
| Leng RNG / land branch | `lengRng.ts`, `lengLandBranch.ts` | snapshots still ~257k |
| Cast outer product / context | `branch.ts`, `context.ts` | peak live **131** (better than 192) |
| Runtime / hit reuse | `runtime/*`, `castHit.ts`, `hitReuse.ts`, `landHitIdentity.ts` | peers still ~15–34 ms |

## Unit gates (AFTER measure)

```text
npx vitest run src/combat/styles/melee/leng.test.ts `
  src/combat/engine/simulation/lengLandBranch.test.ts `
  src/combat/engine/simulation/branchOracle.test.ts `
  src/combat/engine/simulation/scoreOnlyParity.test.ts
```

**54/54 passed** (4 files). Correctness gates hold; performance claim does not.

## Recommended next fixes (priority)

### P0 — correctness / rankability (product)

1. **Leng EV / hybrid model for search**  
   Keep frostblades + stack **expectation** without full tree when residual would be forced; or document that Leng gear is exploratory-only until exact mass fits.  
   Today UI/search can never claim exact robust proof under dual Leng passives at 50+ ticks with cap 64.

2. **Separate “rankable residual budget” policy** (design)  
   Either raise live cap for Leng-only, merge on coarser stack bins for ranking, or accept bounded-approx scores with disclosed error bars. Do **not** silently drop residual.

### P1 — cost (keep exact tree)

3. **Prove structural `branchKey` on a cold/warm A/B**  
   Wall regressed on this single run despite fewer key chars — isolate key encode cost vs extra mergeAndCap work.

4. **Cheaper `snapshotRuntime` for score-only**  
   - Avoid `structuredClone(state)` if a field-wise clone of melee-relevant slices is enough.  
   - Skip `casts` / `recordBySeq` shells when presentation is off (verify land-time readers).  
   - Pool/reuse Map shells.

5. **Intermediate absorb in `createCastContext`**  
   Same 2×max fold as `materializeCastPlans` on `performCast` / `advanceTo` (manual path parity).

6. **Land-time expand: in-place primary + pooled secondary**  
   Already mutates heaviest in place; consider cloning **only** state/queue for light arms when residual weight &lt; ε is not acceptable but map clones dominate.

### P2 — search / harness

7. **Leng-aware explore horizon**  
   Short explore is fine; full finalize might use fewer full-horizon Leng evals or a dedicated fidelity tier (`fidelity.ts` draft exists in tree).

8. **Golden A/B on residual=0 short rotations**  
   Keep oracle tests (`lengLandBranch`, `branchOracle`) as the gate for any EV approximation.

9. **Optional: exclude `leng-icy-context` from CI wall budget** or mark as known-slow context case so suite &lt;60s stays honest without hiding the product bug.

## Reproduction

```powershell
cd C:\Users\Sonnaya\Rs3Equilibrium-worktrees\solver-performance-rewrite
$env:SOLVER_PROFILE='1'
$env:RS3_BRANCH_PROF='1'
$env:RS3_HIT_PROFILE='1'
$env:RS3_ALLOC_PROFILE='1'
npm run benchmark:solver:quick
# inspect reports/solver-benchmark-quick.json → cases[id=leng-icy-context].branchProfile
```

Related unit gates:

```text
npx vitest run src/combat/styles/melee/leng.test.ts `
  src/combat/engine/simulation/lengLandBranch.test.ts `
  src/combat/engine/simulation/branchOracle.test.ts `
  src/combat/engine/simulation/scoreOnlyParity.test.ts
```

## Code map

| Path | Role |
|------|------|
| `src/combat/solver/benchmarks/cases.ts` | Case: DW + Leng equipment/passives |
| `src/combat/styles/melee/lengRng.ts` | Pure EF×BC outcome enumeration |
| `src/combat/engine/simulation/lengLandBranch.ts` | Land expand, advance/commit/drain with soft/hard caps |
| `src/combat/engine/simulation/branch.ts` | Cast plans + materialize (outer product) |
| `src/combat/engine/simulation/branchCore.ts` | snapshot / merge / `MAX_LIVE_BRANCHES=64` / profile |
| `src/combat/engine/simulation/branchKey.ts` | structural branch key (sibling WIP) |
| `src/combat/engine/simulation/revolution.ts` | Revolution driver using materialize |
| `src/combat/solver/objective.ts` | Residual / non-exact → score hard-fail |
| `src/combat/solver/benchmarks/runBenchmark.ts` | Quick harness (now score-only) |

## Disclaimer

Numbers are single-host, single-run. Micro-fixes are **not** a marketing speed claim. Sibling AFTER measure is **not** a wall-time win (1.18× slower vs post-micro BEFORE). Residual rankability and Leng tree cost remain open product issues.
