# Combat ability verification — Phase 0

**Status:** complete evidence audit (no production repairs)  
**Generated:** 2026-08-04  
**Branch:** `audit/ability-mechanics`  
**HEAD:** `a6373b7c524c1809d463feb1e54f507f015cd359` (base main `e505b7f5`)  
**Registry inventory:** 87 engine abilities (see `reports/ability-mechanics-audit/inventory.json`)  
**Architecture / reachability:** `npm run audit:architecture` OK; `npm run audit:combat-reachability` OK  

**Law for this phase:** prove or reject defects. Do not implement production combat behavior here.

**Workstreams run:** melee source+runtime · ranged source+runtime · magic source+runtime · necromancy source+runtime · cooldowns/charges · derived damage · passives/equipment · resolved model · solver/support · Manual/Revo/solver parity · adversarial synthesis.

**Classification vocabulary**

| Tag | Meaning |
|-----|---------|
| `CONFIRMED_BUG` | Code contradicts authoritative live mechanics or its own honesty labels |
| `CONFIRMED_MISSING` | Required live mechanic absent from runtime (not just residual notes) |
| `INTENTIONAL_SCOPE_LIMIT` | Documented product limit (ST model, outgoing-only, multi-target out) |
| `FALSE_POSITIVE` | Alleged defect; evidence shows correct or already fixed |
| `SOURCE_CONFLICT` | Authoritative sources disagree |
| `NEEDS_IN_GAME_VERIFICATION` | Insufficient current evidence |

---

## Confirmed and high-priority findings (do not bury)

### P0 — Solver honesty

| ID | Class | Summary | Layer | Repair phase |
|----|-------|---------|-------|--------------|
| `death_skulls_igneous` | **CONFIRMED_BUG** | Base `death_skulls` is `partially-modeled` (ST bounce only). Igneous variant has **no** `supportStatus` → treated as **full** and **solver-eligible by default** while modeling the same ST gap. | `styles/necromancy/abilities.ts` + `abilities/registry.ts` eligibility | Phase support-label / eligibility (tiny) |
| Catalogue path silent downgrade | **FALSE_POSITIVE** (guard exists) | `resolveBarSlot` prefers engine registry; `specFromRecord` refuses multi-hit/channels and stamps partial. Engine wins for all registry ids. | `data/specs.ts` | None |
| Partial default exclusion | **FALSE_POSITIVE** | `solverEligible` + `candidatePool` fail-closed unless `includePartial`. | `registry.ts`, `solver/candidatePool.ts` | None |

### P1 — Confirmed missing runtime mechanics

| ID / system | Class | Expected (wiki / product) | Actual | Repro design | Layer | Phase |
|-------------|-------|---------------------------|--------|--------------|-------|-------|
| **Hurricane CD reduce** | **CONFIRMED_MISSING** | −3s CD per enemy hit; primary is hit → ST should still −3s | Always starts full 20.4s CD | Cast Hurricane at tick T; assert `cooldowns.hurricane === T + ticks(17.4)` not `T + ticks(20.4)` | `cast/effects/cooldowns.ts` / landed | Melee runtime |
| **Backhand charges** | **CONFIRMED_MISSING** | 2 charges @ 54 Attack, independent recovery on 15s | Single CD slot; no charge map | Cast twice inside 15s at legal level; expect second cast legal | `RotationState` + branchKey + CD | Charges system |
| **Binding Shot charges** | **CONFIRMED_MISSING** | Wiki: second charge at rank/level gate | Single 15s CD | Same as Backhand | charges | Charges system |
| **Impact charges** | **CONFIRMED_MISSING** | Wiki: second charge | Single 15s CD | Same | charges | Charges system |
| **Puncture / Splintering arrows** | **CONFIRMED_MISSING** | Stacks +1% AD/stack, cap 250, 30s | Helpers only in `ranged/onHit.ts`; comment “damage integration pending”; **not** on `RangedRotationState`; not landed | Equip splintering; multi-hit rotation; stack EV vs 0 | ammo + landed/ranged | Ranged |
| **Caroming → Ricochet / Chain** | **CONFIRMED_MISSING** | +4%/rank Ricochet; Chain secondary formula | Pure helpers in `shared/perks.ts`; **no call sites**; residual notes admit gap | Loadout caroming rank; assert ricochet hit bands change | perks → modifiers | Ranged/Magic |
| **Command Vengeful Ghost / Haunted** | **CONFIRMED_MISSING** | Command applies Haunted (+10% all attacks, cap 20% Necro AD) | Documented in notes only; **no ability id**, no haunted state | Conjure ghost → command → later hits +% | necro conjure/command | Necro |
| **Death Spark (Omni Guard)** | **CONFIRMED_MISSING** | Every 5th basic doubles (catalog text) | No combat implementation | Equip Omni Guard; 5 basics | passive | Necro / equipment |
| **Soul Reave** | **CONFIRMED_MISSING** | Live combat entity (product checklist) | Zero combat code/entity | — | — | Confirm product scope |
| **Ammo on Revo / Solver** | **CONFIRMED_MISSING** (propagation) | Deathspore etc. should reach Optimize if product scope | `SimulateInput.ammo` Manual-only; omitted from `SimulationInputBase` / serializable sim / identity | Manual Deathspore free-cast works; Revo same bar does not | model + packRequest | Model packing |
| **Flanking perk** | **CONFIRMED_MISSING** | Rank formula exists | No loadout/sim wiring | — | perks | Equipment |

