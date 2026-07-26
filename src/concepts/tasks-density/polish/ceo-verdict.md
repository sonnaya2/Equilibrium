# Crest Compact polish — CEO verdict

**Surface:** production Tasks — `TaskRecords` + `useTasksDesk` + `.tasks-desk`  
**Pass bar: 9.0.** Weighted total: **9.1**. **`winnerId: "ship"`.**  
**Hard fails: none.** Must-fix: **empty.**

Be clear what this is. R1 Quarry was an 8.3 fidelity cosplay with a permanent inspector tax. Production Crest Compact is not that animal. It is Quarry DNA with the bay killed, Spike selection law, and Option A rail law. The polish job was not “make it pretty.” It was “stop lying about locked electives and stop conflating expand with complete.”

You cleared the hard fails. You cleared the bar. Thin, not gifted.

Weights: interaction 25 · readability 20 · rail 20 · dead space 15 · fidelity 10 · anti-slop/e2e 10.

---

## Scorecard

| Axis | Wt | Score | Hardass read |
|---|---:|---:|---|
| Interaction correctness | 25 | **9.3** | Expand ≠ check is real code, not a wish: name is a bare span (no `label`/`htmlFor`), checkbox `stopPropagation` on click + change, row Enter/Space only toggles `selectedId`. Spike law holds — `active` ignores desk first-row fallback; re-click and Close null selection. My build scopes **only** the multi-region list; a specific leaf (incl. locked electives) sets `allowedRegions: null` so the leaf does not empty. Virtualizer `measure()` on expand. This is the axis you had to get right. |
| Readability | 20 | **8.9** | Names **0.9375rem (15px)** — hard-fail floor cleared. Check 18px, mono tabular Comp%/pts, sticky thead, 32px rows. Stage body/meta readable. Still not 9.2: All-view has no row locality signal (rail owns region), and full-corpus leaf counts can disagree with a tier/search-filtered list. |
| Rail usefulness | 20 | **9.1** | **Option A landed.** Diagnosis was Anachronia/Tirannwn filtered off the rail by My build — dead. `regionRail = regionsInTaskData(records)` always; `fullRegionCounts` ignores build; locked electives get `is-locked` mute + title/aria “still viewable” and remain clickable. That is the product win. Deduct for Σ/leaf badges always showing corpus totals while My build + All shows a shorter list — useful for “there are N tasks in that region,” slightly dishonest for “what you see now.” Opacity-only lock (no glyph) is acceptable, not elegant. |
| Dead space | 15 | **9.2** | 2-bay only (`5.75rem` rail + stage). No permanent right inspector — expand is under-row, mounts only when selected. Champion shell flex fills remaining height. One-line bar with nowrap + overflow-x. Rail is paid filter chrome, not a void. 32px is denser than Spike, looser than Composite 28 — correct for 15px names. |
| Fidelity | 10 | **9.1** | Crest Compact identity is finally honest: real `RegionCrest` art, gem-pressed chips, carved stone, Editorial `@theme` only. Not a third-party clone. Stage crest at 22px is header garnish; rail at 30px is the proud surface. |
| Anti-slop / e2e readiness | 10 | **8.5** | No glass, no SaaS cards, no gold CTAs, scoped `.tasks-desk`. Unit suite covers rail membership + full counts (anachronia/tirannwn present). **e2e is still soft** — region rail existence, My build pressed, optional Comp% href. No Playwright pin for expand≠check, locked leaf path, or Close collapse. Checklist is manual evidence. Clean product; thin contract armor. |
| **Weighted** | | **9.1** | **Ship** |

```
interaction  9.3 × 0.25 = 2.325
readability  8.9 × 0.20 = 1.780
rail         9.1 × 0.20 = 1.820
dead space   9.2 × 0.15 = 1.380
fidelity     9.1 × 0.10 = 0.910
anti-slop    8.5 × 0.10 = 0.850
─────────────────────────────
total                   9.065 → 9.1
```

---

## Hard-fail gate

