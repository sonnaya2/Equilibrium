# Team Spike · BOARD-FIRST — Tasks density R1

**Codename:** Board-first  
**Team:** Spike  
**Skin:** `.td-spike` in `spike.css`  
**Preview:** `SpikePreview.tsx`  
**Scope:** concepts lab only — no production `TaskRecords` / `globals.css` edits.

---

## Thesis (3-second read)

**Stage owns the height.** Borrow Board Sky’s majority-surface lesson: the task list is the board, not a strip squeezed between rail and permanent inspector.

Filters collapse into **one facet row** (search · My build chip · tier chips · horizontal crest strip). **My build is a chip only** — no essay strip under the toolbar. The inspector **does not exist until the player clicks a row**; before that, the stage is full width. After click, a **~12rem** right bay opens. Re-click the same row or **Close detail** collapses it.

```
┌─ facet row (counts · search · My build · tiers) ─────────────────────┐
│  crest · crest · crest · … (horizontal, compact)                     │
├──────────────────────────────────────────────────────┬───────────────┤
│  sticky head                                         │  inspector    │
│  virtualized rows  (majority height, ≥58vh stage)    │  only when    │
│  Comp% · pts mono · ≥15px names                      │  selectedId   │
│                                                      │  (~12rem)     │
└──────────────────────────────────────────────────────┴───────────────┘
   no selection → single column, stage full width
```

---

## Why this topology

| Competitor risk | Spike answer |
|---|---|
| Permanent third column eats rows when nothing is selected | Inspector mounts only on user click |
| Tall crest rail steals width from names | Horizontal crest strip under facets |
| Essay “My build · starters only…” steals a full line | Chip + `title` tooltip only |
| Twin desk always 3-bay even with empty detail | Board-first: 1 bay → 2 bay on demand |

Fixed recipe still holds: Editorial tokens, crystal facet chips, real Catalyst data via `useTasksDesk`, virtualization, Comp% wiki deep-links, progress checkboxes.

---

## Feature parity (must work)

| Feature | Where |
|---|---|
| My build | Facet chip (`aria-pressed`) |
| Region filter | Horizontal crest strip + All |
| Tier filter | Facet chips (right-clustered) |
| Search | Debounced via `useTasksDesk` |
| Progress | Row checkbox → `toggleComplete` / `saveProgress` |
| Comp% | Mono cell; wiki deep-link when `wikiTaskId` present |
| Virtualization | `@tanstack/react-virtual` through desk hook |
| Detail | Points, Comp%, locality, description, requirements, skills/areas, Wiki CTA |
| Crest preload | `RegionCrestPreload` for league ids on the rail |

No invented tasks. Data is whatever `loadConceptTasks` passes in.

---

## Interaction law

1. **Default:** `selectedId === null` → no inspector column, no row `is-on`.
2. **Click / Enter / Space on row:** set `selectedId` (toggle off if same row).
3. **Filter change:** desk hook clears `selectedId` and scrolls list to top → bay collapses.
4. **Keyboard:** rows are focusable; selection still requires Enter/Space (or click) so empty bay never opens for focus-only.
5. **Close detail** button and re-select toggle both clear the bay.

---

## Visual law

- Scope everything under `.td-spike` (bridge Editorial `--color-*`).
- Gem = pressed chips / selected row inset / wiki hover. Gold = “Task board” + inspector kicker only.
- Names **15px** (`0.9375rem`). Sticky thead uppercase 11px. Mono tabular for Comp%/pts.
- Stage min-height `min(58vh, 36rem)` inside shell `min(72vh, 44rem)` — first screen is mostly rows.
- No glass, no SaaS cards, no gold buttons, no marketing strip.

---

## Honest self-score (pre-CEO)

| Axis | Wt | Score /10 | Note |
|---|---|---|---|
| Viewport fill | 25 | **9.0** | Full-width stage until click; tall list; crest strip is one line not a rail |
| Scan ergonomics | 20 | **8.5** | Head-still columns; 15px names; crest strip adds a second facet line (acceptable, not free) |
| Operability | 20 | **9.0** | Full desk hook parity; toggle bay; wiki + progress |
| Crystal × Data fidelity | 15 | **8.5** | Facet chips + carved stage; Board Sky height lesson explicit; twin-desk DNA evolved not cloned |
| Anti-slop | 10 | **9.0** | No cards/glass/hero; gold display only |
| Signature | 10 | **9.0** | Collapsing bay + stage majority is obvious in 3s |
| **Weighted** | | **~8.8** | Pass bar is 9.0 — strong thesis, slight cost from two-line facet+crest wrap on narrow widths |

Hard-fail check: no permanent empty inspector; no invented data; names ≥14px; My build / progress / wiki intact.

---

## Files

| Path | Role |
|---|---|
| `src/concepts/tasks-density/r1/SpikePreview.tsx` | Preview (export `SpikePreview`) |
| `src/concepts/tasks-density/r1/spike.css` | Scoped skin `.td-spike` |
| `src/concepts/tasks-density/r1/spike-brief.md` | This brief |
