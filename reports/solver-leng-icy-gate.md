# Solver Leng-icy hotpath gate (ruthless)

| Field | Value |
|-------|--------|
| **Branch** | `grok/leng-icy-hotpath` |
| **Worktree** | `C:\Users\Sonnaya\Rs3Equilibrium-worktrees\solver-performance-rewrite` |
| **Base** | `05b1582e` (`grok/solver-performance-rest`) |
| **Date** | 2026-08-04 |
| **Gatekeeper** | leng-icy hotpath audit after ~7 min settle |
| **Commit message** | `cut leng icy branch cost without dropping exactness` |

## Verification (must be green)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **GREEN** (after gatekeeper import/fixture fixes) |
| leng + branch + scoreOnly + scoreHonesty + evaluate | **GREEN** — 11 files / **161 passed** |
| Mandated suites | `leng.test.ts`, `lengLandBranch.test.ts`, `failedLengDrain.test.ts`, `branch.test.ts`, `branchKey.test.ts`, `branchOracle.test.ts`, `scoreOnlyParity.test.ts`, `hitReuse.test.ts`, `scoreHonesty.test.ts`, `evaluate.test.ts`, `objective.test.ts` |

## Mandated reverts / non-reverts

### 1. Shared `rt.state` — **NONE FOUND (no revert)**

- `snapshotRuntime` still does `state: structuredClone(rt.state)` with an explicit "NEVER share rt.state by ref" comment.
- Score-only still shares **immutable** `HitResult` values and empty analysis shell by ref; independent Map/array shells for mutable containers; cast result bags cloned so expected/min/max cannot leak.
- Gate tests: `snapshotRuntime score-only trim` asserts `clone.state !== rt.state`.

### 2. EV fold that changes golden/oracle damage — **NONE FOUND (no revert)**

- Leng fold is **future-state exact merge only**: same `(stacks, active frostUntil)` keys sum weights. Divergent stacks and/or frost windows still fork + snapshot.
- No damage-side EV collapse of the land hit (ledger already recorded before expand; expand is state-only).
- Compiled `lengLandTable` materialize is probability-parity with `lengLandOutcomes` (full stack/frost grid test).
- Oracle + production class counts match for dual Leng one-land and stack-cap chill cases.
- scoreOnlyParity (incl. Leng DW ranking) green.

### 3. Residual laundering as exact — **NONE FOUND (no revert)**

- `capBranches` / `mergeAndCapBranches` still set `exactness=bounded-approximation` when `residualWeight > 0`.
- Discarded mass is residual, never reassigned onto a non-equivalent survivor.
- `objective.scoreSummary` / `exactnessEligibleForExactProof` / scoreHonesty gates unchanged (hard-fail residual + non-exact lattice).
- Product law documented: `docs/solver-residual-exactness-policy.md` (reject ranking residual as verified).

## Keep list (good work)

| Area | What |
|------|------|
| **Compiled Leng land table** | Equipment-static EF×BC arms + byStartStacks; `createRuntime.lengLandTable`; zero per-land passive re-walk |
| **Future-state fold** | `normalizeLengFrostUntil` / `lengFutureStateKey`; expire-to-0 merge; chill no-op when frost already open |
| **Structural `branchKey`** | Compact multi-field key (JSON opt-in via `RS3_BRANCH_KEY_JSON=1`); queue `signature()` compact |
| **Score-only snapshot trim** | Skip events/analysis/perAbility/hits walk; never share `RotationState` |
| **Hit reuse scope** | `runWithHitReuseScope` + `landHitIdentity` for multi-branch identical land context (frost/stacks correctness gated) |
| **Intermediate absorb** | `appendWithIntermediateCap` on materializeCastPlans, createCastContext, manual simulate, combineBranchSummaries drain |
| **Docs / reports** | residual exactness policy; hotspot report update |

## Slap list

1. **SLAP — incomplete test imports on new oracle helpers.** `branchOracle.test.ts` called `normalizeLengFrostUntil` / `lengFutureStateKey` / etc. without importing re-exports → tsc red. Gatekeeper fixed imports.
2. **SLAP — `hitReuse.test.ts` illegal `style` on `CastContextInput`.** Fixture used `style: "melee"` instead of `context: { style: "melee" }`. Same class of "tests that don't typecheck are not done" as rest-gate.
3. **SLAP — nested `describe` / orphan `it` in `branch.test.ts`.** `appendWithIntermediateCap` suite was jammed inside `capBranches` with `combineExactness` stranded after the nested close. Gatekeeper re-nested.
4. **NOTE — no EV hybrid for search this pass.** Residual rankability under dual Leng + cap 64 remains open product issue; policy says prefer residual→0 path, not launder.
5. **NOTE — no fresh quick-suite wall remeasure this gate.** Prior hotspot micro-fix claimed ~13.8 s leng (post) / not a 3× claim. Do not invent wall times without a remeasure.
6. **NOTE — `tools/_phase2/` scrap still present.** Not committed (rest-gate residue).
7. **NOTE — structural branchKey is a large surface.** Parity covered by partition tests + scoreOnlyParity; keep `RS3_BRANCH_KEY_JSON=1` escape for debug.

## Do not

- Merge to main from this gate.
- Share `RotationState` by reference across branches.
- Fold divergent stack/frost mass into damage EV while claiming exact.
- Launder residual into `exact` / unlock full-objective proof under residual.
- Commit `tools/_phase2/` scrap or gitignored bench JSON.

## Commit intent

Ship Leng-icy hotpath cost cuts that preserve exactness:

- compile-once Leng table + exact future-state fold
- structural branchKey / queue signature
- score-only snapshot trim + hit reuse scope
- intermediate absorb on multi-parent paths
- residual / exactness product law doc