### P1 — Confirmed bugs / label bugs

| ID | Class | Summary | Phase |
|----|-------|---------|-------|
| `death_skulls_igneous` full label | **CONFIRMED_BUG** | Same ST limit as partial base; solver-included by default | Label + eligibility |
| Several “full” labels with residual multi/CC gaps | **CONFIRMED_BUG** (honesty) if product claims full; else reclassify as intentional | e.g. `hurricane` (CD), `backhand` (charges), `ricochet` (Caroming), `pulverise` (kill adren documented residual). Phase 4: `chain` / `greater_chain` / `claws_of_guthix` / `tsunami` already `partially-modeled` | Label hygiene |

### P2 — Intentional scope limits (honest or documented)

| Item | Class | Notes |
|------|-------|-------|
| **Chain / Greater Chain copy** | **INTENTIONAL_SCOPE_LIMIT** (honest partial) | Primary hit only; `supportStatus: partially-modeled`. Multi-target next-ability copy not claimed (needs multi-target identity). Do not re-open as missing honesty. |
| **Claws of Guthix debuff** | **INTENTIONAL_SCOPE_LIMIT** (honest partial) | Cast band modeled; `partially-modeled`. Defence −5% / affinity +2 not modeled (no dynamic DP recompute). No fake damage mult. |
| **Blast diffusion boots** | **MODELED** (Phase 4) | `blast-diffusion-inner-wrath` → Blast Infused / Inner Wrath: Wild Magic arms 10 ticks; magic basics +8% base. |
| Tsunami crit-adren +8%/crit 30s | **PARTIALLY-MODELED** (Phase 4) | Bernoulli adren branches on land (not `critChance*8` EV). Residual only: AoE secondaries, Glacial Embrace cost, Lightning Surge nested crit-adren |
| Spectral Scythe 25% soul roll | **INTENTIONAL_SCOPE_LIMIT** | Helper exact; deterministic sim excludes RNG soul |
| Soul Strike splash | **INTENTIONAL_SCOPE_LIMIT** | ST primary only |
| Death Skulls multi-target bounce | **INTENTIONAL_SCOPE_LIMIT** | ST bounce path only (partial on base) |
| Bloat on-death spread | **INTENTIONAL_SCOPE_LIMIT** | Recast cancel OK; death spread out |
| Blood Siphon channel AoE | **INTENTIONAL_SCOPE_LIMIT** | Finisher-only ST |
| Conjure Spirit Pact / ghost heal / army custom | **INTENTIONAL_SCOPE_LIMIT** | Partial notes |
| Icy Tempest multi splash | **INTENTIONAL_SCOPE_LIMIT** | ST primary + splash-on-primary |
| Dark bow / Gloomfire basic transform | **INTENTIONAL_SCOPE_LIMIT** | Explicit residual note; not separate AbilitySpec |
| Corruption Shot/Blast multi spread | **INTENTIONAL_SCOPE_LIMIT** | Independent decay bands; no multi-target spread |
| Corruption lineage as derived-from-resolved-parent | **INTENTIONAL_SCOPE_LIMIT** | Independent scaled bands, not `derivedHits` (unlike Bloat/DS) |
| Pulverise kill +50% adren / Pulverised debuff | **INTENTIONAL_SCOPE_LIMIT** | Constant dead code; notes admit absence |
| Stun/bind/CC (Backhand, Binding, Impact, RF) | **INTENTIONAL_SCOPE_LIMIT** | Outgoing damage sim |
| Attached damage recursion / fake stacks | **FALSE_POSITIVE** | Provenance + tests guard SW/Aftershock/Lightning Surge |

