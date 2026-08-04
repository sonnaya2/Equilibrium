# Phase 1 — Cooldowns and charges (design)

**Branch:** `grok/combat-cooldowns-charges`  
**Worktree:** `Rs3Equilibrium-worktrees/combat-cooldowns-charges`  
**Base:** `a6373b7c` (Phase 0 audit HEAD; Overpower/Berserk CD already fixed)  
**Scope:** confirmed findings only — charges + Hurricane ST CDR + OP/Berserk regression. No Leng work.

## Confirmed targets

| Item | Class | Source |
|------|-------|--------|
| Backhand / Binding Shot / Impact charges | CONFIRMED_MISSING | wiki 2026-08-04: max 2 at level 54, 15s independent recovery |
| Hurricane −3s per enemy hit (ST = 1) | CONFIRMED_MISSING | wiki Hurricane: 3s (5 ticks) per enemy hit |
| Overpower under Berserk 9s | already OK | cooldowns.ts + bloodlust.test.ts |
| Ordinary CD / groups / resets | regression | must not change |

## Charge model (smallest coherent)

Do **not** invent fake ability IDs.

### Spec (`AbilitySpec`)

```ts
/** Independent charges. Absent = single-slot via cooldowns map. */
charges?: {
  /** Fully unlocked max (2 for stun basics). */
  max: number;
  /**
   * Style level for second charge (54). When player level < this, max is 1.
   * Product default level is 99 → 2 charges.
   */
  secondChargeLevel?: number;
};
```

Wire on: `backhand`, `binding_shot`, `impact` with `{ max: 2, secondChargeLevel: 54 }`.

Fingerprint: include `charges` in `abilityBehaviorFingerprint`.

### Runtime state (`RotationState`)

```ts
/**
 * Ability key → sorted ready-at ticks of recovering charges.
 * Key = cooldownGroup ?? replacementGroup ?? id (same as CD key).
 * Length = number of recovering slots. Empty / absent = all ready.
 * Independent recovery: consuming one charge pushes one ready-at; others unchanged.
 */
charges: Readonly<Record<string, readonly number[]>>;
```

Also keep `cooldowns` for ordinary single-slot abilities. Charged abilities **do not** write the single-slot `cooldowns[key]` for their own cast (or write only for group peers if needed — prefer charges only).

### Helpers (`engine/runtime/state.ts` or `engine/runtime/charges.ts`)

- `maxChargesFor(ability, level): number` — 1 if no charges field; else 1 if level < secondChargeLevel else max.
- `pruneCharges(recovering, tick): number[]` — drop ready-at <= tick.
- `readyChargeCount(state, key, max, tick): number`
- `firstChargeReadyTick(state, key, max, tick): number` — 0 / tick if a charge ready; else min recovering.
- `consumeCharge(state, key, recoveryTicks, atTick): RotationState` — prune, if ready, push atTick+recoveryTicks, sort ascending.
- `clearCharges(state, ids)` — for Living Death-style resets if those ids ever gain charges (no-op for now).

### Legality

`firstLegalTick(state, abilityId, group?, ability?, level?)` must consider charges:

```
legal = max(gcd, ordinaryCd, chargeReadyTick)
```

Update all call sites that only pass id/group to pass ability when available, **or** resolve ability from byId in the wrapper (`cast/index`, `branch`, `simulate`, `revolution`, `context`). Prefer extending `firstLegalTick` callers that already have the `AbilitySpec`.

For charged abilities with at least one ready charge: chargeReadyTick = state.tick (or 0), so GCD alone gates.

### Cast path

`applyCastCooldown`:

1. Resolve `cdKey = cooldownGroup ?? replacementGroup ?? id`.
2. Resolve base ticks (Death Skulls / Berserk Overpower / ordinary) as today.
3. League effective ticks as today.
4. If ability has charges and maxCharges > 1 (or always when charges defined):
   - `consumeCharge(state, cdKey, ticks, candidate)` 
   - Do **not** also set `cooldowns[cdKey]` (would block second charge).
5. Else: existing `startCooldown`.

### Analysis / casts

