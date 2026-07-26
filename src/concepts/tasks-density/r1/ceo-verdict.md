# Tasks density R1 — CEO verdict

**Pass bar: 9.0. Winner: none. `winnerId: null`.**

Nobody ships. Closest is Ledger at **8.8** — a real contender, not a crown. R2 is mandatory.

Weights: viewport 25 · scan 20 · ops 20 · fidelity 15 · antiSlop 10 · signature 10.

---

## Ranked table

| Rank | Team | Codename | Total | Status |
|---:|---|---|---:|---|
| 1 | **Ledger** | Wiki Strip | **8.8** | Contender — nearest to bar |
| 2 | **Aperture** | Select + Stage | **8.5** | Contender |
| 2 | **Spike** | Board-first | **8.5** | Contender (tie on total; loses density axes) |
| 4 | **Quarry** | Crest Compact | **8.3** | Contender — fidelity without kill |

No hard fails recorded. No invented tasks. My build / progress / Comp% wiki / virtualization all live via `useTasksDesk`. Names stay ≥14px. Palettes stay on the Editorial ladder (hardcoded hex clones of stone/parch/gem/gold count as ladder, not a new brand).

---

## Axis breakdown

| Axis | Ledger | Aperture | Spike | Quarry |
|---|---:|---:|---:|---:|
| Viewport fill (25) | **8.7** | 8.5 | 8.2 | 7.6 |
| Scan ergonomics (20) | **8.8** | 8.7 | 7.6 | 8.0 |
| Operability (20) | **9.0** | 8.6 | **9.0** | **9.0** |
| Crystal × Data (15) | 8.6 | 7.9 | 8.5 | **8.9** |
| Anti-slop (10) | **9.0** | **9.0** | **9.0** | 8.8 |
| Signature (10) | 8.7 | 8.6 | **9.0** | 7.8 |
| **Weighted** | **8.8** | **8.5** | **8.5** | **8.3** |

---

## SCREAMS — what failed density this round

The tournament was supposed to **kill dead space**. Round 1 produced four partial answers and zero complete ones.

1. **Nobody assembled the obvious winning combo.** Full-width stage + ~28px single-line rows + one chrome facet line + **collapsible** detail (no permanent bay, no always-open stage). Every team left a piece on the table.
2. **Spike brought production row fat back.** `ROW_PX = 36` plus a region **sub-line** under the name. That is the opposite of density surgery. Board-first topology is the right idea; the row geometry is an unforced own-goal.
3. **Quarry compressed the twin desk and called it a day.** 7.5rem rail + 12rem inspector is still ~19.5rem of permanent non-list width. Compression ≠ elimination. Density ceiling is structural, not padding.
4. **Aperture’s “inline stage” never collapses.** Shared desk `selected` falls through to the first visible row, and the preview never toggles `selectedId` off. One expanded block is **always** open. That is a permanent detail tax inside the list, not a pure scan board.
5. **Ledger double-pays for region.** Horizontal crest strip *and* a region column. Full-width table is strong; name column still loses ~6–7.5rem to locality that the strip already owns.
6. **Crest chrome still costs a full scan line** (Ledger strip, Spike `width: 100%` crest row). Aperture’s `<select>` is the only team that reclaimed that height — and paid for it in Crystal crest language.
7. **Production twin-desk waste is not fully dead.** Permanent third bay (Quarry), always-on detail (Aperture/Ledger via auto-select), or fat multi-line rows (Spike) — each keeps a different corpse warm.

Until someone kills chrome *and* row height *and* permanent detail in one build, the bar stays red.

---

## Per-team brutal notes

### 1. Team Ledger · Wiki Strip — **8.8**

**Thesis holds.** Strip → full-width table → bottom drawer is readable in three seconds. Closest thing to a shippable density shape.

