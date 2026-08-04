# Ability mechanics audit

Evidence-based audit of every combat ability in the Equilibrium engine registry.

**HEAD at seed:** see `inventory.json` → `headSha`  
**Repo:** https://github.com/sonnaya2/Equilibrium  
**Law:** no production change without authoritative evidence, full runtime path inspection, minimal sim repro, demonstrated mismatch, and a focused regression test.

## Layout

| Path | Role |
|------|------|
| `inventory.json` | All engine abilities + checklist status |
| `melee.md` / `ranged.md` / `magic.md` / `necromancy.md` | Style wave summaries |
| `findings/` | One file per closed OK or proven MISMATCH |
| `NEEDS_IN_GAME_VERIFICATION.md` | Unresolved source conflicts |

Regenerate seed inventory (static parse only):

```text
node scripts/combat/export-ability-audit-inventory.mjs
```

## Status legend

| Status | Meaning |
|--------|---------|
| `OK` | Evidence matches runtime; no change |
| `MISMATCH` | Proven expected ≠ actual; fix queued or done |
| `HONEST_PARTIAL` | Known incomplete; `supportStatus` correct |
| `LABEL_WRONG` | Support label too optimistic or pessimistic |
| `NEEDS_IN_GAME_VERIFICATION` | Sources conflict or insufficient |
| `OUT_OF_SCOPE` | Multi-target / boss / product-law exclusion |
| `pending` | Not yet audited |

## Checklist dimensions

Damage ranges, hit counts, hit timings, channel/GCD occupancy, ability CDs, cooldown groups, CD reductions, charges, adren require/gain/spend, resources, buff/debuff windows, equipment forms, ammo, derived hits, DoT declaration, crit behavior, availability, solver eligibility, Manual/Revolution/solver parity.

## Phase order

0 baseline → 1 static data → 2 melee → 3 ranged → 4 magic → 5 necromancy → 6 cross-cutting parity → 7 ship gate

## Source precedence

1. Current RuneScape Wiki ability pages and tables  
2. Current Jagex patch notes  
3. Post-launch 2026 combat refinement documentation  
4. Combat Style Modernisation documentation  
5. Historical/beta pages for context only  

Code comments and existing tests are not mechanics evidence.
