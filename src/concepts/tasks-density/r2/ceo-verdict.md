# Tasks density R2 — CEO verdict (Composite)

**Pass bar: 9.0. Winner: none. `winnerId: null`. `promoteToProduction: false`.**

Composite total **8.9** — beats R1 Ledger (**8.8**) by a real but thin margin. You assembled the mandated hybrid. You still did not clear the bar. Contender, not champion. Do not ship as production TaskRecords chrome yet.

Weights: viewport 25 · scan 20 · ops 20 · fidelity 15 · antiSlop 10 · signature 10.

---

## Scorecard

| Axis | Wt | Score | Hardass read |
|---|---:|---:|---|
| Viewport fill | 25 | **8.9** | Full-width stage, 28px rows, no permanent bay — correct kill list. Fixed `min(78vh, 48rem)` + facet wrap still leave juice on the table. |
| Scan ergonomics | 20 | **8.8** | Sticky thead, 14px names, mono Comp%/pts — Ledger discipline. No region in row: intentional, but All-view locality scan regresses vs R1 Ledger column. |
| Operability | 20 | **9.0** | Full desk parity + Spike collapse/toggle/Close. No hard fails. |
| Crystal × Data | 15 | **8.8** | Facet/gem/gold/crests intact. Crests crammed into facet overflow; proud Crystal language, not Quarry-rail proud. |
| Anti-slop | 10 | **9.0** | Scoped `.td-composite`, Editorial `--color-*` only, no glass/cards/gold CTAs. |
| Signature | 10 | **8.9** | “Quiet wiki board until click” reads in three seconds. Thesis is the R2 mandate, not a new animal — clear, not flashy. |
| **Weighted** | | **8.9** | **Contender** |

```
viewport 8.9×0.25 = 2.225
scan     8.8×0.20 = 1.760
ops      9.0×0.20 = 1.800
fidelity 8.8×0.15 = 1.320
antiSlop 9.0×0.10 = 0.900
signature 8.9×0.10 = 0.890
─────────────────────────
total               8.895 → 8.9
```

---

## Must-verify (R2 mandate)

| Check | Result | Evidence |
|---|---|---|
| Detail collapsed until click; `selectedId === null` → no drawer in DOM | **PASS** | `active` ignores `desk.selected` fallback; `{drawerOpen && active ? <aside> : null}` |
| Rows ~28px single-line, no region subline | **PASS** | `ROW_PX = 28`, `--td-row-h: 1.75rem`, name `white-space: nowrap`, no meta subline |
| Only one region chrome mechanism | **PASS** | Crest chips in facet row only; no region column; no second strip |
| Full-width list | **PASS** | No rail, no permanent third bay; stage is full workbench width |
| My build / progress / Comp% wiki / virtualization | **PASS** | Wired through `useTasksDesk`; checkboxes, wiki anchors, `virtualizer` + `measureElement` |

No hard fails. No invented tasks. Names 14px. Palette stays on Editorial tokens.

---

## What improved vs R1 Ledger (8.8)

R1 screamed three fixes. Composite did all three:

1. **Spike selection law** — drawer mounts only on explicit `selectedId`; re-click and Close both null it. Auto-first-row permanent drawer is dead. This is the real density win.
2. **Region double-pay killed** — crest filter owns locality; no region column. Name column reclaims the ~6–7.5rem Ledger burned.
3. **28px single-line kept** — not Spike’s 36px + subline regression.

Net: +0.1 over Ledger. Real surgery, not padding theater.

---

## What still screams (why not 9.0)

### 1. Facet row is one *container*, not one *line*
Title · count · search · My build · tier chips · crest rail all live in a `flex-wrap` band. On real desk widths this wraps. Crests get `overflow-x: auto` and `margin-left: auto`, which is smarter than a dedicated strip — but medium widths still buy a second chrome line. R1’s “one facet row” mandate is structurally satisfied and visually leaky. A forced single-line desktop layout (or crests that never force wrap) is the remaining chrome cut.

### 2. Shell height is still Ledger-lazy
`listMaxCss: "min(78vh, 48rem)"` / fixed list height. Aperture’s remaining-height reclaim (`calc(100vh - chrome)`) was never stolen. When the drawer opens it *appends* under a fixed-height list instead of compressing the stage so detail stays in-viewport. Scan mode is excellent; selected mode still dumps detail below the fold on tall lists. Density tournament scores first-screen fill — you maxed the empty-bay kill and left the height math half-done.

