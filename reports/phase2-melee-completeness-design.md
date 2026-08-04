# Phase 2 — Melee ability completeness

**Branch:** `grok/combat-melee-phase2`  
**Worktree:** `Rs3Equilibrium-worktrees/combat-cooldowns-charges`  
**Law:** confirmed Phase 0 findings + Adaptive Strike weapon-form selection. Do not rewrite damage, Bloodlust architecture, cooldowns, provenance, or solver search.

## Confirmed / in scope

### Adaptive Strike (wiki 2026-08-04, Adaptive_Strike)

| Weapon form | Equipment | ST damage | Engine id |
|-------------|-----------|-----------|-----------|
| Main hand, no offhand | empty off-hand | 1× 120–140% | `adaptive_strike_mh` (**add**) |
| Two-handed | 2h | 1× 120–140% primary (cone multi = ST scope) | `adaptive_strike_2h` |
| Dual wield | dual weapons | 2× 60–75% | `adaptive_strike_dw` |
| MH + shield | shield | **no legal form** | null |
| MH + defender | defender | **no legal form** | null |
| Invalid / necro config | — | **no legal form** | null |

Shared ST band constant for mh/2h — no duplicated band literals.

### Selection (canonical)

```ts
adaptiveStrikeEngineId(weaponConfiguration: WeaponConfiguration): string | null
```

- Input: **`ResolvedCombatModel.weaponConfiguration` / sim `weaponConfiguration` only** — never re-read UI slots in the engine.
- Manual / Revo / solver use the **same** helper when resolving `melee:adaptive-strike` or when filtering the replacement group.
- `resolveBarSlot` must stop using bar.setup string alone as the sole truth; prefer mapped weapon config when available. Wiki revo `setup: "Two-handed"` can map to twohand; `"Any"` / missing falls through to weaponConfiguration from caller.

### Weapon requirements

- `adaptive_strike_2h`: `twohand` only  
- `adaptive_strike_dw`: `dualwield` only (not defender) — selection + eligibility must agree  
- `adaptive_strike_mh`: **exact** empty mainhand only (`weaponConfiguration === "mainhand"`)

Do **not** loosen/tighten global `mainhand` for Icy Tempest (still allows non-2h). Prefer a precise requirement for MH Adaptive Strike only, e.g. new requirement token `mainhand-empty` **or** selection-only + tight check on the MH id without changing Icy Tempest.

Recommended: `weaponRequirement: "mainhand"` on MH form and tighten selection so only one Adaptive form is offered; for cast legality, MH form must fail on shield/defender/dual/2h. Implement with:

```ts
// meetsWeaponRequirement: for adaptive_strike_mh id OR new token
// Prefer new token "mainhand-empty" => config === "mainhand" only
```

Do not change Flurry defender=dualwield semantics unless required.

### Registry / catalogue

- Register `adaptive_strike_mh` as setup-variant of `melee:adaptive-strike` (same as 2h/dw).
- `ENGINE_LINK_OVERRIDES`, fingerprint, solver eligibility same as sibling basics (full).
- Replacement group `adaptive_strike` for all three.
- `entryByRecordId("melee:adaptive-strike")` may still point at one primary; selection resolves form by weapon.

### Other Phase 0 melee items

| Item | Action |
|------|--------|
| Hurricane CDR, Backhand charges | **Done Phase 1** — do not rework |
| Bloodlust / Fury / Chaos Roar / Greater Barge / bleed chain | **FALSE_POSITIVE OK** — regression tests only |
| Pulverise kill | intentional scope — leave |
| Icy Tempest multi | intentional scope — leave |
| Overpower/Berserk CD | Phase 1 — leave |

### Support status / honesty

If MH form was missing only as selection gap, leave supportStatus full. Do not mass-relabel melee kit.

## Tests required

1. **Source-backed table** for every entry in `MELEE_ABILITIES`:
   - id, bands, hit counts, tickOffsets, channelTicks/occupancy, adren gain/cost, cooldownSeconds, charges, weaponRequirement, replacementGroup, supportStatus
2. **Adaptive Strike E2E** across weapon configs: 2h, dualwield, mainhand, shield, defender — cast legality + correct form id/bands/hits; Manual/Revo/solver selection parity where cheap.
3. **Regression:** Bloodlust thresholds, Greater Barge idle/EA, Dismember→Slaughter→Massacre chain (existing tests still green).
4. Registry tests for third setup-variant.

## Out of scope

- Ranged/Magic/Necro residual phases  
- Leng WIP  
- Damage formula / pipeline rewrite  
- Multi-target Adaptive cone damage  

## Gate

```
npm run test:combat
npm run audit:architecture
npm run audit:comments   # do not introduce new em-dashes
```

Commit **only** melee Phase 2 work.

## Post-commit

1. Full melee audit of the diff; fix issues; merge local + push.  
2. Second audit; if clean stop; if issues fix, push/merge, stop.