### P2 — False positives (claimed issues that are OK)

| Claim | Class | Evidence |
|-------|-------|----------|
| Berserk → Overpower 9s CD | **FALSE_POSITIVE** | Fixed on this branch: `cooldowns.ts` + tests + finding file |
| Overpower hit delay +3 | **FALSE_POSITIVE** | `tickOffset: 3` on OP / Igneous |
| Fury / Greater Fury consume rules | **FALSE_POSITIVE** | prepare + castHit + tests |
| Chaos Roar hit scope | **FALSE_POSITIVE** | channel first / multi all / bleeds |
| Bloodlust thresholds (Assault/Hurricane/Flurry) | **FALSE_POSITIVE** | prepare + tests |
| Dismember→Slaughter→Massacre chain | **FALSE_POSITIVE** | enables/recastOf + 40t window |
| Greater Barge idle + Endless Assault | **FALSE_POSITIVE** | prepare path + tests (opener idle policy separate) |
| Adaptive Strike 2h/DW ST bands | **FALSE_POSITIVE** | Match wiki; MH-only folds to same 120–140 band |
| Living Death CD clear / DS 17t under LD | **FALSE_POSITIVE** | necro effects + tests |
| Death Skulls ST bounces + crit inheritance | **FALSE_POSITIVE** | derivedHits path |
| Bloat recast cancel + 25% tails | **FALSE_POSITIVE** | cancelByOwner + derived |
| Command Skeleton Rage / Putrid dismiss | **FALSE_POSITIVE** | schedulers + cast effects |
| Only zombie poison | **FALSE_POSITIVE** (correct) | poison track zombie-only |
| Searing Winds cast boundary + RF extend | **FALSE_POSITIVE** | prepare snap + land |
| Shadow Imbued adren + Tendrils extend | **FALSE_POSITIVE** | cast + land |
| Deathspore free cast | **FALSE_POSITIVE** | spendOf + land stacks |
| Piercing → Snipe CDR | **FALSE_POSITIVE** | landed/ranged |
| Runic Charge triad (Sonic/DB/CB) | **FALSE_POSITIVE** | off-GCD + prepare |
| Dragon Breath × Combust | **FALSE_POSITIVE** | land-time mult |
| Sunshine / GSunshine / Planted Feet | **FALSE_POSITIVE** | timing + PF strip DoTs |
| Instability / Lightning Surge EV | **FALSE_POSITIVE** | land-check + non-recursive |
| Manual/Revo/solver shared catalogue | **FALSE_POSITIVE** | `buildSimulationInputBase` + parity tests |
| Score-only ranking physics (non-Leng) | **FALSE_POSITIVE** | scoreOnlyParity tests |
| Spec → registry → catalogue | **FALSE_POSITIVE** | all 87 in catalogue |

### Source conflicts / NIGV

