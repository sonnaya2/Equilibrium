# UI humanize pass 2 — residual chrome (agent A13)

**Date:** 2026-07-26  
**Scope:** production only — `app/**/*.tsx` (not concepts), `src/components/**/*.tsx`, `src/map/**/*.tsx`  
**Out of scope:** `src/concepts/**`, `app/concepts/**`, `data/` JSON body, e2e updates  

---

## Keyword / tell sweep

| Tell | Production hit? | Notes |
|------|-----------------|-------|
| seamless / powerful / robust / effortless / reimagined | No user chrome | `seamless` only in map terrain comment; `powerful` only concepts relic blurbs |
| It's not just / COMING SOON / Oops / worth planning | Clean | — |
| cutting-edge / unlock your | Clean | — |
| facet desk / living world / Fort gate | Clean in production | Lab / concepts only (already stripped from Overview aperture) |
| modelled on | Code comment only | `BuildPlanner.tsx` file header — not user-facing |
| self-sufficient only | Clean | Structure uses `Ironman only` |
| leading-6 static strings >100 chars | Clean residual | `leading-6` left only on ResearchBrowser data cells + skill region line (data/dynamic) |

Pass 1 (`docs/ui-copy-audit.md` §9) already applied most VERBOSE/REDUNDANT rewrites. Pass 2 is residual empties + one combat credit line.

---

## Fixed this pass

| File | Was | Now |
|------|-----|-----|
| `app/tasks/page.tsx` | `No tasks loaded yet.` | `No tasks loaded.` |
| `app/combat/page.tsx` | `History only — not Equilibrium multipliers or relics.` | `History only — not Equilibrium multipliers.` |
| `src/components/ResearchBrowser.tsx` | `No method listed yet.` | `No methods listed.` |
| same | `No area list yet.` | `No areas listed.` |
| same | `No skills listed yet.` | `No skills listed.` |
| same | `No details yet.` | `No details.` |
| same | `No major upgrades listed yet.` | `No major upgrades.` |
| same | `Relevant regions: …` / `No single region requirement listed yet.` | `Regions: …` / `No single region requirement.` |

Also confirmed already clean (fixed earlier in apply / concurrent pass, not re-touched):

- Map empty: `Nothing mapped.`
- Revo helper merged; timeline one line
- Setup / Analysis / Gear helpers short
- Overview / Map note / Sources / Data footer already one-sentence

---

## Left alone (e2e frozen or intentional)

| Item | Why |
|------|-----|
| Brand `EQUILIBRIUM`, nav labels, footer Jagex trademark | Frozen e2e |
| `Clear picks`, `0/3` / `3/3`, region button name prefixes | Frozen e2e |
| `no WebGPU` substring (map fallback) | Frozen e2e |
| Combat e2e-hard labels (`Run`, `Run revolution`, `Damage Potential`, tab names, `Auto-weave basics`, …) | Frozen e2e |
| Revo empty copy vs e2e | **Drift:** production shows `Run revolution for the cast log`; `e2e/combat.spec.ts` still asserts `Run revolution for a full duration cast log`. **Not fixed here** — needs paired e2e update when someone unfreezes that pin |
| Style-mismatch revo warning | Dynamic functional warning, not marketing chrome |
| Research row details / combat JSON summaries (`leading-6` data body) | Data body, not static chrome |
| Confidence mapper unify (audit P13) | Separate apply; not chrome length |
| Concepts lab marketing (`powerful gathering tools`, Fort gate captions) | Explicitly out of scope |

---

## Verdict

Production static chrome is at one-sentence / zero density for helpers and empties. Remaining multi-sentence surfaces are **data** or **e2e-hard**. No AI marketing tells in product UI.

**DONE** — residual humanize only; no concepts, no e2e edits.
