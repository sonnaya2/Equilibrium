# Phase 1 residual mass measure (real engine)

**Date:** 2026-08-04  
**Cap:** `MAX_LIVE_BRANCHES = 64`  
**Source of truth:** `src/combat/solver/repro/survivorBiasRanking.repro.ts` + `survivorBiasEngine.repro.test.ts`

## Fixture

- Dual Leng, bar: `icy_tempest`, `assault`, `fury`, `dismember`
- Impatient 4 L20 + Relentless 5 L20 (proposed) vs same bar without those perks (user)
- `simulateRevolution` / `evaluateRevolutionBar` score-only

## Measured (Phase 2 semantics)

Primary totals under residual are **known-mass contribution**, not E[D|concrete] as unit-mass.

### Primary (100t, Imp+Rel)

| Field | Value |
|-------|------:|
| concreteMass | ~0.228 |
| residualWeight | ~0.772 |
| totalsBasis | `known-mass-contribution` |
| exactness | `approximated` |
| conditionalConcreteMean | ~70048 |
| knownMassExpectedDamage / totalExpected | ~15990 |
| user clean totalExpected (no Imp/Rel) | ~69775 unit-mass |

### Extreme (150t)

| Field | Value |
|-------|------:|
| residualFraction | ~0.956 |
| knownMass / totalExpected | much lower than conditional mean |

Re-measure:

```bash
npx vitest run src/combat/solver/repro/survivorBiasEngine.repro.test.ts --reporter=verbose
```

See also `reports/solver-survivor-bias-repro-phase1.md` and `reports/solver-probability-semantics-phase2.md`.
