# CEO verdict — GUI tournament ROUND 4 (production ship)

**Theme:** production readable color system + surface polish (agents J / K / L).  
**Pass bar:** 9.0 / 10.  
**Winner this round:** **`r4-tokens`** at **9.0**.  
**Hard fails checked:** marketing hero · pink/Print · order-blue chrome · gold active nav · invented league numbers as real — **none tripped**.

## Submission gate — PASS

R4 is **not** mock theater. Scored artifacts are live production surfaces plus agent notes:

| Lane | What was judged | Agents |
|---|---|---|
| `r4-tokens` | `app/globals.css` `@theme` + `.data-table` + `src/map/palette.ts` SURFACE/PARCH | foundation |
| `r4-data-tasks` | Research / Data / Tasks ink+size floors | J + K (tasks) |
| `r4-shell-combat` | Nav · Build · Map DOM · Combat polish | K (combat) + L |

Spot-check also covered: `Nav.tsx`, `ResearchBrowser.tsx`, `TaskRecords.tsx`, `BuildPlanner.tsx`, `combat/BuildTab.tsx`, `WorkbenchTabs.tsx`, Map ledger/inspector.

---

## Axis scores (points out of weight)

| Axis | wt | r4-tokens | r4-data-tasks | r4-shell-combat |
|---|---:|---:|---:|---:|
| workbenchFill | 20 | 17.5 | 17.0 | 16.5 |
| categorization | 20 | 17.5 | 18.0 | 16.5 |
| readability | 15 | **14.5** | 13.0 | 12.5 |
| gameIdentity | 15 | 13.5 | 11.5 | 12.0 |
| antiSlop | 15 | 14.0 | 14.0 | 14.0 |
| operability | 10 | 8.5 | 9.0 | 8.5 |
| consistency | 5 | 4.5 | 4.0 | 4.0 |
| **Total pts** | **100** | **90.0** | **86.5** | **84.0** |
| **Score /10** | | **9.0** | **8.7** | **8.4** |
| Status | | **winner · PASS** | contender | contender |

**Rank order:** tokens → data-tasks → shell-combat  
**overallWinner:** `r4-tokens`  
**Overall production score (combined ship):** **8.9 / 10**

---

## R4 PASS — production readable system approved for ship continuation

The color/readability contract is no longer a mock. Hybrid Full’s dialed ladder is in `@theme`, mirrored in `palette.ts`, and applied as Wiki Dense law on `.data-table`. Void stays `#0d0a07`. Raised is `#2a2218` (the R3 identity tax). Stage is `#231c14`. Body/secondary ink clear arm’s-length scan without bleaching the room into a washed desk.

Polish lanes land below 9.0 because **adoption and crest debt** remain — but they do not undo the system pass. Tournament may **not fully close** until a short R5 pays those; R6 only if crests/shell still miss after R5.

---

## 1. r4-tokens — 9.0 / 10 · winner

**Thesis held:** ship the Hybrid Full surface ladder + micro parch + Wiki Dense table law into production tokens only — no permanent product inline palette.

### Axis table

| Axis | pts | /max | Call |
|---|---:|---:|---|
| workbenchFill | 17.5 | 20 | Tokens + `.panel` + `.data-table` + field-inset give every dense surface a real stage ground; does not itself invent new IA. |
| categorization | 17.5 | 20 | Role ladder is explicit: void / shell / rail / stage / zebra / raised / inset + parch primary·secondary·meta. |
| readability | 14.5 | 15 | **Pass-bar axis.** 15px body `parch-50`, 12px headers `parch-100`, secondary cells `parch-100`, zebra `#1a1510`, sticky opaque thead on stage `#231c14`, hover raised `#2a2218`. Arm’s-length on ship hexes. |
| gameIdentity | 13.5 | 15 | Warm umber void held; raised dialed down from Full’s `#2c241a` → `#2a2218`; gem/gold roles untouched. Not a mid-brown SaaS bench. |
| antiSlop | 14.0 | 15 | No hero, no pink, no path chrome, no gold-as-active. Clean component primitives. |
| operability | 8.5 | 10 | Sticky head + zebra + hover/raised aid scan; selected-row gem outline rule still missing from `.data-table`. |
| consistency | 4.5 | 5 | `palette.ts` SURFACE/PARCH/EDGE match CSS hexes. Micro drift: shipped `parch-300` `#c8b89c` (brighter than R3 preferred `#b5a990`) — acceptable, slightly better caption contrast. |

### Exact ladder — verified ship

