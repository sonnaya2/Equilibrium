# Solver performance — Phase 6 event queue

**Decision: SKIP** (no code change to `src/combat/engine/runtime/events.ts`).

| Field | Value |
|-------|--------|
| **Worktree** | `Rs3Equilibrium-worktrees/solver-performance-rewrite` |
| **Target** | `EventQueue` (`events.ts`) |
| **Options evaluated** | (1) head index instead of `Array.shift`, (2) binary insert |
| **Preserve if changed** | `(tick, seq)` order, `clone`, `signature`, cancel-by-owner/seq |
| **Date (UTC)** | 2026-08-04 |

## Why skip

Phase 6 only lands if there is a **clear win without order bugs**. Microbench + live occupancy say no.

### Current structure (already near-optimal for this workload)

- **push**: linear scan from the tail + `splice` (insertion-sort style). Live scheduling is mostly append-ish future ticks, so the tail walk is short.
- **shift**: `Array.shift()` — O(n) reindex, but **n is tiny** (pending only, not history).
- **clone / signature / cancel**: operate on the live array; branch snapshots already shallow-copy events.

Binary search still ends in O(n) `splice`. Head index avoids shift reindex but adds compaction + live-slice correctness on every `pending` / `clone` / `signature` / `cancel` / `length` path — order-bug surface for branch equivalence without a measured payoff.

### Synthetic microbench (pure queue ops only)

Workload: keep a peak, drain, occasional cancel + clone. Median of 5 runs, Node on this host.

| Scenario | current | head-index | binary+shift | binary+head |
|----------|--------:|-----------:|-------------:|------------:|
| combat-typical peak ~12 | 7.55 ms | 6.48 ms (~1.17×) | 7.83 ms | 6.97 ms |
| DoT-heavy peak ~40 | 6.27 ms | 5.77 ms (~1.09×) | 6.25 ms | 6.42 ms |
| stress peak ~200 | 5.37 ms | 4.99 ms | 4.18 ms | 3.58 ms (~1.50×) |
| branch-clone heavy peak ~20 | 3.95 ms | 4.01 ms (~flat) | 4.20 ms | 4.16 ms |

Stress-size wins need peak ~200 pending. That is not the engine's shape.

### Live sim occupancy (vitest instrument on `EventQueue.push`/`shift`)

| Case | per-sim wall | queue ops/sim | peak pending | avg length at op |
|------|-------------:|-------------:|-------------:|-----------------:|
| ranged-galeshot (200×) | ~0.45 ms | ~54 | **5** | ~1.0 |
| short melee-ish (400×) | ~0.10 ms | ~18 | **8** | ~3.6 |

At peak 5–8, `Array.shift` cost is noise next to land-time resolve, ledgers, and branch `snapshotRuntime` (queue clone is one field among state/maps). A ~10–17% pure-queue microbench delta is sub-microsecond per real sim — not a clear solver win.

## Order / correctness risk (if we had shipped)

| API | Head-index footgun |
|-----|--------------------|
| `peek` / `shift` | Must use `items[head]`, not `items[0]` |
| `length` | `items.length - head`, not `items.length` |
| `pending` / `signature` | Must expose only live slice |
| `clone` | Must copy live range and reset head (or share head correctly) |
| `cancelBy*` | Filter live region; reset head; must not leave holes before head |
| branch equivalence | Wrong live view ⇒ wrong `signature` / independent cancel |

Binary insert alone does not fix shift cost and does not beat the tail-linear push when inserts land near the end (common case).

## What was not done

- No change to `events.ts`.
- No new unit tests (existing `events.test.ts` still green; 13/13).
- No solver benchmark re-run claimed as Phase 6 improvement.

## Revisit triggers

Only reconsider if profiling shows:

1. **Sustained peak pending ≫ 50** (e.g. long multi-target / many concurrent DoT+conjure tracks on long horizons), **and**
2. `eventQueueOps` time is a measurable fraction of evaluate wall clock under `RS3_ALLOC_PROFILE` / a real flamegraph,

Then prefer **head index + compact** (keep linear tail insert) over binary insert; re-verify order with `events.test.ts` + branch/oracle suite.

## Related

- Phase 0 baseline: `reports/solver-performance-baseline-phase0.md`
- Phase 1 check: `reports/solver-performance-phase1-check.md`
- Allocation counters: `src/combat/profiling/allocation.ts` (`eventQueuePush` / `Shift` / `Cancel`)
