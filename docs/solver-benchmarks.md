# Solver benchmarks

Permanent, deterministic Revolution solver harness for regression timing and
score fingerprints. Does **not** change solver scoring.

## Commands

```bash
npm run benchmark:solver:quick   # 4-slot subset, tiny budgets, <60s target
npm run benchmark:solver         # same as quick
npm run benchmark:solver:json    # quick + prints report path
npm run benchmark:solver:full    # all cases via solveFromRequest (slow)
npm run benchmark:solver:stochastic-stress # valid League stress matrix + matched controls
```

Or directly:

```bash
node scripts/benchmarks/solver.mjs quick
node scripts/benchmarks/solver.mjs full
```

Single case (programmatic / vitest harness): import `runBenchmark` from
`src/combat/solver/benchmarks/runBenchmark.ts` with `{ caseIds: ["…"], mode }`.

## Layout

| Path                                           | Role                                     |
| ---------------------------------------------- | ---------------------------------------- |
| `src/combat/solver/benchmarks/cases.ts`        | Case IDs + serializable request builders |
| `src/combat/solver/benchmarks/runBenchmark.ts` | Runner + JSON report writer              |
| `src/combat/solver/benchmarks/quick.test.ts`   | Vitest entry (quick)                     |
| `src/combat/solver/benchmarks/full.test.ts`    | Vitest entry (full)                      |
| `scripts/benchmarks/solver.mjs`                | CLI wrapper around vitest                |
| `src/combat/solver/benchmarks/stochasticStress.ts` | Fixed-lane and pipeline stress runner |
| `reports/solver-benchmark-*.json`              | Local report output (gitignored)         |
| `reports/solver-stochastic-stress.json`         | Latest stochastic stress report (gitignored) |
| `reports/solver-performance-*.md`              | Short baseline / phase check summaries   |

## Case IDs

### Baseline / search-shape

| ID                  | Quick? | Notes                               |
| ------------------- | ------ | ----------------------------------- |
| `melee-2h-4slot`    | yes    | Melee two-hand, fixed 4             |
| `melee-dw-4to6`     | no     | Melee dual, 4–6                     |
| `ranged-6slot`      | no     | Ranged fixed 6                      |
| `magic-6slot`       | no     | Magic fixed 6                       |
| `necro-6slot`       | no     | Necromancy fixed 6                  |
| `leng-icy-context`  | yes    | DW + Leng passives / equipment ids  |
| `igneous-context`   | yes    | 2H + Igneous Overpower cape passive |
| `four-slot-fixed`   | yes    | Melee DW fixed 4                    |
| `six-slot-fixed`    | no     | Melee DW fixed 6                    |
| `eight-slot-search` | no     | Melee DW 5–8                        |
| `ten-slot-search`   | no     | Melee DW 5–10                       |

### Phase 0 representative fixtures (performance baseline)

| ID                              | Quick? | Notes                                                                  |
| ------------------------------- | ------ | ---------------------------------------------------------------------- |
| `melee-norng-4slot`             | yes    | No-RNG melee: `crit.disabled`, no Impatient/Relentless, fixed 4        |
| `sunshine-magic`                | no     | Magic DW + Planted Feet; authored seed includes engine id `sunshine`   |
| `deaths-swiftness-ranged`       | no     | Ranged 2H + Planted Feet; seed includes `deaths_swiftness`             |
| `necro-conjures`                | no     | Necro conduit pool with `includePartial`; conjure mults + conjure seed |
| `impatient-relentless`          | no     | Melee DW 4–6 with Impatient 4 + Relentless 5 (state-changing RNG)      |
| `equipment-procs`               | yes    | Crackling 4 + Aftershock 4 invention procs, fixed 4                    |
| `league-blessings`              | no     | Valid League Leng build; global + Leng state RNG                       |
| `league-blessings-control`      | no     | Same Leng/perk build with League effects off                           |
| `league-poison-melee`           | no     | Valid Cinderbane/Laniakea/Envenomed League poison build                |
| `league-poison-melee-control`   | no     | Same poison/perk build with League effects off                         |
| `league-necro-conjures`         | no     | Valid First Necromancer conjure League build                           |
| `league-necro-conjures-control` | no     | Same conjure/perk build with League effects off                        |
| `unhinged-300s`                 | no     | **Full-only long case**: tier `unhinged`, 500 ticks (300s research)    |

