# Phase 6 notes: event queue structure

Status: measure + design only. No hot-path rewrites in this doc.

Source: `src/combat/engine/runtime/events.ts`  
Related: `src/combat/profiling/allocation.ts` (`noteEventQueuePush` / `Shift` / `Cancel`)

## Role

`EventQueue<RT>` holds pending `ScheduledEvent`s resolved at **land** time against that tick's runtime (buffs not frozen at cast unless carried on `castSnap`). Ordering is total:

```text
(tick ascending, seq ascending)
```

`seq` is monotonic per run and is the same-tick tiebreak (cast flow: hits by hit-index, then on-cast effects). Branches share event *values* but each branch resolves against its own `RT`; events must not close over a runtime.

## Current structure: sorted array

Backing store: `private items: ScheduledEvent<RT>[]` kept sorted.

| Op | Implementation | Cost (n = queue length) |
| -- | -------------- | ------------------------- |
| `push` | walk back from end while prev is not strictly before event; `splice(i, 0, event)` | O(n) compare + O(n) insert |
| `peek` | `items[0]` | O(1) |
| `shift` | `items.shift()` | O(n) (reindex remaining) |
| `maxTick` | linear scan | O(n) |
| `cancelByOwner` / `cancelBySeq` | `filter` rebuild | O(n) |
| `pending` | expose array | O(1) view |
| `clone` | `[...items]` shallow | O(n) |
| `signature` | JSON of structural fields (no `resolve` closures) | O(n) |

Typical sim path: many pushes (scheduled hits / DoTs / procs), then drain with repeated `shift` as the clock advances. Both ends are array-heavy: insert mid-list and front removal.

## Allocation counters

When allocation profiling is on (`setAllocationProfiling(true)` / `RS3_ALLOC_PROFILE=1`):

- `eventQueuePush` / `eventQueueShift` / `eventQueueCancel` (cancel counts removed events)
- `eventQueueOps` = sum of those ops

Phase 0 baselines can show how often the queue is touched relative to bar evaluate cost; Phase 6 should re-measure after any structure change.

## Phase 6 options

### A. Binary heap (min-heap by tick, then seq)

- `push` / `shift` O(log n); no `Array.shift` reindex
- Cancel-by-owner/seq still O(n) unless lazy-delete + tombstones
- Need stable comparison matching current `(tick, seq)` total order
- Clone still O(n) unless structural sharing

### B. Tick buckets

- Map/array of tick -> ordered seq list (or ring of pending ticks)
- Advance clock: drain current tick's list in seq order (often O(k) for k events that tick)
- Push to future tick: O(1) amortized if seq is append-only within tick
- Cancel may need secondary index by owner/seq
- Empty-tick sparse spans must not dominate (sparse map vs dense array)

### C. Hybrid

- Bucket by tick, small in-bucket array (n per tick usually tiny)
- Or heap of non-empty tick heads only

Pick by measured `eventQueueOps` shape (many short-lived events vs deep multi-tick backlog), not theory alone.

## Correctness constraints

1. **Order must match** `(tick, seq)` exactly -- same land order as today for same schedule.
2. **`signature()`** must stay branch-merge-safe: any field that changes land-time damage or eligibility that is currently in the fingerprint stays in it when the structure changes.
3. **Clone semantics**: branch snapshots get a queue that will not mutate the parent's pending list; shallow event sharing is OK only while events remain immutable after enqueue.
4. **Do not merge branches without proven equivalence.** Queue structure is orthogonal to branch merge: merging two states requires equal pending-event signatures (and other branch keys). Faster queues must not invite looser merge keys or drop residual/exactness accounting. Prove heap/bucket behavior against current `EventQueue` tests and branch oracle paths before switching the production type.

Out of scope here: hit-expectation sort-once (Phase 5), score-only detail, compiled context.