| Item | Class | Detail |
|------|-------|--------|
| Dismember per-hit band | **SOURCE_CONFLICT** | Infobox/table 25–35 vs some body prose 25–31; engine uses 25–35 |
| Greater Barge idle % | **SOURCE_CONFLICT** | Tooltip/table +5–7 vs some prose 5–12; engine matches table |
| Fleeting CDR on basic attack | **NEEDS_IN_GAME_VERIFICATION** | Code reduces Snipe from `ranged_attack` when Fleeting; docs emphasize Piercing only |
| CB stack recast carry-over | **NEEDS_IN_GAME_VERIFICATION** | Recast CB does not clear stacks |
| Combust last tick vs DB window half-open | **NEEDS_IN_GAME_VERIFICATION** | `tick < until` excludes cast+30 |
| Corruption Shot first hit @0 vs Blast @+2 | **NEEDS_IN_GAME_VERIFICATION** | Offset asymmetry not pinned to one wiki table |
| Adaptive Strike MH+shield / defender form | **NEEDS_IN_GAME_VERIFICATION** | Product uses 2h vs DW only; wiki “main hand no offhand” same band as 2h ST |
| Soul Reave product scope | **NEEDS_IN_GAME_VERIFICATION** | Name may be dead/renamed; confirm live ability before implementing |
| Haunted eligible damage families / cap units | **NEEDS_IN_GAME_VERIFICATION** | When implementing Command Ghost |

---

## Candidate checklist results (compact)

### Cooldowns and charges

| Check | Result |
|-------|--------|
| Berserk changes Overpower CD | **OK** (fixed; FALSE_POSITIVE if re-alleged) |
| Hurricane reduces CD after hitting | **CONFIRMED_MISSING** (ST should −3s) |
| Backhand / Binding Shot / Impact second charge | **CONFIRMED_MISSING** |
| Charge timers / branchKey / snapshot | **CONFIRMED_MISSING** (no charge state) |
| Dynamic CD + replacement groups | **OK** (OP, DS, greater pairs) |
| Living Death CD resets | **OK** |

### Melee

| Check | Result |
|-------|--------|
| MH-only Adaptive Strike id | No third id; ST band same as 2h → **FALSE_POSITIVE** / label polish |
| Adaptive forms 2h / DW | **OK** |
| MH+shield / defender | **NEEDS_IN_GAME_VERIFICATION** (likely same ST band) |
| Greater Barge idle + Endless Assault | **OK** |
| Fury / Greater Fury / Chaos Roar | **OK** |
| Bloodlust variants | **OK** |
| Dismember / Slaughter / Massacre | **OK** chain |
| Icy Tempest / Leng / Frostblades | **OK** ST path; multi **scope** |
| Pulverise kill adren | **INTENTIONAL_SCOPE_LIMIT** |

### Ranged

| Check | Result |
|-------|--------|
| Splintering / Puncture | **CONFIRMED_MISSING** (helpers only) |
| Dark bow / Gloomfire basic | **INTENTIONAL_SCOPE_LIMIT** |
| Caroming on Ricochet / GR | **CONFIRMED_MISSING** |
| Piercing → Snipe CDR | **OK** |
| Fleeting on auto | **NIGV** |
| Searing Winds / RF extend | **OK** |
| Shadow Imbued / Tendrils | **OK** |
| Deathspore | **OK** |
| Snap Shot / Bombardment CD 1.8s | **OK** as coded (GCD-length) |
| Corruption Shot lineage | Independent DoT bands; multi-spread **scope** |

### Magic

| Check | Result |
|-------|--------|
| Tsunami crit-adren | **PARTIALLY-MODELED** Bernoulli adren; residual AoE / GE / LS nested only |
| CB stacks land/consume | **OK** happy path; edges **NIGV** |
| Runic Charge | **OK** |
| Dragon Breath + Combust | **OK** |
| Sunshine / GSunshine / PF | **OK** |
| Instability / Lightning Surge | **OK** |
| Chain / Greater Chain copy | **INTENTIONAL partial** primary-only; multi-target identity out of scope |
| Claws of Guthix accuracy | **INTENTIONAL partial** cast band only; no DP recompute / no fake mult |
| Blast diffusion boots | **MODELED** blast-diffusion-inner-wrath + Blast Infused window |
| Corruption Blast lineage | Independent bands; spread **scope** |

### Necromancy