| Axis | Score | Why |
|---|---:|---|
| Viewport | 8.7 | Full workbench width; list locked to `min(78vh, 48rem)`; 28px rows. Drawer is content-height and mostly below fold when the list is tall — good. Still two chrome bands (toolbar + crest strip). Fixed list height does not reclaim space against short drawers. |
| Scan | 8.8 | Sticky thead, head-still Comp%/pts/tier/region, 14px names, mono tabular nums. Best column discipline in the field. |
| Ops | 9.0 | Full desk parity: My build, tiers, crests, search, progress, wiki deep-links, virtualizer, elective hint. |
| Fidelity | 8.6 | Facet gem-on, gold display title only, carved stone. Board Sky adjacency (no permanent side inspector) is a justified twin-desk evolution. |
| Anti-slop | 9.0 | Scoped `.td-ledger`, Editorial `--color-*` only, no glass/cards/gold CTAs. |
| Signature | 8.7 | Wiki energy is obvious. Not as flashy as Spike’s collapsing bay, but coherent. |

**What still screams:** region strip + region column is redundant. Auto-selected first row means the drawer is never “off” — permanent detail band under the stack. To clear 9.0: drop or collapse the region column when the strip is live, collapse drawer until click (Spike’s selection law), keep 28px rows.

---

### 2. Team Aperture · Select + Stage — **8.5**

**Best horizontal reclaim.** Zero rail, zero inspector column, shell `calc(100vh - 9.5rem)`. On paper this is the density maximizer. In code, the always-open stage and crest abandonment keep it off the bar.

| Axis | Score | Why |
|---|---:|---|
| Viewport | 8.5 | Full width + true remaining-height list. Single facet band (select instead of crest strip). Permanent expanded stage under the auto-selected first row eats ~3 row heights forever. |
| Scan | 8.7 | Single-line grid with region column, mono Comp%/pts, 14px names. Strong head-still. Stage under the row is fine for detail, bad when it never closes. |
| Ops | 8.6 | Filters/progress/wiki/virtualization work; `measureElement` + remeasure on selection is correct. **No deselect path** — click does not toggle off. Shared `selected` fallback owns you. |
| Fidelity | 7.9 | Facet chips survive. Crest filter surface dies for a native `<select>`. Crystal × Data without crests is Data with a green chip. Justified for density, thin as Crystal. |
| Anti-slop | 9.0 | Editorial hex ladder, no marketing. |
| Signature | 8.6 | Select + inline stage reads fast. Self-score was optimistic on the permanent-open cost. |

**What still screams:** collapse law. Match Spike’s `selectedId === null` default and toggle. Crest-or-select hybrid (compact crest icons in the select row, or icon chips without labels) would recover fidelity without reintroducing a 7.5rem rail.

---

### 2. Team Spike · Board-first — **8.5** (tie total; ranks under Aperture on density)

**Best thesis, worst row math.** Inspector mounts only on explicit `selectedId` — correct, and the only team that refuses auto-first-row for the bay. Close detail + re-click toggle is how adults build inspectors. Then you shipped **36px rows with a region subline** like production never got the memo.

| Axis | Score | Why |
|---|---:|---|
| Viewport | 8.2 | Full-width stage until click is the right majority surface. Shell `min(72vh)` / stage `min(58vh)` is serious height. Dual facet+crest wrap steals a line. **36px estimate + subline** → fewest visible tasks in the field. Topology win, geometry loss. |
| Scan | 7.6 | 15px names are the readability ceiling — good. Mono Comp%/pts good. Region as second line under the name breaks head-still single-line scan. Competitors already proved region can be a column or a strip, not a row tax. |
| Ops | 9.0 | Full parity + the only clean collapse model. Missing elective hint is noise, not a fail. |
| Fidelity | 8.5 | Board Sky height lesson applied cleanly. Facet gem language intact. Twin-desk → on-demand bay is evolution, not a clone. |
| Anti-slop | 9.0 | Clean stone/gem/gold discipline. |
| Signature | 9.0 | Collapsing bay is the most obvious 3-second read of the round. |

