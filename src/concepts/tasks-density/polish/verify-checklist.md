# Crest Compact polish — verify checklist

**Surface:** production Tasks (`TaskRecords` + `useTasksDesk` + `.tasks-desk`)  
**Date:** 2026-07-26  
**Tests:** `npm test -- src/tasks src/concepts/tasks-density` → **29/29 passed** (4 files)

---

## Checklist

| # | Item | Result | Evidence |
|---|------|--------|----------|
| 1 | No `label`/`htmlFor` on task name (expand ≠ check) | **PASS** | `TaskRecords.tsx`: name is `<span className="tasks-desk__name">`; checkbox uses its own `aria-label`. Row click expands; checkbox does not share a label association. |
| 2 | Checkbox `stopPropagation` on click + change | **PASS** | `onClick={(e) => e.stopPropagation()}` and `onChange` calls `e.stopPropagation()` before `onToggle(id)`. |
| 3 | `regionRail` includes anachronia/tirannwn even when buildOnly + empty electives | **PASS** | `regionRail = regionsInTaskData(records)` — full data rail, never filtered by build. `buildOnly` only scopes `filterOpts` for the multi-region list, not the rail. Tests assert both ids in rail + full counts. Locked electives stay viewable via leaf pick (`allowedRegions: null` when `region !== "all"`). |
| 4 | Crest ≥28px, name ≥15px, check ≥18px | **PASS** | `RAIL_CREST_PX = 30`. `.tasks-desk__name { font-size: 0.9375rem }` → 15px @ 16px root. `--tasks-check: 1.125rem` → 18px. |
| 5 | No right inspector column | **PASS** | 2-bay grid only: `grid-template-columns: var(--tasks-rail-w) minmax(0, 1fr)`. No third bay / side inspector. |
| 6 | Expand under row with Close | **PASS** | `tasks-desk__stage` mounts under the selected row when `selectedId` matches; Close button sets `selectedId` to `null`. Spike law: re-click collapses; no auto-open of first row. |

---

## FAIL items

None.

---

## Notes (non-fail)

- Stage crest is `STAGE_CREST_PX = 22` (inline expand header only). Checklist crest floor applies to the rail crests (30px).
- Concept previews under `r1/` / `r2/` (e.g. Composite still using `htmlFor`) are out of production scope.
- Typecheck not run (no TaskRecords type errors suspected; unit suite clean).
