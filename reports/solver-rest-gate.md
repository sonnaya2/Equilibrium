# Solver rest-of-plan gate (ruthless)

| Field | Value |
|-------|--------|
| **Branch** | `grok/solver-performance-rest` |
| **Worktree** | `C:\Users\Sonnaya\Rs3Equilibrium-worktrees\solver-performance-rewrite` |
| **Base** | `e1450fd4` (main / PR #1 merge) |
| **Date** | 2026-08-04 |
| **Gatekeeper** | rest-phase audit after ~7 min settle |

## Verification (must be green)

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | **GREEN** |
| `npx vitest run src/combat/solver src/combat/pipeline src/combat/engine/simulation/scoreOnlyParity.test.ts src/combat/engine/runtime/registry.test.ts` | **GREEN** — 40 files passed / 2 skipped; **322 passed / 2 skipped** |
| scoreOnlyParity (engine + solver) | **GREEN** (incl. Leng DW ranking parity) |
| pool / coord / host lifecycle | **GREEN** |

## Mandated reverts / non-reverts

### 1. Budget / horizon cuts — **NONE FOUND (no revert)**

| Constant | Value | Cut? |
|----------|------:|------|
| `TIER_BUDGETS.thorough` | 2_400 | no |
| `TIER_BUDGETS.extreme` | 4_000 | no |
| `TIER_BUDGETS.unhinged` | 10_000 | no |
| `TIER_HORIZON_SECONDS.thorough` | 24 / 90 s | no |
| `TIER_HORIZON_SECONDS.extreme` | 36 / 150 s | no |
| `TIER_HORIZON_SECONDS.unhinged` | 36 / 300 s | no |

- Multi-fidelity **partitions** the same total budget (short 65% / medium 35% when total ≥ 32); does **not** lower `TIER_BUDGETS`.
- Pool global budget = `perAgent * agentCount` — **preserves Phase-0 total capacity**.
- Full finalize horizon unchanged; medium is intermediate screen only (`validForFinalRanking` always false).

### 2. Shared RotationState snapshots — **NONE FOUND (no revert)**

- `snapshotRuntime` still does `state: structuredClone(rt.state)`.
- What *did* land (kept): share **immutable** `HitResult` / spirit meta **values** by ref; independent Map shells. Analysis deep-clone only when full-analysis ledgers are kept; score-only shares empty analysis shell.
- Intermediate merge+cap in `materializeCastPlans` (Leng peak live-branch control) — **kept** (not a shared-state shortcut).

### 3. Broken incomplete protocol — **FIXED (not wholesale-reverted)**

| Issue | Action |
|-------|--------|
| Dual `seenKeys` redeclare + overwrite in `progressReporter.emitProgress` | **Fixed**: single drain path — prefer `coord.drainSeenKeys()`, else `pendingSeenKeys` |
| `pendingSeenKeys` required but optional / uninit | **Fixed**: optional + `(state.pendingSeenKeys ??= []).push` |
| `coord_report` host handler without worker emitter | **Kept** (forward-compatible); live path uses `progress.seenKeys` |
| `tier: "quick"` / invalid ability category in winner tests | **Fixed** |
| Dead `phase !== "finalize"` after medium branch (tsc) | **Fixed** |

Protocol **not** ripped out: host coord + visited/incumbent/stop + unique honesty is wired and tests green.

## Gatekeeper fixes applied this pass

1. Wire `abilityRegistry` through `evaluateRevolutionBar` → `simulateRevolution` (runtime reuse was incomplete).
2. Progress / unique key drain redeclare fix.
3. tsc-clean winner presentation + solveFromRequest fidelity branch.
4. `pendingSeenKeys` optional-safe push.

## Keep list (good remaining work)

| Area | What |
|------|------|
| **Runtime reuse** | `AbilityRegistry` on simulate input; `createRuntime` skips map rebuilds when present |
| **Compiled context** | Session compile-once catalogue / byId; evaluate consumes it |
| **Score-only + winner** | Search score-only; one full-analysis winner presentation re-sim; ranking score not rewritten |
| **Snapshot trim** | Immutable hitDetails/spirit meta value share; score-only analysis share; cast clone cache |
| **Leng branch peak** | Intermediate merge+cap in `materializeCastPlans` |
| **Global uniques** | Host visited set, authoritative when `seenKeys` stream; pool metrics honesty |
| **Host coord** | Global eval budget, incumbent, soft-stop, straggler cancel; message-batch only |
| **Multi-fidelity** | short → medium screen → full finalize; budgets partitioned not cut |
| **UI core reserve** | `RESERVES_UI_CORE` with `shouldReserveUiCore` (no agent-count drop when cores tight) |
| **Docs / reports** | multi-fidelity design, phase6 skip (event queue), rest remeasure, leng hotspot |

## Slap list

1. **SLAP — incomplete abilityRegistry land.** createRuntime supported registry; evaluate never passed it until gatekeeper. Half-shipped "runtime reuse".
2. **SLAP — dual seenKeys protocol.** Parallel agents stacked `pendingSeenKeys` drain *and* `coord.drainSeenKeys` with a redeclared `const` (tsc fail / second write clobber). Incomplete protocol surface.
3. **SLAP — winnerPresentation fixtures.** Used illegal `tier: "quick"` and `category === "threshold"` against AbilitySpec unions. Tests that don't typecheck are not done.
4. **SLAP — dead control-flow in solveFromRequest.** `else if (phase !== "finalize")` after exclusive finalize/medium branches (tsc TS2367).
5. **SLAP — concurrent patch scripts in `tools/_phase2/`.** Agent cjs/txt scrap left in tree; **not committed**. Use the product sources, not patch residue.
6. **SLAP — rest-phase report claimed pool fail on reservedCore.** Tree already had updated pool tests; gate re-run is green. Don't freeze gate status from a mid-edit dirty tree.
7. **NOTE (not slap) — multi-fidelity is behavioral.** Not a budget cut, but changes eval mix when budget ≥ 32. Keep measured; don't market as free speedup without medium-stage benches.
8. **NOTE — coord_report is optional dead path.** Host accepts; workers never post. Prefer `progress.seenKeys` as the real wire until report messages are needed.
9. **NOTE — no 3× claim.** Rest remeasure ~1.7× suite wall vs phase0; leng still dominates. See `reports/solver-performance-rest-phase.md`.
10. **NOTE — Phase 6 event queue skipped correctly.** No `events.ts` change; microbench not a clear win. See `reports/solver-performance-phase6-event-queue.md`.

## Do not

- Merge to main from this gate.
- Lower `TIER_BUDGETS` / full horizons for speed theater.
- Share `RotationState` by reference across branches.
- Commit `tools/_phase2/` patch scrap or gitignored bench JSON.

## Commit intent

Ship remaining rest-phase work on `grok/solver-performance-rest` only:

- global uniques + host coord honesty
- full-analysis winner presentation
- runtime registry reuse + snapshot trim
- multi-fidelity stage (partitioned, not cut)
