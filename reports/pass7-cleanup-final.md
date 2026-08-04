# Pass 7 — Cleanup and architecture gates (final report)

Generated: 2026-08-04  
Repo: RS3 Equilibrium  
**HEAD:** `37087df7` (`chore(combat): Pass 7 cleanup and architecture gates`)

---

## Commits created

| SHA | Message |
|-----|---------|
| `907d4276` | `feat(combat): Pass 6 Analysis uses ResolvedCombatModel one-cast simulate` |
| `37087df7` | `chore(combat): Pass 7 cleanup and architecture gates` |

Base before this work: `be091510` (merge leng-icy-hotpath).  
Related prior: `674a30e8` Pass 3–5 ResolvedCombatModel + shared sim packing; `fe4e20e0` catalogue + passive/set support manifests.

---

## Before → after architecture

### Before (debt remaining after Pass 1–5)

```text
UI Analysis/Quick ──► style ability arrays (MELEE_ABILITIES, …)
UI fingerprint     ──► solverSnapshotFromUi(CalcStats + Loadout) fallback
Parity tests       ──► legacy hand-built simulate/simulateRevolution + cape transform
Architecture gate  ──► layer bans only; no style-array / registry uniqueness
```

### After (Pass 6–7)

```text
Generated facts          CombatDataCatalogue (Maps)
Record ↔ engine          engineMap.ts + ABILITY_REGISTRY
Passive metadata         PassiveRegistry (definitions + registry)
Pre-tick-zero rules      ResolvedCombatModel
Mutable combat           SimulationRuntime + RotationState
Events / eligibility     DamageProvenance + capabilitiesOf
Manual / Revolution in   buildSimulationInputBase + toManual*/toRevolution*
Solver compile           compileEvaluationContext
Result identity          canonicalSimulationIdentity / packSimBaseFromModel
Single-cast Analysis     analyzeSingleCast → one-cast simulate(model)
UI ability palettes      engineSpecsForStyle / registry (not style arrays)
Solver pack (UI)         packSimBaseFromModel only (no CalcStats+Loadout reconstruct)
Strength Cape            resolveAbilityCatalogue only
```

---

## Files changed per pass

### Pass 6 (`907d4276`) — 7 files

| File | Change |
|------|--------|
| `src/combat/model/singleCastAnalysis.ts` | **new** — analyzeSingleCast / overlay / limitations |
| `src/combat/model/singleCastAnalysis.test.ts` | **new** |
| `src/combat/test/integration/analysis_single_cast_parity.test.ts` | **new** |
| `src/combat/model/index.ts` | exports |
| `src/combat/engine/simulation/contracts.ts` | `startingResidualSouls` |
| `src/combat/engine/runtime/runtime.ts` | seed souls; lantern from equipment only |
| `src/components/combat/AnalysisTab.tsx` | model + one-cast Analysis UI |

### Pass 7 (`37087df7`) — 19 files

| Area | Files |
|------|--------|
| Architecture gates | `scripts/architecture/{detect,check,check.self-test}.mjs` |
| UI catalogue | `QuickCalculator.tsx`, tests |
| Snapshot removal | `solverSnapshot.ts`, `uiSimFingerprint.ts` + tests; Rotation/Revo fingerprint callers |
| Legacy parity | `manual_revo_sim_parity.test.ts`, `compiledContext.test.ts` |
| Pack tests | `packRequest.bounds/regions.test.ts`, identity/format tests |
| Reachability | `reports/combat-reachability.md` |

---

## Removed duplicate authorities

| Removed / retired | Surviving authority |
|-------------------|---------------------|
| Style ability array imports in combat UI production | `engineSpecsForStyle` / `ABILITY_REGISTRY` |
| `solverSnapshotFromUi` (CalcStats+Loadout reconstruct) | `solverSnapshotFromResolvedModel` + `packSimBaseFromModel` |
| Fingerprint fallback without model | `combatModel` required on fingerprint |
| Legacy dual-arm Manual/Revo builders in parity tests | `buildSimulationInputBase` + catalogue |
| Duplicate Strength Cape in tests/oracles | Sole production call: `resolveAbilityCatalogue` → `withStrengthCape99Dismember` |
| Architecture allowlist for style catalogues | Empty; array imports hard-fail |

**Not removed (still load-bearing):**

