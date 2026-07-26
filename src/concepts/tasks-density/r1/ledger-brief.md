# Team Ledger · Wiki Strip — layout brief

**Codename:** Wiki Strip  
**Thesis:** Full-width dense table (wiki energy). Region filter = compact horizontal crest strip. Detail = bottom drawer under the list — **no permanent third column**.

## What padding died

| Production twin-desk waste | Wiki Strip cut |
|---|---|
| ~160–200px left crest **side rail** (labels + tall leaves) | Horizontal crest strip **~32px** total height; crests scroll sideways |
| Permanent right **inspector column** (~260–320px) even when scanning | Bottom drawer only; list keeps full workbench width |
| Row py-2 + region **sub-line** under name (~36–52px effective) | Single-line **28px** rows; region is a column, not a second line |
| Stage bar multi-row wrap voids | One compact toolbar row (title · counts · search · facets) |
| 40px+ empty panel guts | Stage/list owns `min(78vh, 48rem)`; drawer is content-height only |

## Row geometry

| Spec | Value |
|---|---|
| Row height | **28px** (`--td-row-h: 1.75rem`) |
| Virtualizer `rowEstimatePx` | **28** |
| Sticky thead | **24px** (`1.5rem`) |
| Task name | **14px** (`0.875rem`) — data-readability floor |
| Comp% / Pts | mono **13px** + `tabular-nums` |
| Tier / region meta | 11–12px |
| Column heads | 10px uppercase |

### Column template (desktop)

```
1.15rem | minmax(0,1fr) | minmax(5.5rem,7.5rem) | 3.75rem | 3.25rem | 2.5rem
 check  | name ≥14px    | region crest+label    | tier    | Comp%   | pts
```

Comp% column omitted when no completion rates in the record set.  
&lt;720px: region column collapses; name remains full-width primary.

## Layout widths / stack

```
┌── toolbar  (~28–36px, wrap only if narrow) ──────────────────────┐
├── crest strip  (~32px, overflow-x) ──────────────────────────────┤
├── list stage  height: min(78vh, 48rem)  full width ───────────────┤
│   sticky head + virtualized body                                  │
├── bottom drawer  content-height (~48–120px typical) ──────────────┤
└───────────────────────────────────────────────────────────────────┘
```

- **No third column.** Signature is strip → table → drawer (Map Board Sky adjacency lesson applied to Tasks).
- List max: **`min(78vh, 48rem)`** via `--td-list-h`.
- Crest buttons: `flex: 0 0 auto`, max-width ~9.5rem each — dense horizontal rail, not a vertical taxonomy tree.
- Scoped root: **`.td-ledger` only** (`ledger.css`). Editorial tokens (`stone-*`, `parch-*`, `gem-*` chrome, `gold-*` display title).

## Feature parity (ops)

All via `useTasksDesk` + shared helpers:

- My build toggle (+ electives hint → `/build`)
- Region crest strip + counts
- Tier facet chips
- Debounced search
- Checkbox progress + localStorage
- Comp% wiki deep-links (`formatCompRate`, `wikiTaskUrl`)
- Virtualization (`@tanstack/react-virtual` through desk hook)
- Selected detail: pts, Comp%, locality, description, requirements, skills/areas, Open on Wiki

## Scan contract

- Head-still: Comp%, pts, tier, region stay in fixed columns
- Names never drop below 14px
- Gem only on pressed facets / selected inset / done ink / wiki hover
- Gold only on the small display title “Task board”