### 3. All-region scan lost head-still locality
Mandate correctly banned strip + column. Cost is real: on `region === "all"`, the eye cannot pin region without opening the drawer or inferring from filters. Quarry had the same weakness; Composite inherits it. Acceptable trade for density — not free on the scan axis. A 0-width micro-crest *inside* the name cell (not a full column) would recover locality without reintroducing double-pay; you did not try it.

### 4. Fidelity is competent, not elevated
Crests at 14px in a scroll chip strip speak Crystal. They do not *sing*. Gold title + gem-pressed chips + carved stone are correct recipe. Compared to Quarry’s crest rail + inspector kicker, this is “we kept the tokens,” not “we advanced the twin desk.” Fidelity 8.8 is fair; 9.0 would need one proud surface moment that is still density-safe.

### 5. Signature is the brief, not a discovery
Three-second read works: dense table, quiet until click. That is exactly what R1 ordered. Signature credit for execution, not invention. Fine for a composite round — does not create spare points to paper over viewport/scan nits.

---

## Hard-fail checklist

| Check | Composite |
|---|---|
| My build / progress / wiki intact | pass |
| Invented task data | none |
| Permanent empty inspector > list | no (unmounted until select) |
| Names &lt; 13px | no (14px) |
| New palette | no |
| Gen-AI art | no |
| Region double chrome (strip + column) | no |
| Auto-first-row permanent detail | no |

---

## Promote to production?

**No.** `promoteToProduction: false`.

Reasons, in order:

1. Total **8.9 < 9.0** pass bar — policy is binary here.
2. Facet wrap + fixed 78vh mean first-screen density is still a contender shape, not a settled production ceiling.
3. All-region locality hole is acceptable in a concept shootout; production Tasks should decide crest-in-name vs filter-only before freeze.
4. Tournament composite is allowed to stay in `src/concepts/` until a production port with shell-height math and single-line chrome lock.

What would unlock promote (minimum):

- Desktop facet band guaranteed one visual line (or measured chrome height fed into `calc(100vh - chrome)` list)
- List height = remaining viewport, drawer steals from list (or sticky bottom within shell) so select mode stays on-screen
- Optional micro region signal on All without a full column
- Re-score ≥ 9.0 under the same rubric

---

## Bottom line

**Composite 8.9** is the strongest Tasks density build in the tournament so far. It is the build R1 should have been: Ledger geometry + Spike collapse + single region chrome + full width. That is a **contender**, not a crown.

The bar stays red because density is not only “delete the bay.” It is also chrome that does not wrap, list height that eats the shell, and scan that still works when the player is on All. You deleted the bay. You did not finish the room.

**Pass bar 9.0 unmet. `winnerId: null`. Do not promote.**

---

## R2.1 rescore (surgical density fixes)

**Pass bar: 9.0. Winner: Composite. `winnerId: "composite"`. `promoteToProduction: true`.**

Prior R2 total **8.9**. After shell-fill + desktop facet lock: **9.0**. Thin pass — earned, not gifted. The two structural unlock items from R2 were done; the optional All-view micro-crest was not. Weights unchanged: viewport 25 · scan 20 · ops 20 · fidelity 15 · antiSlop 10 · signature 10.

### Scorecard (R2.1)

| Axis | Wt | R2 | R2.1 | Hardass read |
|---|---:|---:|---:|---|
| Viewport fill | 25 | 8.9 | **9.2** | Shell is now `height/max-height: calc(100vh - 8rem)` flex column; stage `flex:1; min-height:0`; list fills stage. Drawer `flex:0 0 auto` steals from list instead of appending under a fixed `min(78vh, 48rem)` box. Desktop facets `nowrap` ≥1100px. Magic `8rem` chrome estimate is still lazy vs measured — keeps this under 9.4. |
| Scan ergonomics | 20 | 8.8 | **8.9** | Taller first screen + single-line desk chrome. Sticky thead / 28px / mono nums unchanged. All-view locality hole (no row region signal) still real — optional micro-crest never tried. +0.1 only. |
| Operability | 20 | 9.0 | **9.0** | Desk parity + Spike collapse/toggle/Close intact. Selected mode stays inside the shell; that is viewport math, not new ops surface. No hard fails. |
| Crystal × Data | 15 | 8.8 | **8.8** | No fidelity surgery. Crests remain 14px scroll chips. Tokens correct; still not a proud surface moment. Do not invent points. |
| Anti-slop | 10 | 9.0 | **9.0** | Scoped `.td-composite`, Editorial `--color-*` only. Unchanged. |
| Signature | 10 | 8.9 | **9.0** | Thesis completes: full-shell quiet wiki board until click; detail compresses the stage. Still mandate execution, but the room is finished. |
| **Weighted** | | **8.9** | **9.0** | **Champion (thin)** |