## Modes

### Quick

- Cases marked `quick: true` only (4-slot / context / no-RNG / procs).
- Real `evaluateRevolutionBar` + `solveAsync`.
- Budget ≈ **28** evaluations (not production `TIER_BUDGETS.thorough`).
- Short horizons (`durationTicks` 50, explore 24) unless a case overrides.
- Wire `tier` field stays `"thorough"` (only real `SearchTier`); report records
  `tier: "quick@28"`.

### Full

- All case IDs (including Phase 0 and `unhinged-300s`).
- Production **`solveFromRequest`** with request tier budgets and horizons as
  defined in cases (still short vs product UI for most cases; `unhinged-300s`
  uses the full 500-tick / unhinged budget path).

### Stochastic stress

- Evaluates fixed, legal League builds for Leng, poison melee, necromancy conjures, Lord of Light fanout, multi-target magic, and an isolated Avernic Rampage delta.
- Runs matched controls so League overhead and state changes can be separated from the underlying rotation.
- Runs score-only and full-analysis simulations at 30, 45, and 60 ticks using the production 128-lane ensemble.
- Requires deterministic repeats, probability mass one, residual and failed mass zero, and score/full totals that agree exactly.
- Keeps the Aftershock poison variant profile-only because its authored benchmark case is not a release-supported solve; the ordinary poison case remains a release gate.
- Records lane timing, RSS/heap, event-queue depth, allocations, hit-resolution reuse, and modifier evaluation.
- Applies fixed duration ceilings on the pinned Windows x64 Node 26 runner. There is no oracle mode, live-state cap, or adaptive retry ladder.

## Report schema (per case)

| Field                | Meaning                                   |
| -------------------- | ----------------------------------------- |
| `id`                 | Case id                                   |
| `contextFingerprint` | SHA-256 of canonical solve context        |
| `tier`               | Search tier or `quick@N`                  |
| `seed`               | Deterministic seed                        |
| `bounds`             | `{ min, max }` bar size                   |
| `winnerScore`        | Best score or `null`                      |
| `evaluations`        | Total evaluations                         |
| `uniqueCandidates`   | Distinct bars seen                        |
| `durationMs`         | Wall time for the case                    |
| `rankable`           | Winner has full-horizon rankable score    |
| `status`             | `ok` \| `degraded` \| `failed` \| `error` |

Optional: `proofLabel`, `bar`, `error`.

Root report: `schemaVersion`, `mode`, `generatedAt`, `totalDurationMs`, `cases`.

## Notes

- Requests are naked serializable loadouts (engine data shapes), not live UI
  `packSolverRequest` state — equipment/passives are packed the same way
  production workers expect (`equipmentIds` + `equipmentEffects.passiveIds`).
- Ability ids in seeds (`sunshine`, `deaths_swiftness`, `conjure_*`, etc.) come
  from the engine catalogue under `src/combat/styles/**/abilities.ts`.
- Impatient / Relentless ranks live on `loadout.adrenaline`; invention procs on
  `loadout.procs`; league blessings via `resolveLeagueRules` + `serializeLeague`.
- Fingerprints use `fingerprintSolveContext` so they stay aligned with the
  solution-store cache key.
- Scoring code paths are read-only; do not “fix” benches by changing objective
  weights or eligibility rules. Do **not** lower production `TIER_BUDGETS` in
  product code for fixtures.
- Vitest files are gated on `SOLVER_BENCH` (`quick` / `json` / `full` / `1`) so
  `npm run test:solver` does not pay for the harness by default. The CLI sets
  the env automatically.
