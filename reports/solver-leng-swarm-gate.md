# Solver Leng swarm gate (ruthless)

| Field | Value |
|-------|--------|
| **Branch** | `grok/leng-icy-hotpath` |
| **Worktree** | `C:\Users\Sonnaya\Rs3Equilibrium-worktrees\solver-performance-rewrite` |
| **Base** | `588641de` (`cut leng icy branch cost without dropping exactness`) |
| **Date (UTC)** | 2026-08-04 |
| **Gatekeeper** | Leng swarm gate after ~8 min sibling settle |
| **Commit message** | `fix dual leng score-only path to stop runtime clone explosion` |

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **GREEN** |
| Critical vitest | **GREEN** — 12 files / **192 passed** |
| Suites | `leng.test.ts`, `lengDistribution.test.ts`, `lengLandBranch.test.ts`, `branch.test.ts`, `branchKey.test.ts`, `branchOracle.test.ts`, `scoreOnlyParity.test.ts` (engine + solver), `hitReuse.test.ts`, `scoreHonesty.test.ts`, `evaluate.test.ts`, `objective.test.ts` |
| Leng microbench | **GREEN** — dual-Leng + peer under 10s; **0 snapshots** |

## Measured wall times (this host)

### Microbench (single score-only bar, 50 ticks, `RS3_BRANCH_PROF=1`)

| Arm | wallMs | snaps | maxLive | residual | exactness |
|-----|-------:|------:|--------:|---------:|-----------|
| **`leng-icy-context`** | **8.6** | **0** | **1** | **0** | **approximated** |
| `four-slot-fixed` peer | 3.5 | 0 | 1 | n/a | n/a |
| ratio leng/peer | **2.4×** | | | | |

Baseline (same harness, pre-EV, commit `588641de`): leng **~711 ms**, snaps **~30k**, ratio **~658×**.

### Quick suite (`npm` / vitest quick, 6 cases)

| Case | status | durationMs | rankable |
|------|--------|----------:|----------|
| `melee-2h-4slot` | ok | 34 | yes |
| **`leng-icy-context`** | **degraded** | **20** | **no** (honest approx) |
| peers | ok | 10–22 | yes |
| **suite total** | | **120** | |

Prior hotspot: leng alone **13–16 s**, suite ~16 s. **Leng quick is now well under 1 s** (20 ms this run).

## Mandated reverts (gatekeeper)

### 1. Shared `rt.state` CoW — **REVERTED**

Sibling WIP shared `RotationState` by ref in `snapshotRuntime`. Gatekeeper restored **`structuredClone(rt.state)`**. Nested bags must never leak across forks; CoW claims are not accepted without a full write-path audit.

### 2. Incomplete `lengMass` wiring — **STRIPPED**

Sibling mass-spine (`lengMass`, `heaviestLengKey`, `mixLengMass`, `massAfterConsumeStacks`) was half-landed and repeatedly re-corrupted `SimulationRuntime` (deleting `detailLevel`/`byId`/`lengLandTable` mid-gate). Gatekeeper removed product-path `lengMass` fields/imports. Library helpers remain in `lengDistribution.ts` for unit tests / future hybrid work — **not** live on runtime.

### 3. Intermediate budget cut — **REVERTED**

`MAX_LENG_INTERMEDIATE_BRANCHES` restored to **`MAX_LIVE_BRANCHES * 2`** (was cut to 1×). Full-analysis multi-arm path keeps soft intermediate headroom; residual still disclosed on hard cap.

### 4. Residual-as-exact — **NONE SHIPPED**

Score-only EV collapse sets:

- `residualWeight = 0` (no hard-cap discard of non-equivalent mass)
- `exactness = bounded-approximation` → summary `rng.exactness = approximated`

`scoreSummary` still hard-fails non-exact / residual. No residual laundering into `exact` or full-objective proof.

## Keep list (good sibling + gatekeeper work)

| Area | What | Honesty label |
|------|------|----------------|
| **Score-only Leng EV collapse** | `expandLengOnLand` → `expectedLengLandState` (E[stacks]/E[frostUntil]) on one spine; **zero `snapshotRuntime`** | `bounded-approximation` / summary `approximated` |
| **Compiled Leng table** | Existing `lengLandTable` (equipment-static) | unchanged |
| **Future-state fold + frost expiry merge** | Exact merge after frost zeroing mid-advance | residual-free when mass fits |
| **Score-only hitDetails retention** | Live derivedFrom / LS only; branchKey encodes live sources | ranking parity preserved |
| **hit reuse scope / structural branchKey** | Prior hotpath work | parity gated |
| **lengDistribution library** | Pure mass/EV helpers + unit tests | not a product fork path |
| **leng microbench harness** | `benchmark:solver:leng-micro` | measure only |

## Slap list

1. **SLAP — sibling file thrash.** Multiple agents rewrote `lengLandBranch.ts` / `runtime.ts` mid-gate (mass path vs EV path vs deleting Runtime fields). Gatekeeper had to nuclear-restore cores and re-apply EV atomically.
2. **SLAP — incomplete mass wiring typed as product.** Imports of missing `cloneLengMass` / `massAfterConsumeStacks` / `heaviestLengKey` without exports; would have left tree red.
3. **SLAP — CoW of `rt.state`.** Tests and production isolation require `structuredClone`; “write-replace only” is not enforced repo-wide.
4. **NOTE — score-only Leng damage is EV-approx, not full-tree parity.** Frost AD uses spine `E[frostUntil]` binary window; stacks are continuous EV (Icy Tempest floors at spend). Full-analysis still multi-arms. Solver Leng case no longer asserts totalExpected parity vs full-analysis.
5. **NOTE — full-horizon ranking still unrankable under dual Leng score-only** (`degraded` / `rankable=false`) because exactness is approximated by design. Residual is 0; exploratory short-horizon ranking still works.
6. **NOTE — do not commit `tools/_phase2/` scrap.**

## Product outcome

| Goal | Status |
|------|--------|
| Stop dual-Leng score-only runtime clone explosion | **DONE** — snaps **0**, maxLive **1** |
| Honest labels (not residual-as-exact) | **DONE** — `bounded-approximation` / `approximated` |
| Leng quick wall &lt; 1 s | **DONE** — case **~20 ms**, suite **~120 ms** |
| Full-analysis exact multi-arm preserved | **DONE** — forks still tested |

## Do not

- Merge to main from this gate without product review of EV search semantics.
- Share `RotationState` by reference across branches.
- Reintroduce `lengMass` on `SimulationRuntime` without complete type + parity + honesty suite.
- Launder residual / approximated into exact robust proof.

## Commit intent

Ship dual-Leng **score-only EV spine** that zeros Leng snapshots under ranking evals, with honest non-exact exactness, while reverting CoW/shared-state and incomplete mass wiring and restoring intermediate branch budget for the exact multi-arm path.