- Residual `presentPassive` switch (4 enchantment labels) — not a second support registry
- `SET_SUPPORT_BY_ID` in `equipmentSets/support.ts` — sole set-support authority
- `mapSpecsThroughCatalogue` — used by revolution bar soft-resolve
- `provenanceFromLegacy` — still used by league damage path
- Style ability modules themselves (engine registry builds from them)

---

## Passive completeness

| Concern | Status |
|---------|--------|
| Support badges / lifecycle | `PASSIVE_DEFINITIONS` + `PassiveRegistry` only (`single-passive-registry` gate) |
| Set effect support | `equipmentSets/support.ts` only (`SET_SUPPORT_BY_ID`) |
| Presentation | Default path registry-backed; residual switch for champion/stalker/channeller/enduring-ruin labels only |
| Second registry | **None** — gate fails if `PASSIVE_DEFINITIONS` defined outside `passives/**` |

---

## Parity results (no unexplained numerical differences)

### Manual / Revolution (Pass 4 + Pass 7)

```text
src/combat/test/integration/manual_revo_sim_parity.test.ts  — 8 passed
src/combat/test/integration/manual_revo_modifier_parity.test.ts — 4 passed
```

New-path smoke only (legacy dual-arm removed). Strength Cape increases Dismember EV vs no-cape; manual-stat expected &lt; full use-build with ultimatums/vuln; determinism holds.

### Solver bridge / identity (Pass 5)

```text
src/combat/test/integration/solver_bridge_parity.test.ts — 9 passed
src/components/combat/solverSnapshot.parity.test.ts — 6 passed
src/components/combat/combatResultIdentity.test.ts — 9 passed
```

`projectSerializableSimBase(model)` ≡ `packSimBaseFromModel(model)` ≡ model-derived snapshot pack for canonicalSimulationIdentity.

### Analysis (Pass 6)

```text
src/combat/test/integration/analysis_single_cast_parity.test.ts — 9 passed
src/combat/model/singleCastAnalysis.test.ts — 8 passed
```

For no-prior-state Attack / Dismember / Assault: `analyzeSingleCast` metrics match one-cast `simulate` (by construction + dual-call tests). Stateful cases (command, icy tempest, champion ring, volley) labeled; failed casts do not invent EV.

---

## Architecture gates (Pass 7)

