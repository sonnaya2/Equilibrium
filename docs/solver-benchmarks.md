# Solver benchmarks

Permanent, deterministic Revolution solver harness for regression timing and
score fingerprints. Does **not** change solver scoring.

## Commands

```bash
npm run benchmark:solver:quick   # 4-slot subset, tiny budgets, <60s target
npm run benchmark:solver         # same as quick
npm run benchmark:solver:json    # quick + prints report path
npm run benchmark:solver:full    # all cases via solveFromRequest (slow)
```

Or directly:

```bash
node scripts/benchmarks/solver.mjs quick
node scripts/benchmarks/solver.mjs full
```

## Layout

| Path                                           | Role                                     |
| ---------------------------------------------- | ---------------------------------------- |
| `src/combat/solver/benchmarks/cases.ts`        | Case IDs + serializable request builders |
| `src/combat/solver/benchmarks/runBenchmark.ts` | Runner + JSON report writer              |
| `src/combat/solver/benchmarks/quick.test.ts`   | Vitest entry (quick)                     |
| `src/combat/solver/benchmarks/full.test.ts`    | Vitest entry (full)                      |
| `scripts/benchmarks/solver.mjs`                | CLI wrapper around vitest                |
| `reports/solver-benchmark-quick.json`          | Quick report output                      |
| `reports/solver-benchmark-full.json`           | Full report output                       |

## Case IDs

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

## Modes

### Quick

- Cases marked `quick: true` only (4-slot / context).
- Real `evaluateRevolutionBar` + `solveAsync`.
- Budget ≈ **28** evaluations (not production `TIER_BUDGETS.thorough`).
- Short horizons (`durationTicks` 50, explore 24).
- Wire `tier` field stays `"thorough"` (only real `SearchTier`); report records
  `tier: "quick@28"`.

### Full

- All case IDs.
- Production **`solveFromRequest`** with thorough tier budgets and request
  horizons as defined in cases (still short vs product UI for wall-clock).

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
- Fingerprints use `fingerprintSolveContext` so they stay aligned with the
  solution-store cache key.
- Scoring code paths are read-only; do not “fix” benches by changing objective
  weights or eligibility rules.
- Vitest files are gated on `SOLVER_BENCH` (`quick` / `json` / `full` / `1`) so
  `npm run test:solver` does not pay for the harness by default. The CLI sets
  the env automatically.