| Fail condition | Result | Evidence |
|---|---|---|
| Expand still checks the box | **PASS** | Name = `<span className="tasks-desk__name">`; checkbox own `aria-label`; row `onClick` → `toggleSelect`; check `stopPropagation` on click + change |
| Anachronia / Tirannwn invisible with no path | **PASS** | Full data `regionRail`; locked mute still clickable; leaf pick bypasses `allowedRegions` unlock intersect; unit tests assert both ids + counts |
| Right inspector back | **PASS** | `grid-template-columns: rail \| 1fr` only; detail = `tasks-desk__stage` under row |
| Names still tiny | **PASS** | `font-size: 0.9375rem` → 15px @ 16px root (≥15 checklist floor) |

No hard fails. Policy does not invent failures to stay “hardass.”

---

## What the polish fixed (vs diagnosis)

1. **My build was eating the rail.** Old behavior hid elective crests when they were not unlocked — Anachronia/Tirannwn vanished with no discoverable path. Option A: rail is data-complete; My build filters the **list** on All, not the crest inventory.
2. **Expand vs complete.** Checklist #1–2: no shared label association; stopPropagation on both events. This was a real footgun class; production no longer has it.
3. **Permanent dossier bay.** Already dead in Crest Compact production port; polish did not reintroduce it. Confirm under dead-space axis, not nostalgia for R1 Quarry.

---

## What still is not perfect (why 9.1 not 9.4)

### 1. Count badges lie a little under My build + All
`fullRegionCounts` is correct for locked elective *truth* (“Anachronia has N tasks in the corpus”). It is wrong as a badge next to Σ when My build is on and the stage shows starters only. Players will notice. Fix when you touch the desk next: dual mode — full counts on locked leaves, filtered counts on Σ / unlocked leaves under build scope — or a second muted fraction. Not a must-fix for ship; it is the loudest remaining rail nit.

### 2. All-view locality still lives only on the rail
No micro-crest in the name cell. Acceptable Crest Compact DNA (rail owns region). Same hole R2 Composite carried at scan 8.9. Do not reintroduce a fat region column.

### 3. e2e does not protect the polish
`e2e/tasks.spec.ts` is deliberately soft on names/dates. That is correct for Catalyst churn. It is **incorrect** that expand≠check and locked-leaf visibility have zero Playwright coverage. Unit tests + checklist are necessary; they are not sufficient for a public auto-deploy. Pin behaviors, not strings: crest rail has ≥1 locked leaf when electives empty + My build on; row click does not flip checkbox; Close removes stage.

### 4. Lock affordance is opacity-only
Title + `aria-label` carry “still viewable.” Opacity 0.55 reads “disabled” to some eyes. You did not set `aria-disabled` (good — leaves stay operable). A 1-character lock mark or dashed border would raise rail without spending width. Cosmetic.

### 5. Typecheck not cited in checklist
Checklist notes unit 29/29 and skips typecheck. Not a rescore hit if green in practice; do not claim green without running it before a loud ship.

---

## Must-fix (under 9.0 only)

**None.** Total ≥ 9.0 and no hard fails → empty must-fix list.

---

## Ship nits (non-blocking)

1. Σ / leaf full-corpus counts vs My build–filtered All list  
2. Optional All-view micro-crest (0-width, not a column)  
3. Playwright contracts for Option A + expand≠check + Close  
4. Stronger locked-leaf visual than opacity alone  

---

## Bottom line

**Crest Compact polish = 9.1. `winnerId: "ship"`.**

The diagnosis was specific: electives vanished under My build, and expand risked completing. Option A + checkbox isolation + 2-bay stage are implemented in production code paths, unit-backed for rail membership, checklist-backed for interaction. Names are 15px. Right inspector is gone.

I am not giving you a 9.5. Counts still fib under build scope, All-view locality is rail-only, and e2e still will not catch a regression that re-hides Anachronia. Those are real. They are not hard fails and they do not keep this under the bar.

**Pass bar 9.0 met. Ship. Do not reopen the density tournament to re-litigate a finished room.**