| Role | Token | R3 preferred | Shipped | Match |
|---|---|---|---|---|
| void | `stone-950` | `#0d0a07` | `#0d0a07` | exact |
| shell | `stone-900` | `#12100c` | `#12100c` | exact |
| rail | `stone-850` | `#1c1711` | `#1c1711` | exact |
| stage | `stone-800` | `#231c14` | `#231c14` | exact |
| zebra | `stone-zebra` | `#1a1510` | `#1a1510` | exact |
| raised | `stone-raised` | `#2a2218` | `#2a2218` | exact |
| inset | `stone-inset` | `#18140f` | `#18140f` | exact |
| border | `stone-750` | `#463a29` | `#463a29` | exact |
| carve | `stone-carve` | `#5c4a34` | `#5c4a34` | exact |
| parch-50 | | `#f0e9d7` | `#f0e9d7` | exact |
| parch-100 | | `#e0d4ba` | `#e0d4ba` | exact |

### Five bullets

1. **Closes the R3 0.1 gap on the surface that caused it** — raised is no longer Full’s warm desk fill.
2. **Wiki Dense is law in CSS**, not a lab table — body 15 / head 12 / zebra / sticky opaque / secondary bright.
3. **Map 3D stays on the same ink/surface numbers** via `palette.ts` — one system, two renderers.
4. **Under-adoption is product debt, not system failure** — Research still hand-rolls table classes; QuestBrowser overrides sticky fill to `stone-850`.
5. **Missing selection outline** (`raised` + gem inset) is the only incomplete row of the R3 table contract.

### R5 must-fix (tokens residual)

- Add `.data-table tbody tr[aria-selected="true"] td` / selected helper: raised fill + 1px gem outline.
- Prefer consuming `.data-table` in Research dense tables (or document hand-roll as intentional parity).
- Quiet `stat-strip .stat-label` off `parch-500` toward `parch-300` (meta only).

---

## 2. r4-data-tasks — 8.7 / 10 · contender (rank 2)

**Thesis held:** apply the ladder on Data research surfaces (J) and Tasks list ink (K); no host remount redesign.

### Axis table

| Axis | pts | /max | Call |
|---|---:|---:|---|
| workbenchFill | 17.0 | 20 | ResearchBrowser fills with list + dense method/content tables; Tasks is a purposeful checklist (not a fake 3-col). |
| categorization | 18.0 | 20 | `DataWorkbench` mount-active tabs; Browse region/skill modes; Tasks tier filter group. Strong IA already product. |
| readability | 13.0 | 15 | Data hits 15px / 12px / zebra / raised active — best production scan outside `.data-table`. Tasks at `text-sm` / `text-xs` with secondary `parch-100` — readable, not full Wiki Dense stage. |
| gameIdentity | 11.5 | 15 | Still crest-starved in research trees and rows (open R1–R3 debt). Warm ink only. |
| antiSlop | 14.0 | 15 | Gem only when pressed/selected; no gold chrome; empty states honest. |
| operability | 9.0 | 10 | Filter, search, listbox, tabs, task progress — product-complete. |
| consistency | 4.0 | 5 | Hand-rolled tables match law but bypass `.data-table`; WorkbenchTabs idle ink still `parch-300` while Nav uses `parch-100`. |

### Five bullets

1. **J paid the Data scan bill** — method tables and listboxes no longer live in 10–11px mud.
2. **Secondary-cell law is real in production rows** — region/meta as `parch-100`, not caption brown.
3. **Tasks are clearer** but remain list density, not stage+zebra tables — acceptable for the route, not a token showcase.
4. **Crest debt is the identity floor** that keeps this under 9.0.
5. **WorkbenchTabs idle `parch-300`** undercuts the Data category strip after Nav was lifted.

### R5 must-fix (data/tasks)

- Inject `GameIcon` / region crests on region list leaves and region-bearing dense rows.
- Align WorkbenchTabs idle ink to `parch-100` (match Nav).
- Optional: zebra on long task lists; sticky opaque header where Tasks grows into table shape.

---

## 3. r4-shell-combat — 8.4 / 10 · contender (rank 3)

**Thesis held:** shell, Build planner, Map DOM rail/inspector, Combat forms — lift muddy `parch-400/500` and sub-12px labels without redesign.

### Axis table