```
viewport 9.2×0.25 = 2.300
scan     8.9×0.20 = 1.780
ops      9.0×0.20 = 1.800
fidelity 8.8×0.15 = 1.320
antiSlop 9.0×0.10 = 0.900
signature 9.0×0.10 = 0.900
─────────────────────────
total               9.000 → 9.0
```

### Must-verify (R2.1 delta)

| Check | Result | Evidence |
|---|---|---|
| List height = remaining viewport (not fixed 78vh) | **PASS** | `.td-composite` `calc(100vh - var(--td-shell-chrome))`; `listMaxCss` removed from desk opts |
| Drawer steals from list (flex compress) | **PASS** | Stage `flex:1 1 auto; min-height:0`; drawer `flex:0 0 auto` after stage in column |
| Desktop facet band one visual line | **PASS** | `@media (min-width: 1100px)` facets `flex-wrap: nowrap`; crests `overflow-x: auto` |
| Spike law still holds | **PASS** | `selectedId === null` → no drawer; re-click / Close nulls |
| Only one region chrome | **PASS** | Crests in facet row only; no column |
| Optional All-view micro-crest | **SKIP** | Not required for unlock; scan stays 8.9 |

### What R2.1 fixed vs R2 screams

1. **Shell height** — Aperture reclaim stolen. Fixed `min(78vh, 48rem)` is dead. This was the density ceiling.
2. **Facet wrap on desk** — ≥1100px forced single line; crest overflow absorbs overflow instead of a second chrome row.
3. **Selected-mode fold** — drawer no longer dumps below a rigid list box; stage shrinks inside the shell.

### What still is not perfect (why 9.0 not 9.3)

1. **`--td-shell-chrome: 8rem` is estimated**, not measured from live nav + concept chrome. Production port must measure or CSS-bind real chrome height.
2. **All-region scan locality** — still filter/drawer-only. Acceptable density trade; production may still want a 0-width crest-in-name without reintroducing a column.
3. **Fidelity plateau** — 8.8 unchanged. Crest chips work; they do not sing. Not a promote blocker after viewport pass.
4. **Mid widths (721–1099)** still wrap facets — correct for narrow; do not pretend every laptop width is locked.
5. **Drawer has no max-height** — a novel-length description can still crush the list toward zero. Rare on Catalyst rows; worth a production cap.

### Hard-fail checklist

| Check | R2.1 |
|---|---|
| My build / progress / wiki intact | pass |
| Invented task data | none |
| Permanent empty inspector > list | no |
| Names &lt; 13px | no (14px) |
| New palette | no |
| Gen-AI art | no |
| Region double chrome | no |
| Auto-first-row permanent detail | no |
| Fixed list height blocking shell fill | **fixed** |

### Promote to production?

**Yes.** `promoteToProduction: true`. `winnerId: "composite"`.

Policy is binary at 9.0. R2 stated unlock criteria; R2.1 met the two structural items and cleared the bar exactly. Do not move the goalposts.

Production port notes (not rescore blockers):

- Bind shell chrome to real site nav height (drop magic 8rem when porting out of concept mount).
- Decide crest-in-name vs filter-only for All before freeze.
- Cap drawer body height so pathologically long rows cannot zero the list.
- Keep Spike law and single region chrome — those are non-negotiable wins.

### Bottom line

**Composite R2.1 = 9.0.** Contender finished the room: full-width 28px ledger, Spike collapse, one crest control, viewport-eating shell, drawer that steals. Prior 8.9 failed on height math and desk facet wrap; both were surgical, both landed.

Scan and fidelity did not get free gifts. The pass is carried by viewport (**9.2**) and a completed signature (**9.0**), not by inflating soft axes.

**Pass bar 9.0 met. `winnerId: "composite"`. Promote.**
