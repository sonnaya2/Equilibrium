# Combat reachability summary

Generated: 2026-08-04T08:07:02.134Z

## Stats
- Combat files: 372
- Production: 206
- Tests: 166
- Orphan candidates: 10
- Duplicate export names: 405
- Production-reachable (graph): 195

## Public barrel
- Star/named re-export modules: 43
- Banned leakage hits: 0 (none)
- Not on allowlist: 0

## Record->engine map
- Pairs parsed: 82 (from src/combat/abilities/engineMap.ts)
- Multi-record engines (aliases): 2
- Link overrides: 37

## Worker keep (never deletionsRecommended)
- `src/combat/solver/worker/revolutionSolver.worker.ts`

## Orphans / manual review
- `src/combat/engine/simulation/branchOracle.ts` - reachable only from tests **[uncertain]**
- `src/combat/engine/simulation/ultimateStarvation.ts` - reachable only from tests **[uncertain]**
- `src/combat/engine/simulation/vigourForensic.ts` - reachable only from tests **[uncertain]**
- `src/combat/equipmentSets/index.ts` - no production importers found (may be dynamic/data - manual review)
- `src/combat/profiling/index.ts` - no production importers found (may be dynamic/data - manual review)
- `src/combat/solver/benchmarks/lengMicrobench.ts` - reachable only from tests **[uncertain]**
- `src/combat/solver/benchmarks/runBenchmark.ts` - reachable only from tests **[uncertain]**
- `src/combat/solver/search/independentOracle.ts` - reachable only from tests **[uncertain]**
- `src/combat/solver/worker/checkpoint.ts` - no production importers found (may be dynamic/data - manual review)
- `src/combat/styles/ranged/ammo.ts` - no production importers found (may be dynamic/data - manual review)

## Deletions recommended (static graph only; confirm dynamic imports)
- src/combat/equipmentSets/index.ts
- src/combat/profiling/index.ts
- src/combat/solver/worker/checkpoint.ts
- src/combat/styles/ranged/ammo.ts

## Reports
- reports/combat-symbol-reachability.json
- reports/combat-ability-registry.json
- reports/combat-record-fallbacks.json
- reports/combat-duplicate-definitions.json
- reports/combat-public-api.json