| Axis | pts | /max | Call |
|---|---:|---:|---|
| workbenchFill | 16.5 | 20 | Build lattice + inspector + Map ledger already fill product routes; polish is ink, not new density. |
| categorization | 16.5 | 20 | Regions / Relics / Blessings / Share segments intact; Combat tabs unchanged structurally. |
| readability | 12.5 | 15 | Nav inactive → `parch-100`; Build captions → 12px floors; Map meta off `parch-500`. Combat settles at 14px data / 12px labels — good form floor, not table-law maximum. |
| gameIdentity | 12.0 | 15 | Build stays crest-first where lattice already was; Map DOM remains instrument chrome over the wartable. Combat gear crests present in gear surfaces only. |
| antiSlop | 14.0 | 15 | Gem active nav/tabs preserved; gold brand only; e2e frozen strings untouched (L explicit). |
| operability | 8.5 | 10 | Picks, Clear picks, filters, combat fields — no regression. |
| consistency | 4.0 | 5 | Shell ink ladder applied unevenly (`stat-label` still `parch-500`; WorkbenchTabs idle `parch-300`). |

### Five bullets

1. **Nav is finally scannable at arm’s length** without gold-as-active or gem on idle.
2. **Build + Map DOM leave the muddy caption band** — the right surgery for planner surfaces.
3. **Combat is professionally quiet**, not Wiki Dense — correct for form density; do not force 15px everywhere.
4. **Intentionally skipped globals overrides** (L on `stat-strip`) leave a known mud pocket on inspector labels.
5. **Lowest of three** because this lane is residual polish on an already-shipped shell, not the system win.

### R5 must-fix (shell/combat)

- Lift WorkbenchTabs idle + shared `stat-strip` labels in one globals-aware pass.
- Sweep remaining `parch-500` readable labels in Map/Overview shared chrome only.
- Leave combat form size floors alone unless a true table surface appears.

---

## Combined production score — 8.9 / 10

| Layer | Verdict |
|---|---|
| Token system | **9.0** — R4 pass vehicle |
| Dense Data scan | Strong application (J) |
| Tasks / Combat / Shell | Solid floors (K/L), not complete identity |
| Crest / full adoption | Open — holds combined ship at 8.9 |

Combined ship is **better than R3 Hybrid Full (8.9 mock)** on truthfulness (live product, dialed raised, real routes) and **equal on composite score** because crest tree density and universal `.data-table` consumption are still unpaid. Color readability is **approved**; league art density and chrome consistency are **continuation work**.

### Carry-forward ceiling

| Round | Best | Score |
|---|---|---:|
| R1 shell DNA | Control Surface | 9.1 (layout) |
| R2 color track | Raised Bench | 8.4 |
| R3 hybrid mock | Hybrid Full | 8.9 |
| **R4 production** | **r4-tokens** | **9.0** |
| R4 combined ship | tokens + polish | **8.9** |

---

## Ranking summary

| Rank | id | name | score | status |
|---:|---|---|---:|---|
| 1 | `r4-tokens` | Production tokens + `.data-table` | **9.0** | **winner · PASS** |
| 2 | `r4-data-tasks` | Research / Data / Tasks polish | 8.7 | contender |
| 3 | `r4-shell-combat` | Nav / Build / Map DOM / Combat polish | 8.4 | contender |

**Pass:** yes — system.  
**overallWinner:** `r4-tokens`  
**Statement:** **R4 PASS — production readable system approved for ship continuation.**

---

## Tournament close decision

| Question | Answer |
|---|---|
| May the **color/readability tournament** close after R4? | **System track: yes.** Tokens + Wiki Dense law are ship-approved. |
| May the **full GUI tournament** close with zero further rounds? | **No.** Crests + tab idle ink + `.data-table` selection/adoption remain. |
| **R5?** | **Yes — short production debt pass only** (not another concept beauty contest). |
| **R6?** | Only if R5 misses crests in tree+rows or reintroduces mud/desk surfaces. Otherwise **close after R5**. |

### R5 brief only (binding, no mocks)

1. **Crests:** `GameIcon` + `regionCrestPath` on Data Browse region leaves and region-bearing dense rows; `alt=""` inside buttons.
2. **Tab idle ink:** `WorkbenchTabs` inactive → `parch-100` (parity with Nav).
3. **Table contract residual:** selected-row helper on `.data-table`; migrate one flagship Research table onto the class **or** freeze hand-roll as documented parity.
4. **Shared quiet labels:** `stat-strip .stat-label` → `parch-300` (meta), not body mud.
5. **Do not reopen** stage hexes, void, or ink-only repaints. Ladder is locked.

---

## Ranking return (machine-facing)

```
1. r4-tokens        9.0  PASS  overallWinner
2. r4-data-tasks    8.7  contender
3. r4-shell-combat  8.4  contender
combinedShip        8.9
tournamentClose     after R5 debt pass (crests + chrome consistency); R6 only if R5 fails
```
