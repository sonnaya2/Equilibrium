# /data residual clanker sweep

**Date:** 2026-07-26  
**Scope:** static chrome only under `/data` UI — `src/components/*Research*.tsx`, `ResearchBrowser`, `ResearchSection`, `QuestBrowser`, `DataWorkbench`, `app/data/*`, `researchStatus.ts`  
**Out of scope:** `data/**` JSON bodies, concepts lab, combat, map  

Concurrent agents had already shortened most intros/titles (empty intros, short h2 nouns). This pass hits residual AI/system jargon still visible in chrome.

---

## Keyword sweep (search list)

| Tell | Residual? | Action |
|------|-----------|--------|
| self-sufficient | Clean (`Ironman only.`) | left |
| multi-region labeled | No exact phrase; tab labels used `* multi-region` | shortened tabs |
| snapshot | Quest count line `snapshot {date}` | → `as of` |
| planner (chrome) | `Planner gaps` already → `Gaps` (this/concurrent) | left |
| modelled / modeled | `Already modeled` already → `In catalog` | left |
| rebalanced | Notes tab `Rebalance` = game patch name | left |
| deliberately / seamless / comprehensive / worth / not as a / optional unless / Catalyst-era | No user chrome hits | — |
| infrastructure | Label already → `Account`; JSON property names only | left |
| dependencies | Tab was `Hard dependencies` | → `Hard reqs` (this pass) |
| progression | Product tab/title noun | left |
| unlock chains | Intro already emptied by concurrent pass | left |
| support pressure | `Region chain (support pressure)` | → `Chain:` in ResearchSection |
| all-required / all required | `Region combo (all required)` / `Needs all` | → `Combo:` |
| ironman / no-trade | `Ironman only.` | left |
| precedent | confidence was `League precedent` → concurrent `League guess` | left |
| pressure (chrome) | Unlocks `Pressure:`; Combos `Pressure only`; MW tab | shortened |

---

## Fixed this pass

| File | Was | Now |
|------|-----|-----|
| `ResearchSection.tsx` | `Support:` / `Needs all:` region lines | `Chain:` / `Combo:` (matches Browse) |
| same | `planner_value` → `Why it matters` | `Value` |
| `RegionCombosResearch.tsx` | Hard multi-region / Pressure only / Museum multi-region / Combat multi-region | Hard combos / Soft only / Museum combos / Combat combos |
| same | (earlier in session) Already modeled / Planner gaps | In catalog / Gaps |
| `RegionBoundariesResearch.tsx` | Boundary overrides / Hard requirements / Unresolved crossings | Overrides / Hard reqs / Unclear edges |
| `QuestBrowser.tsx` | `n quests · snapshot {date}` | `n quests · as of {date}` |
| `PermanentUnlockResearch.tsx` | `Pressure: …` | `Soft: …` |
| `MasterworkChainResearch.tsx` | Region pressure | Region needs |
| `SlayerResearch.tsx` | Stale corrections | Stale fixes |

### ResearchSection snake_case dumps

Owned and already improved: `FIELD_LABELS` map + title-case fallback (trim long keys to 3 words). This pass only swapped the coaching label `Why it matters` → `Value`. Unknown keys no longer render raw `snake_case`.

---

## Already clean (concurrent / earlier — not reverted)

| Surface | State |
|---------|--------|
| `app/data/page.tsx` notes | `Ironman only.` |
| Most research `intro=""` + short titles (BiS, Combos, Boundaries, …) | empty lead; tabs carry meaning |
| Progression intro paragraph | removed (search only) |
| Account infrastructure tab | `Account` |
| Combat BiS / Regional multi-region intros | emptied |
| confidence `League precedent` | `League guess` (via `researchStatus.ts`) |
| ResearchBrowser Combo/Chain region access | already short |
| Archaeology museum combo prefix | already short (`Needs A + B`) |

---

## Left alone (intentional)

| Item | Why |
|------|-----|
| DataWorkbench tab nouns (Progression, Unlocks, …) | Product IA, not marketing |
| Notes tab `Rebalance` | Names the Jul 2026 midgame rebalance dataset |
| JSON property paths (`production_infrastructure`, `region_pressure`, …) | Not rendered as chrome; skip pure data |
| ResearchBrowser `multi-region` token in methodAccess | Data normalizer, RS player term |
| Dynamic row body text from JSON | Out of scope |

---

## Verdict

Residual `/data` static chrome no longer shows support-pressure / all-required / snapshot / multi-region tab jargon / Why-it-matters coaching. Snake_case field dumps in ResearchSection stay humanized via the label map.

**DONE** — residual only; no JSON data edits.