| Check | Result |
|-------|--------|
| Command Vengeful Ghost / Haunted | **CONFIRMED_MISSING** |
| Death Spark / Soul Reave | **CONFIRMED_MISSING** |
| Guard specials | Death Grasp **OK**; Omni/Death Spark **MISSING** |
| Soul Sap grant boundary | Cast-time ST grant — **scope** |
| Spectral Scythe soul chance | Partial deterministic — **scope** |
| Soul Strike splash | **scope** |
| Zombie-only poison | **OK** |
| Commands require spirit | **OK** (3 commands) |
| Skeleton Rage / Zombie dismiss | **OK** |
| Bloat refresh/cancel | **OK** |
| Death Skulls + LD | **OK** ST; multi **scope** |
| Living Death resets | **OK** |

### Damage lineage / attached

| Check | Result |
|-------|--------|
| Corruption Shot/Blast as single resolved parent | **INTENTIONAL** independent decay (not Bloat-style derived) |
| Bloat / Death Skulls derived | **OK** |
| Attached cannot fake procs/stacks/crit recursion | **OK** (guards + tests) |

### Static-model propagation

| Path | Result |
|------|--------|
| Loadout → Host → Resolved → Manual | **OK** |
| → Revolution | **OK** except **ammo** |
| → Solver serializable / identity | **OK** except **ammo**, **charges** |
| Equipment basic variants / igneous / cape | **OK** |
| Strength Cape Dismember | **OK** catalogue-only transform |

### Solver honesty

| Check | Result |
|-------|--------|
| Partial excluded by default | **OK** |
| `includePartial` explicit | **OK** |
| Incomplete passives demote verification | **OK** when support registry complete |
| Score-only vs full-analysis | **OK** ranking surface (Leng residual separate) |
| Winner re-sim full-analysis | **OK** by design |
| Manual/Revo same catalogue | **OK** |
| Igneous DS eligibility | **CONFIRMED_BUG** |

---

## Inventory summary

| Style | Count | Partial (honest field) | Notes |
|-------|------:|------------------------|-------|
| Melee | 24 | 0–1 (Icy may be full on dirty tree) | Committed inventory: see JSON |
| Ranged | 17 | 0 | Several multi/Caroming still labeled full |
| Magic | 23 | 4 (`chain`, `greater_chain`, `claws_of_guthix`, `tsunami`) | Phase 4: honest partials + Blast Infused modeled; not optimistic full |
| Necromancy | 23 | ~11–12 | Conjures, scythe, skulls, bloat, siphon |
| **Total** | **87** | **~15 partial** | `solverEligibleDefault` reduced by 3 magic partials vs pre-Phase-4 |

Full field dump (bands, hits, offsets, adren, CD, groups, records, solver flags):

- `reports/ability-mechanics-audit/inventory.json` (regenerate: `npx tsx scripts/combat/_export-ability-audit-inventory.ts`)

### Reachability: style specs → consumers

| Consumer | Path | Status |
|----------|------|--------|
| `ABILITY_REGISTRY` | `abilities/registry.ts` from style arrays + `volleyOfSouls(3)` | All 87 |
| Shared catalogue | `resolveAbilityCatalogue` | All engine ids present |
| Manual | `buildSimulationInputBase` + rotation | Same catalogue |
| Revolution | `toRevolutionInput` | Same; **no ammo** |
| Solver | `packSimBaseFromModel` / serializable base | Same; **no ammo** |
| Engine-first bar slots | `resolveBarSlot` | Engine before record adapter |
| Record fallback | `specFromRecord` | Single-hit only + forced partial |

**No silent multi-hit → one-hit conversion** for registry abilities: multi-hit records are rejected by `specFromRecord` (`hitCount !== 1` → null).

### Known residual / not engine abilities

| Item | Status |
|------|--------|
| Bladed Dive, Dive, pre-CSM removals | Out of kit |
| Command Vengeful Ghost | Notes only |
| Darkfang basic | Residual note |
| Caroming / Flanking / Puncture | Helpers only |
| Blast diffusion / Blast Infused | **Modeled** via `blast-diffusion-inner-wrath` passive + runtime window (Phase 4) |
| Chain / Greater Chain multi-target copy | Honest partial: primary only (Phase 4); multi-target identity still out |
| Claws of Guthix Defence/affinity | Honest partial: cast band only (Phase 4); no dynamic DP recompute |

---