| Rule | Status |
|------|--------|
| `ui-no-style-catalogues` | Array imports banned; factories (`volleyOfSouls`, etc.) allowed |
| `no-linear-id-lookup` | Structural `.find` on catalogues / record bags |
| `single-passive-registry` | passives/** only |
| `single-record-engine-map` | engineMap.ts only for `RECORD_TO_ENGINE` |
| `solver-no-loadout` | Named ban |
| `solver-no-ui-stats` | loadoutStats / toResolvedCombatModel / solverSnapshot |
| `import-cycle` | Hardened model ↔ packRequest |
| `runtime-no-data-build` | app/** no sqlite/scripts/data |
| `barrel-leakage` | Hardened |

```text
npm run audit:architecture:self-test  → all assertions passed
npm run audit:architecture            → [OK] 480 files, 0 violations
```

---

## Reachability audit

```text
npm run audit:combat-reachability
files=372  production=206  tests=166
orphans=10  production-reachable=195  pairs=82
barrel leakage hits=0
```

### Orphan classification

| Path | Class |
|------|--------|
| `branchOracle.ts`, `ultimateStarvation.ts`, `vigourForensic.ts` | **Test-only** (diagnostics) |
| `lengMicrobench.ts`, `runBenchmark.ts`, `independentOracle.ts` | **Test-only** / bench |
| `revolutionSolver.worker.ts` | **Public API** (dynamic worker entry; keep) |
| `equipmentSets/index.ts` | **Public re-export barrel** — review before delete |
| `profiling/index.ts` | **Data-driven/dynamic** possible; review |
| `solver/worker/checkpoint.ts` | **Uncertain** — may be dynamic; do not auto-delete |
| `styles/ranged/ammo.ts` | **Actually dead?** candidate — confirm before delete |

**No automatic deletions of orphans** in Pass 7 (static graph only).

---

## Performance

Solver quick benchmark (`npm run benchmark:solver:quick`):

| Case | Status | Score | evals | ms |
|------|--------|-------|-------|-----|
| melee-2h-4slot | ok | 100767.93 | 30 | 32 |
| leng-icy-context | degraded* | 124012.14 | 30 | 21 |
| igneous-context | ok | 100767.93 | 30 | 16 |
| four-slot-fixed | ok | 101510.89 | 30 | 13 |
| melee-norng-4slot | ok | 95970.29 | 30 | 8 |
| equipment-procs | ok | 116824.06 | 30 | 11 |

\*Leng degraded/unrankable is existing solver residual policy (not introduced here).  
`totalMs≈111` for 6 cases.

No Pass 7 claim of score parity with a prior baseline without a stored before snapshot — scores reported as measured now only.

---

## Final verification matrix

| Check | Result |
|-------|--------|
| Focused Pass 6/7 tests | Pass |
| `npx vitest run src/combat` | **1760 passed**, 3 skipped |
| Solver tests | **282 passed**, 3 skipped |
| `src/components/combat` | **278 passed** |
| Integration | **52 passed** |
| Architecture audit | **OK** |
| Architecture self-test | **OK** |
| Combat reachability | **OK** (report written) |
| `tsc --noEmit` | **OK** |
| Production `npm run build` | **OK** (Next 16.2.11) |
| Solver quick bench | **OK** |
| Full `npx vitest run` | **2512 passed**, **2 failed** (see below) |

### Pre-existing failures (not combat Pass 6–7)

`src/research/canonicalData.test.ts` (2 tests):

1. `research-region-entries desert|upgrades` ordinal includes `100` (park ordinal) — not contiguous 0..n-1  
2. entity `recordRef` count 4818 vs expected 4824  

Verified: **same failures with combat changes stashed**. Data/canonical debt, outside Pass 7 scope. Do not claim full-suite green until data team fixes ordinals/provenance counts.

---

## Verified mechanics fixes in this workstream

| Fix | Notes |
|-----|--------|
| Analysis SSOT = one-cast simulate on ResolvedCombatModel | Pass 6 |
| No invented Soulbound Lantern when residualSouls &gt; 3 | Clamp to equipment-true cap |
| Volley UI souls clamp ≥ `VOLLEY_MIN_SOULS` | No render throw |
| Model-only solver packing from UI fingerprint | Pass 7 |

---

## Remaining partially modeled mechanics

(Unchanged product inventory; not expanded in Pass 7)

- Abilities with `supportStatus` partially-modeled / not-modeled / mechanics-unverified  
- Live windows (Berserk/Sunshine) as Analysis context — labeled when relevant; empty-start is honest zero  
- Leng residual / degraded solver proofs under icy dual-wield budgets  
- Residual presentation switch for a few enchantment labels  
- `provenanceFromLegacy` still on some league paths  

---

## Remaining architectural risks

1. **UI still imports factories** from `styles/*/abilities` (`volleyOfSouls`, `resplendentAsphyxiate`, `isMeleeAbility`) — allowed by array-only gate; long-term move factories next to registry if desired.  
2. **`packSimBase(snapshot)`** remains for intermediate snapshots; production fingerprint uses `packSimBaseFromModel`. Snapshot branch in packer still exists for tests.  
3. **Orphan candidates** listed above — confirm dynamic imports before delete.  
4. **Canonical data test debt** (ordinal 100, recordRef counts) — full suite not green.  
5. **Soft import cycles** (info: 3) — not model↔packRequest hard failures.  
6. **Giant passive presentation switch** largely already shrunk; remaining 4 cases are product copy, not a support registry.

---

## Done criteria checklist

| Goal | Met? |
|------|------|
| Remove temporary adapters / obsolete paths listed | **Yes** (production) |
| One authority per concern table | **Yes** |
| Architecture gates extended | **Yes** + self-test |
| Reachability run + classify before delete | **Yes** (no reckless deletes) |
| Focused + combat + solver + arch + reachability + typecheck + build + solver bench | **Yes** |
| Full test suite | **Combat-related green**; 2 pre-existing research/data failures |
| No unexplained numerical differences in parity tests | **Yes** (all parity tests pass exactly / by construction) |

**Pass 7 complete** for combat authority cleanup. Uncommitted leftovers: `reports/data-architecture-audit.md`, `reports/data-platform-benchmark.md` (unrelated generated audits).