**What still screams:** cut to 28–30px single-line rows; kill the meta subline; put region in a column or rely on the crest strip alone. That single change probably moves Spike to ~8.8–9.0 without inventing a new topology. You already have the hard part.

---

### 4. Team Quarry · Crest Compact — **8.3**

**Safest, least brave.** Three-bay DNA compressed. Fidelity high. Density still structurally capped by permanent side chrome.

| Axis | Score | Why |
|---|---:|---|
| Viewport | 7.6 | 7.5rem + 12rem permanent. Stage flexes height well (`min(78vh, 820px)`), but first-screen **area** permanently gifts a dossier column whether the player is scanning or not. Hard fail avoided (inspector < list, not empty larger than list) — bar for *fill* still missed. |
| Scan | 8.0 | 28px single-line, 14px names, mono Comp%/pts. No region in the row — locality lives only on the rail. Fine when filtered to one region; weak on All. |
| Ops | 9.0 | Full desk wiring, crest tooltips for labels, wiki, progress. |
| Fidelity | 8.9 | Highest fidelity score. Crests, facets, carved inspector kicker in gold, twin-desk continuity. This is production with lipo, not a new animal. |
| Anti-slop | 8.8 | Clean. Local hex tokens match Editorial; no gold buttons. Slightly less token-bridge purity than Ledger/Spike. |
| Signature | 7.8 | “We made the same desk skinnier” does not punch in three seconds next to strip/drawer, collapsing bay, or select+stage. |

**What still screams:** kill or mount-on-select the inspector. Crest-only rail is a good move; permanent 12rem bay is the density tax you refused to pay down. Without that, you cannot win a density tournament — only a fidelity one.

---

## Hard-fail checklist

| Check | Ledger | Quarry | Spike | Aperture |
|---|---|---|---|---|
| My build / progress / wiki intact | pass | pass | pass | pass |
| Invented task data | none | none | none | none |
| Permanent empty inspector > list | no | no (filled, skinny) | no (unmounted) | no (inline, not empty column) |
| Names &lt; 13px | no (14) | no (14) | no (15) | no (14) |
| New palette | no | no | no | no |
| Gen-AI art | no | no | no | no |

No disqualifications. Contenders only. None cross 9.0.

---

## R2 mandate

**R2 is mandatory.** Do not crown a soft winner.

### What R2 must force

1. **Default scan mode = zero permanent detail bay.** Detail mounts on explicit selection and must collapse (Spike law). Auto-first-row detail is banned for scoring.
2. **Single-line rows ≤ 30px estimate.** Region sublines are banned unless region is not available as strip/column/select.
3. **At most one dedicated filter chrome band** for region (strip *or* select *or* rail — pick one). No double-paying region (strip + fat column) without a density justification.
4. **Keep:** My build chip, tier facets, search, Comp% wiki, progress, virtualization, Editorial tokens, ≥14px names, mono tabular Comp%/pts.
5. **Hybrid candidates worth building:**
   - **Ledger geometry + Spike selection law** (full-width 28px table, drawer only when selected, crest strip only).
   - **Spike topology + Ledger/Aperture row grid** (collapsing bay, 28px head-still columns, no subline).
   - **Aperture width + collapse + crest-lite filter** (full-width shell, deselect, compact region control that still speaks Crystal).

### What not to do in R2

- Do not re-litigate Crystal × Data vs a new DNA. Topology competes; recipe stays fixed.
- Do not reintroduce a permanent third column “because twin-desk won before.” That was composition; this tournament is density.
- Do not inflate self-scores. Spike’s own ~8.8 and Aperture’s ~8.9 were in the right zip code; neither earned a 9.

---

## Bottom line

**Ledger 8.8** is the only build I’d put in front of a skeptical ship review without shame — and I’d still send it back for drawer collapse + region double-pay. **Spike** has the interaction model everyone else should steal and the row geometry everyone else already beat. **Aperture** has the width math and no off-switch. **Quarry** is a fidelity museum piece in a density fight.

**Pass bar 9.0 unmet. `winnerId: null`. Round 2 required.**
