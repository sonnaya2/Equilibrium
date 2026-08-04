# Phase 5 notes: hit expectation / modifier sorts

Status: measure + design only. No hot-path rewrites in this doc.

Sources:

- `src/combat/pipeline/calculateHit.ts` (`exactMean`, `runPass`, `calculateRawHitBand`)
- `src/combat/pipeline/modifierPipeline.ts` (`orderModifiers`, `runPipeline`)
- `src/combat/profiling/hitPipeline.ts` (counters)
- `src/combat/profiling/hitPipeline.test.ts` (identity checks)

## Current math path

Single-hit expectation:

```text
band (optional Precise min raise)
  -> endpoint runPass probes (min/max, crit min/max, uncapped maxes)
  -> exactMean(non-crit) [and exactMean(crit) when p > 0]
  -> chance-weighted E, optional uncapped exactMean if cap can clip
```

`exactMean(min, max, critMult, input, cap)`:

1. `count = max - min + 1` (throws if `count > 100_001`)
2. `recordIntegerBandPoints(count)`
3. For each inclusive integer `roll` in `[min, max]`: `total += runPass(roll, ...)`
4. Return `total / count`

So expectation is the uniform integer-band mean of **per-roll** pipeline + Damage Potential + floor + optional cap. Partial caps are exact; ends are not averaged then capped.

`runPass` always goes through `runPipeline` -> `orderModifiers` (fresh `[...modifiers].sort` by `STAGE_ORDER` then `priority`), then filter `applies`, then reduce `apply`. Crit injects `core:critical-damage` at the critical stage for crit passes only.

Floor chain stays per stage / `mulFloor` / DP floor / cap -- never collapsed to one product floor.

## Counters (`hitPipeline.ts`)

Measure-only when `setHitPipelineProfiling(true)` or `RS3_HIT_PROFILE=1`.

| Counter | Meaning |
| ------- | ------- |
| `modifierSorts` | each `orderModifiers` / `runPipeline` sort |
| `integerBandPoints` | sum of band widths walked by `exactMean` |
| `endpointPasses` | min/max (and crit / uncapped-bound) `runPass` probes outside the band loop |
| `hitExpectationCalls` | entries into `calculateRawHitBand` / expectation |

Recording sites:

- `recordModifierSort` in `orderModifiers`
- `recordIntegerBandPoints(count)` once per `exactMean`
- `recordEndpointPass(2)` for min/max; +2 when crit bounds; +2 for uncapped max probes
- `recordHitExpectationCall` at start of `calculateRawHitBand`

## Identity today: sorts = endpoints + band points

Because every `runPass` sorts once, and every band point is one `runPass`, and endpoint probes are also `runPass`es:

```text
modifierSorts === endpointPasses + integerBandPoints
```

Pinned in `hitPipeline.test.ts`:

- No crit, band 1100..1300 (201 pts): `endpointPasses=4`, `integerBandPoints=201`, sorts `205`
- Crit chance 0.5: `endpointPasses=6`, band points `402` (non-crit + crit), sorts `408`

If cap clipping forces uncapped `exactMean`s, band points (and sorts) rise again; identity still holds.

## Phase 5 plan (performance, math-preserving)

1. **Sort once per expectation shape** -- cache ordered modifier list (or ordered non-crit + crit-with-mult lists) for a given input modifier set + crit path; reuse across endpoint probes and every band roll. Drop the O(band width) re-sorts without changing apply order.
2. **Oracle retention** -- keep inclusive integer-band `exactMean` (or a proven-equivalent closed form only where floors/caps cannot diverge). Partial-cap and floor-chain cases stay exact vs current goldens / `calculateHit` tests.
3. **No floor-chain collapse** -- do not rewrite multi-stage `mulFloor` / intermediate floors into a single product. Stage order and intermediate rounding remain the combat contract (`docs/combat-model.md`).
4. **Keep counters** -- after sort-once, expect `modifierSorts` to fall toward O(endpoint shapes) (or O(1) per pass kind), while `integerBandPoints` and `hitExpectationCalls` stay meaningful band-walk metrics. Re-assert tests once the identity deliberately changes.

Out of scope here: event queue (Phase 6), branch merge policy, score-only thinning.
