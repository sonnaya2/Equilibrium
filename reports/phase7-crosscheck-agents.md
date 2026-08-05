# Phase 7 dual-agent cross-check (Phases 0–6 × post–spring 2026 wiki)

**Date:** 2026-08-04  
**Method:** 2 agents per style (CODE path + WIKI path) = 8 agents; synthesis + live wiki re-fetch for mismatches.  
**Wiki baseline:** Combat Style Modernisation **2 Mar 2026** + refinements **9 / 16 / 30 Mar 2026**.

## Agent matrix

| Style | CODE agent | WIKI agent |
|-------|------------|------------|
| Melee | FIXED all Phase 0–6 claims | Bands MATCH post–9 Mar; residual heals / Pulverise debuff |
| Ranged | FIXED except Caroming formula | **Caroming MISMATCH** (multiply vs flat); rest MATCH |
| Magic | FIXED all honesty + Blast/Tsunami | **PF + Greater Sunshine DoT** MISMATCH; rest MATCH / honest partial |
| Necro | FIXED including igneous DS label | Primary bands MATCH; ST multi-target honest partials |

## Verdict summary (Phases 0–6 genuinely fixed?)

| Area | Code status | Wiki post–spring 2026 |
|------|-------------|------------------------|
| Hurricane −3s CD / hit | FIXED | MATCH |
| Backhand / Binding / Impact charges | FIXED | MATCH |
| Overpower +3t; Berserk OP 9s | FIXED | MATCH |
| Adaptive Strike forms | FIXED | MATCH |
| Bloodlust / Fury / Chaos Roar / bleed chain / GBarge | FIXED | MATCH |
| Puncture / Splintering stored sequence | FIXED | MATCH |
| Ammo Manual/Revo/Solver pack | FIXED | n/a packing |
| Deathspore free cast | FIXED | MATCH |
| Piercing → Snipe CDR | FIXED | MATCH |
| Corruption Shot/Blast derived 80/60/40/20 | FIXED | MATCH (ST) |
| Darkfang / Gloomfire | FIXED | MATCH (transform) |
| Chain/GChain honest partial | FIXED | HONEST_PARTIAL |
| Claws of Guthix cast + partial | FIXED | HONEST_PARTIAL |
| Blast Infused 10t / +8% | FIXED | MATCH |
| Tsunami Bernoulli +8% / 50t | FIXED | MATCH tooltip ticks |
| Sunshine / PF base | FIXED | MATCH |
| Instability LS 70–90 non-recursive | FIXED | MATCH (9 Mar nerf) |
| Haunted / Command Ghost | FIXED | MATCH body (6t) |
| Death Spark / Soul Reave | FIXED | HONEST_PARTIAL (specials out) |
| Death Skulls / Igneous ST | FIXED + label | MATCH |
| Bloat / LD / Scythe | FIXED | MATCH / honest residual |

## Confirmed bugs found by cross-check (this pass)

### 1. Caroming flat AD (HIGH) — **FIXED this session**

- **Wiki:** +4% ability damage **per rank per hit** as **flat AD % points** (table: 75–85 → 91–101 at R4).
- **Was:** multiplicative `pct * (1 + 0.04*rank)` → R4 main ~87–99 (undercounts weak return hits badly).
- **Now:** `pct + 4*rank` in `styles/ranged/caroming.ts`; tests updated to wiki table.

### 2. Planted Feet strips Greater Sunshine beam (MEDIUM) — **FIXED this session**

- **Wiki (Greater Sunshine + Planted Feet pages):** PF does **not** extend Greater duration, but **still removes** the damage-dealing beam (reflect use-case).
- **Was:** prepare only stripped `appliesEffect === "sunshine"`; test asserted Greater kept 21 DoTs under PF.
- **Now:** strip both `sunshine` and `greater_sunshine` beam hits; duration still unextended for greater (`cast/effects/magic.ts` already correct).

### 3. `death_skulls_igneous` full label (P0) — **FIXED this session**

- Mirrors base DS: `partially-modeled` + ST note; solver excluded by default.
- Registry test asserts both.

## Remaining intentional / NIGV (not Phase 0–6 regressions)

| Item | Class | Notes |
|------|-------|-------|
| Multi-target Chain copy, Tsunami AoE, DS bounce graph, Soul Strike splash, Bloat death spread, Blood Siphon AoE | INTENTIONAL_SCOPE / HONEST_PARTIAL | ST model |
| Caroming → Chain secondary | STILL_OPEN | Helper only; needs multi-target copy first |
| Dismember 25–35 vs body 25–31 | SOURCE_CONFLICT | Engine = tooltip/table |
| Greater Barge idle 5–7 vs prose 5–12 | SOURCE_CONFLICT | Engine = analysis table |
| Haunted 4.8s tooltip vs 3.6s body | SOURCE_CONFLICT | Engine = body 6 ticks |
| Command Skeleton 2 vs 10 hits | SOURCE_CONFLICT | Engine = body 10 |
| Tsunami 30s vs 30.6s prose | SOURCE_CONFLICT | Engine = 50 ticks |
| Claws tooltip +5 BHC vs body affinity +2 | SOURCE_CONFLICT | Honest partial cast-only |
| Fleeting Snipe CDR on autos | NIGV | Code does it; Piercing note incomplete |
| Bleed lifesteal / Pulverise kill adren / CoG dynamic DP | residual | Documented |

## Test evidence (this pass)

```text
npx vitest run styles/{melee,ranged,magic,necromancy} registry mechanics
  charges hurricane.cdr corruption.derived tsunamiCritAdren
→ green after Caroming + PF + igneous DS changes
```

## Bottom line

Phases **0–6 melee / magic / necro claim sets are genuinely implemented** and **match post–spring 2026 wiki bands/costs** within ST product scope.  

Ranged Phase 3 wiring was real, but **Caroming application math was wrong** vs live wiki table (now fixed). Magic **PF + Greater Sunshine DoT** contradicted wiki (now fixed).  

Phase 7 ship work remaining: completeness contract, all-ability independent fixtures, long-rotation goldens, residual honesty labels, final disposition matrix — **not** re-doing Phases 1–6 mechanics.
