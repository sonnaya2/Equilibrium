# Solver performance — Phase 1 integration check

**Status: INTEGRATION / VERIFY only.**  
Wall times are a rough comparison against the Phase 0 baseline. **No 3× (or any speedup) claim.** Numbers are single-host, single-run snapshots.

| Field | Value |
|-------|--------|
| **Base commit** | `28c72c72` (`measure solver performance baseline before optimize`) |
| **Branch** | `grok/solver-performance-rewrite` |
| **Worktree** | Dirty — Phase 1 parallel agent edits + integration fixes uncommitted |
| **Date (UTC)** | 2026-08-04 (bench `2026-08-04T02:38:12.271Z`) |
| **Mode** | `quick` (`npm run benchmark:solver:quick`) |
| **Quick budget** | `evaluationBudget=28` (tier label `quick@28`) |
| **Host** | Node (same machine as phase0), win32 x64, AMD Ryzen 9 9950X |
| **JSON artifacts** | Local only (gitignored); regenerate via `npm run benchmark:solver:quick` |
| **Phase 0 baseline** | [`solver-performance-baseline-phase0.md`](./solver-performance-baseline-phase0.md) |

## Verification results

| Check | Result |
|-------|--------|
| `npx vitest run src/combat/solver` | **GREEN** — 30 passed, 2 skipped files; **245 passed / 2 skipped** tests |
| `npx vitest run src/combat/profiling` | **GREEN** — 2 files, **5 passed** |
| `npx tsc --noEmit` | **GREEN** (exit 0) |
| `npm run benchmark:solver:quick` | **GREEN** — 6 cases, wrote `reports/solver-benchmark-quick.json` |

Skipped: `benchmarks/full.test.ts`, `benchmarks/quick.test.ts` under the plain vitest solver glob (quick harness is exercised via `npm run benchmark:solver:quick`).

## Integration fixes applied (this pass)

Only merge/wiring breakages; no algorithmic rewrites beyond call-site repair.

1. **`evaluationSession.ts` → `evaluateRevolutionBar`**  
   Sibling work passed a `compiled` property that is **not** on `RevolutionEvalRequestWithMemo` / contracts. Design doc still marks full compiled-context consumption as **Phase 4**.  
   **Fix:** stop passing `compiled`; keep session-level `compileEvaluationContext` only to embed `compiled.catalogue` into `sim` (harmless; evaluate still rebuilds maps per bar). Wire `eligibilityMemo` from sibling as intended.

2. **`emitProgress` signature**  
   Progress throttle added `activeChanged` as the **4th** argument. Call sites still used `emitProgress(options, state, activeChanged)`, which treated strip changes as `force`.  
   **Fix:** `emitProgress(options, state, false, activeChanged)`.

3. **`localSearch.ts` duplicate `seen`**  
   Transient mid-edit parse error (`const seen` twice) during parallel agent writes; **already clean** on disk when re-verified (barKey-deduped neighbor gen + hard cap 48).

## Wall time vs Phase 0 (rough)

Profile flags **off** (same as phase0 wall-clock baseline).

| Metric | Phase 0 | Phase 1 check | Δ |
|--------|--------:|--------------:|--:|
| **Suite total (ms)** | **23 239** | **23 756** | **+517 (~+2%)** |
| Cases | 6 | 6 | — |
| Status mix | 5 ok / 1 degraded | 5 ok / 1 degraded | same |
| Rankable | 5 / 6 | 5 / 6 | same |

### Per-case duration (ms)

| Case | Phase 0 | Phase 1 | Δ ms | Score (both) | Status |
|------|--------:|--------:|-----:|-------------:|--------|
| `melee-2h-4slot` | 41 | 45 | +4 | 100767.93 | ok |
| `leng-icy-context` | 23 081 | 23 604 | +523 | 124752.84 | degraded |
| `igneous-context` | 32 | 31 | −1 | 100767.93 | ok |
| `four-slot-fixed` | 37 | 30 | −7 | 101510.89 | ok |
| `melee-norng-4slot` | 14 | 13 | −1 | 95970.29 | ok |
| `equipment-procs` | 22 | 22 | 0 | 116824.06 | ok |

- Winner bars and context fingerprints **unchanged** vs phase0 (score-identical on all six cases).
- Suite wall time still dominated by **`leng-icy-context` (~23.6 s)** with `degraded-exploratory-fallback` / unrankable; not explained by eval count (still 30/28).
- Fast cases remain ~13–45 ms under the tiny budget. Deltas are **noise-scale** for this harness; **do not** treat +2% as a regression budget failure or as evidence of a win.

## Phase 1 work integrated (descriptive — not a speed claim)

| Area | What landed |
|------|-------------|
| **localSearch** | Neighbors unique by `barKey`; drop redundant adjacent-swap loop; origin reserved; hard cap 48 after profile batch |
| **constructiveBeam** | Per-generation `seenChildKeys` on `barKey`; partial fingerprint via `barKey` |
| **tryEval / types** | Cache hit returns without re-sim; single fingerprint join for cache + `toScoredBar` |
| **fingerprint** | Shared `barKey()`; optional precomputed key on `fingerprintEvaluationKey` |
| **eligibility** | Session `EligibilityMemo` LRU; `evaluateRevolutionBar` accepts optional memo |
| **progress** | Throttle: eval interval 16 / wall 50 ms / active strip every 8; score improvements always emit |
| **evaluationSession** | Session catalogue compile into sim; eligibility memo; barKey for seenBars + memo |
| **compiledContext** | Builder present + tests; **not** fully consumed inside evaluate (Phase 4 design) |

## Gaps / follow-ups (not fixed here)

- Full **Phase 4** path: optional `compiled` on eval request, skip per-bar catalogue Map rebuild + cape walk; engine `abilityRegistry` reuse.
- `leng-icy-context` wall-time dominance remains open (same as phase0).
- Thorough / full suite not re-run in this check.
- Worktree still dirty; no speed-marketing thresholds changed.

## How to reproduce

```text
npx vitest run src/combat/solver
npx vitest run src/combat/profiling
npx tsc --noEmit
npm run benchmark:solver:quick
```

## Disclaimer

**No 3× claim.** Phase 1 integration is **green** on tests/types; wall clock is **approximately flat** vs phase0 within run noise. Further optimization phases must re-measure before asserting gains.
