# Solver WASM + WebGPU feasibility

Status: **docs only**. Not scheduled. Not a Phase 0–7 work item.
Scope: whether native-ish backends can ever help Revolution solver throughput
without breaking exact combat parity.

Related: score-only (`docs/solver-score-only-design.md`, Phase 3), compiled
context (`docs/solver-compiled-context-design.md`, Phase 4), benches
(`docs/solver-benchmarks.md`). Map WebGPU (`docs/map-rendering.md`) is
**renderer-only** and is not a precedent for porting the combat engine.

## Default assumption

**Do not assume GPU or WASM is faster.** Thorough search is dominated by
branchy control flow, Maps/sets, event-queue scheduling, and per-eval setup —
not dense linear algebra. Upload/readback, kernel launch, JS↔native call
overhead, and parity validation often erase arithmetic wins. Measure end-to-end
(including host↔device transfer) against the same golden scores, or do not
ship.

## Where time actually is (shape)

| Work | Character | Native-friendly? |
| ---- | --------- | ---------------- |
| Catalogue / map rebuilds per bar | setup, Maps | Clean in TS first (Phase 4) |
| Full analysis ledgers on search | allocation | Clean in TS first (Phase 3) |
| Revolution + event queue + RNG branches | irregular, stateful | Poor GPU fit |
| Hit formula / expected damage | integer floor chain, dense-ish | Possible flat batch only |
| Search outer loop (beam, evo, LNS) | decision + memo | Stay in TS/worker |

Phases 3–4 and related TS hot-path cleanup remove the obvious waste. Until
those land and are re-profiled, native ports target the wrong layer.

## WASM

**Gate:** only after the TypeScript hot path is cleaned (score-only search,
compiled evaluation context, measured allocation/setup cuts). Porting today's
evaluate path freezes inefficiency into a second language.

Constraints if revisited:

| Topic | Note |
| ----- | ---- |
| Call overhead | Tiny kernels lose to JS→WASM boundary; need large pure compute slabs per call |
| Floor parity | Same stepwise `floor` chain as TS; never collapse `floor(A*B*C)` into one floor |
| Branchy control flow | Cast prep, readiness, queue order, style buckets — poor WASM SIMD story |
| Workers | Solver already uses worker isolation; WASM would sit *inside* a worker, not replace orchestration |
| SIMD | Useful only for contiguous numeric batches (e.g. hit-expectation vectors), not Maps/events |
| Bundle size | Extra `.wasm` + glue; justify only if e2e Thorough wall time improves on real budgets |

WASM is a **last-mile arithmetic** option for a cleaned, isolated numeric core —
not a rewrite of `evaluateRevolutionBar` or the event engine.

## WebGPU

**Allowed shape only:** flat batch kernels with independent work items.

Candidates (theoretical):

- **Batched hit expectation** — many hits, shared modifiers, pure numeric
  outputs; no mutation of runtime state.
- **Independent bar batch** — N fully serialized bars scored in parallel only
  if each bar's sim is already a self-contained numeric package (post score-
  only + compile). Still requires exact parity with CPU path.

**Never port to shaders:**

- Map-heavy catalogue / ability-id tables as GPU state machines
- Event queue, land-time scheduling, branch merge
- Full Revolution driver / `createRuntime` / immutable style patches

Those remain host (TS or WASM). Shader code that reimplements control flow will
be wrong, untestable, and slower under real branch counts.

Map route already uses WebGPU for rendering; solver kernels would be a separate
pipeline with mandatory **CPU fallback** when adapter is missing (same honesty
as map `no WebGPU`, not silent wrong scores).

## Parity and measurement (non-negotiable)

1. **Exact integer / floor parity** with the combat model: stepwise floors,
   crit layers, caps — golden bars and proof labels must match CPU bit-for-bit
   on expected totals used for ranking (or documented IEEE exceptions with
   golden gates).
2. **CPU fallback always** — Thorough must complete correctly without GPU.
3. **E2E timing** includes: buffer upload, dispatch, readback, host decode, and
   result merge into search. Kernel-only microbenches are not success criteria.
4. **Fingerprint / winnerScore** on quick + representative full cases must hold
   vs the post–Phase 3/4 baseline before any speed claim.

## Recommendation

| Item | Decision |
| ---- | -------- |
| Phase | **Phase 8 only** (after TS hot-path phases deliver and re-baseline) |
| 3× Thorough target | **Not on the critical path** — hit 3× via score-only, compiled context, memo/setup, search waste cuts first |
| Near-term action | None. Do not scaffold WASM crates or compute shaders for the solver |
| Reopen when | Profiling shows a dominant, regular numeric slab after Phases 3–4+; then prototype one batch hit-expectation kernel with parity harness |

**Summary:** Keep the solver in TypeScript (and existing workers). Treat WASM
as optional numeric offload after cleanup. Treat WebGPU as optional flat
batches only. Neither is required to reach the Thorough 3× goal.