Expose on cast record or analysis when detail allows:
- charges remaining after cast
- recovering ready-at list for that key

Minimal: after cast, state is source of truth; tests read `getState().charges`. Optional cast-record fields only if existing analysis pattern is trivial.

### Branch

- `snapshotRuntime` already `structuredClone(state)` → charges clone free.
- `branchKeyStructural` / `branchKeyJson`: encode `state.charges` deterministically.
  - For each key (JSON insertion order of the record, matching `recordNum` style for cooldowns): encode sorted recovering ready-at list.
  - Different recovery timelines → different keys; equivalent timelines merge.

### Worker

No special path if charges live only on `RotationState` (not on worker request). Identity fingerprints of abilities must include charges config via existing ability fingerprint if solver caches specs.

## Hurricane CDR (corrected)

Wiki: −3s (5 ticks) **per enemy hit** (each damaging ability-hit instance).

Wiki consistency check (full CD 20.4s = 34 ticks; −5 ticks/hit):
- Zero CD needs ~7 reductions (7 enemies without BL; body text).
- With Bloodlust, 3 enemies zero CD: only holds if hit waves stack
  (primary 3 waves + 2 secondaries x 2 waves = 7 reductions).

**Wrong (Phase 1 first pass):** once per distinct target per cast (ST always −3s only).
**Correct:** every successful hurricane ability land grants −3s (ST base −6s; BL ST −9s).

### Rules

1. Cast still starts full 20.4s CD at commit.
2. On each **landed** successful hurricane ability hit (`damage.max > 0`, not attached, not proc/bleed):
   - Reduce CD by 5 ticks: `ready = max(event.tick, ready - 5)`.
3. Multi-target later: one land call per (hit, target); no distinct-target map required.
4. No `hurricaneCdrTargets` state (ready tick on `cooldowns.hurricane` is enough for merge keys).

## Overpower / Berserk (regression only)

Already implemented. Add/ensure tests:

- OP outside Berserk → 30s
- OP inside Berserk → 9s
- Igneous OP same replacement group / 9s under Berserk
- Berserk cast while OP already cooling does **not** clear OP CD
- Berserk expiration during OP cooldown does not rewrite remaining CD
- replacementGroup shared
- Living Death / other resets still work

Do **not** mutate ability catalogue when Berserk activates.

## Files to touch (coordinator owns shared CD state)

| File | Change |
|------|--------|
| `pipeline/calculateAbility.ts` | `charges?` on AbilitySpec |
| `styles/melee/abilities.ts` | backhand charges |
| `styles/ranged/abilities.ts` | binding_shot charges |
| `styles/magic/abilities.ts` | impact charges |
| `shared/abilityFingerprint.ts` | include charges |
| `engine/runtime/state.ts` | charges field + helpers (+ firstLegalTick) |
| `engine/runtime/charges.ts` | **new** if state.ts would bloat; else keep in state |
| `engine/cast/effects/cooldowns.ts` | consumeCharge path + reduceCooldown export |
| `engine/resolution/landed/melee.ts` | Hurricane CDR |
| `engine/simulation/branchKey.ts` | encode charges (+ hurricane cdr if on state) |
| tests | new `cooldowns.charges.test.ts`, `hurricane.cdr.test.ts`, OP edge tests |

## Tests required (exit gate)

- Ordinary cooldowns unchanged (spot Assault / Sunshine group)
- Overpower dynamic CD + Igneous + existing-CD edges
- Hurricane ST −3s; Bloodlust form still −3s once
- Backhand / Binding Shot / Impact charge recovery
- Charge snapshot isolation + branch equality
- Revolution uses both charges; Manual/Revo parity
- Score-only / full-analysis parity (existing gates still pass)

## Gate

```text
npm run test:combat
npm run audit:architecture
npm run audit:comments
```

Commit **only** cooldown/charge work on this branch.

## Out of scope

- Leng / Primordial Ice WIP
- Puncture, Caroming, Chain, Haunted, ammo packing
- Multi-target Hurricane target enumeration (hook only)
- Stun/bind CC simulation
