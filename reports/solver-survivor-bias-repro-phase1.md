# Phase 1 repro: survivor-biased exploratory ranking

**Date:** 2026-08-04  
**Status:** BEFORE-FIX documented on main  
**Do not treat this as a fix.**

## Goal

Deterministically show:

1. A Revolution bar generates **substantial residual** branch mass (real engine).
2. Displayed exploratory score uses **concrete-terminal** means (`E[D|concrete]`).
3. Same proposed bar is **unrankable / worse** under trustworthy full simulation.
4. Current (residual-free) bar is **better** under the same loadout, horizon, and objective.
5. Solver pipeline can still **expose/apply** a worse residual-inflated exploratory bar via `degraded-exploratory-fallback`.

## Run

```bash
cd C:\Users\Sonnaya\Rs3Equilibrium
npx vitest run src/combat/solver/repro
# or: node reports/survivor-bias-repro.mjs
```

| File | Role |
|------|------|
| `src/combat/solver/repro/survivorBiasRanking.repro.ts` | Real dual-Leng + Impatient/Relentless fixture + `measureResidualStats` |
| `src/combat/solver/repro/survivorBiasEngine.repro.test.ts` | Real residual + `evaluateRevolutionBar` short/full |
| `src/combat/solver/repro/survivorBiasFixture.ts` | Locked mass rows + production-mirroring `EvaluateFn` |
| `src/combat/solver/repro/survivorBiasRanking.repro.test.ts` | Finalize degraded path + apply surface (mock EvaluateFn) |

---

## A. Real engine residual (Leng + Impatient + Relentless)

**Loadout**

- Melee dual wield: Dark Shard + Dark Sliver of Leng
- Perks (proposed): Impatient 4 L20 + Relentless 5 L20
- Bar (pool-legal): `icy_tempest`, `assault`, `fury`, `dismember`
- Horizon: 100 ticks (primary), 150 ticks (extreme)
- Driver: `simulateRevolution` / `evaluateRevolutionBar` score-only

### BEFORE-FIX measured values (2026-08-04, deterministic)

| Field | Proposed (Imp+Rel) | User / current (same bar, no Imp/Rel) |
|-------|-------------------:|--------------------------------------:|
| surviving concrete mass | **0.2283** | **1.0** |
| residual mass | **0.7717** (~77%) | **0** |
| totalsBasis | `known-mass-contribution` (Phase 2 primary) | `unit-mass` |
| exactness | `approximated` | exact / unit-mass |
| conditional expected damage `E[D\|concrete]` | **70047.6** | 69774.8 (= unit-mass E[D]) |
| known-mass damage `E[D\|concrete] * concrete` | **15989.8** | **69774.8** |
| survivor renorm factor `1/concrete` | **~4.38×** | 1× |
| terminalClasses | 64 (cap) | n/a |
| conserved mass | ~1 | 1 |

**Extreme (150t, proposed only):** residual **~0.956**, concrete **~0.044**, known-mass **~4688**.

### evaluateRevolutionBar (same fixture)

| Path | Proposed | User (no Imp/Rel) |
|------|----------|-------------------|
| Short explore 40t score (DPM from totalExpected) | **71016.4** (wins explore) | 69999.4 |
| Short residual mass | > 0 (finite score still emitted) | 0 |
| Full 100t `validForFinalRanking` | **false** (`simulation residualWeight=0.7717…`) | **true** |
| Full score | −∞ / unrankable | **69534.8** |
| Known-mass preference | worse | **better** (69775 ≫ 15990) |

**Bug surface (evaluate, pre-Phase 2):** short path never gated residual; exploratory DPM used survivor-conditional totals. **Phase 2:** residual / non-unit-mass explore scores are non-rankable (`−∞`); primary under residual is known-mass contribution, not conditional mean.

---

## B. Solver finalize pipeline (production-mirroring mock)

When **all** full re-scores residual-fail, `assembleResult` promotes the best **exploratory** bar as `degraded-exploratory-fallback`. That bar is what `resultBuilder` / `applyFinalDto` would adopt.

Locked mock numbers (search 40t, full diagnostic 100t, `TICK_SECONDS=0.6`):

| Field | User seed | Proposed (survivor-biased) |
|-------|----------:|---------------------------:|
| concreteMass | 0.96 | **0.15** |
| residualMass | 0.04 | **0.85** |
| conditional E[D\|concrete] | 4000 | **16000** |
| knownMassDamage | **3840** | 2400 |
| exploratory DPM | 10000 | **40000** |
| trustworthy full DPM (known-mass) | **3840** | 2400 |
| full rankable | false | false |

**Pipeline outcome (CURRENT BUG):**

- `status = degraded`
- `proof = degraded-exploratory-fallback`
- `best.bar = proposed` (**not** user)
- `validForFinalRanking = false`
- `bestExploratoryScore = 40000`, `bestFullScore = −∞`
- DTO/apply surface: `bar = proposed`, `score = 40000`

DESIRED invariant is marked `it.fails` until a fix lands (must not recommend residual-inflated exploratory over better known-mass user).

---

## Pipeline steps

1. **Short explore** (`evaluate.ts`, `durationTicks < MIN_RANKABLE_HORIZON_TICKS`): score = DPM(`totalExpected`) even when `residualWeight > 0`. Production `totalExpected` = `E[D|concrete]`.
2. **Full rescore** (`objective.scoreSummary`): hard-fail residual → not final-rankable.
3. **Finalize** (`finalize.ts` `assembleResult`): if no full-rankable shortlist entry → promote best exploratory as `degraded-exploratory-fallback`.
4. **Honesty gap**: known-mass prefers user; exploratory prefers residual-inflated proposed.
5. **Apply risk** (`resultBuilder` + `useRevolutionSolver.applyFinalDto`): worse bar still applied (`onActiveBar`); degraded is not verified-cacheable but bar is adopted.

---

## What this is not

- Not a UI warning-text change.
- Not weakening `scoreHonesty.test.ts` or residual hard-fail on full robust scores.
- Not reassigning residual mass onto survivors.
- Phase 2 landed: probability semantics + residual not rankable on explore/full.
- Phase 3 (open): incumbent user-bar full-sim gate; refuse apply of worse/degraded winners.