## Minimal reproduction templates (for CONFIRMED items)

All repros use **public** `simulate` / `simulateRevolution` / `createCastContext` — not internal mocks alone.

### R1 — Hurricane CD −3s (ST)

```text
Input: melee loadout, startingAdren 25+, cast hurricane at candidate T
Expected: cooldowns["hurricane"] = T + secondsToTicks(17.4)
Actual:   T + secondsToTicks(20.4)
Timeline: CD start at commit; no land-time CD patch
Mismatch: missing −3s for primary hit
Source: wiki Hurricane
Layer: cast/effects/cooldowns.ts or landed/melee
Phase: melee runtime
Test: cooldowns ready tick assertion
```

### R2 — Backhand second charge

```text
Input: Attack ≥ 54, adren, cast backhand at T=0 and again at T=3 (GCD)
Expected: second cast ok
Actual: rejected (still on CD)
Layer: need charges[] on RotationState + branchKey
Phase: charges system
```

### R3 — Puncture stacks

```text
Input: ammo splintering, multi piercing_shot
Expected: damage rises with stacks
Actual: flat bands; puncture never in state
Layer: ranged onHit helpers unused
Phase: ranged ammo
```

### R4 — death_skulls_igneous solver eligibility

```text
Input: solver palette necro with igneous-death-skulls passive
Expected: DS excluded unless includePartial (same as base)
Actual: igneous DS in default pool
Layer: abilities.ts supportStatus
Phase: label fix (trivial)
Test: registry.solverEligibleDefault / candidatePool
```

### R5 — Ammo not in Revo/solver identity

```text
Input: identical model; Manual with deathspore vs Revo pack without ammo
Expected: same free-cast economy if product intends parity
Actual: Manual can free-cast; Revo/solver cannot express ammo
Layer: SimulationInputBase / packSimBaseFromModel / identity
Phase: model packing
```

### R6 — Haunted missing

```text
Input: conjure_vengeful_ghost then hypothetical command
Expected: subsequent hits +% capped
Actual: no command ability; no haunted state
Layer: necro abilities + modifiers
Phase: necro command
```

---

## Proposed repair phases (do not implement in Phase 0)

| Phase | Scope | Items |
|-------|-------|-------|
| **0.5 Label honesty** | Specs only | `death_skulls_igneous` partial; optional partials: chain, claws, hurricane note, backhand note, ricochet Caroming |
| **1 Charges** | Runtime state + branchKey + tests | Backhand, Binding Shot, Impact |
| **2 Melee residual** | Hurricane ST −3s CD | + optional Pulverise kill if kill detection exists |
| **3 Ranged residual** | Puncture wire or quarantine; Caroming wire or quarantine | Fleeting auto NIGV first |
| **4 Magic residual** | Chain/CoG honesty partials; Blast Infused via boots passive; Tsunami crit-adren Bernoulli | **Done 2026-08-04:** Chain/GChain primary-only + partial labels; CoG cast-band partial (no DP recompute); Blast Infused modeled; Tsunami Bernoulli adren. Residual only multi-target Chain copy, CoG DP, Tsunami AoE/GE/LS nested |
| **5 Necro residual** | Command Ghost + Haunted; Death Spark decision | Keep ST skulls/bloat partials honest |
| **6 Model packing** | Ammo (+ charges if any) through Resolved → Manual/Revo/Solver/identity | Parity tests |
| **7 Adversarial re-pass** | Re-run this report classifications | Full test gates |

---

## Confidence notes

- **Working tree:** local Leng WIP may be dirty (`icyTempest.ts`, `primordialIce*`, prepare/branch paths). Phase 0 conclusions for Overpower/Berserk/CD and inventory are based on **committed** tree + live style tables as imported by registry at audit time. Re-export inventory after Leng lands.
- **Wiki:** live pages fetched 2026-08-04 for melee table/Assault/Berserk/Overpower; other styles primarily code+residual notes+tests. Repair phases must re-fetch wiki before implementation.
- **No production combat behavior was modified in Phase 0.**

---

## Stop

Phase 0 deliverable complete: this report.  
Next step is human prioritization of P0–P2, then evidence-gated repairs only.
