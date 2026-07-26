# R2 composite brief — CEO must-fix

**Source:** R1 CEO verdict. Pass bar still **9.0**.

## Assemble the winning combo (nobody did R1)

1. **Full-width stage** (Ledger / Aperture) — no permanent rail, no permanent third bay
2. **28–30px single-line rows** (Ledger / Aperture / Quarry geometry — not Spike’s 36px + subline)
3. **One region chrome band** — either horizontal crest strip **or** select, not both, and **no region column if strip/select already shows locality**
4. **Collapsible detail** (Spike law): `selectedId === null` by default; open on click; re-click or Close toggles off; **no auto-first-row permanent drawer/stage**
5. **One facet row**: title/count · search · My build chip · tier chips · region control
6. List height: `min(78vh, 48rem)` or better `calc(100vh - chrome)`

## Steal explicitly

| From | Take |
|---|---|
| Ledger | 28px table, sticky thead, Comp%/pts columns, wiki strip energy |
| Spike | mount-on-click inspector/drawer, collapse, re-select toggle |
| Aperture | full width reclaim, select-in-facet option |
| Quarry | fidelity of facet/gem language; skip permanent 12rem bay |

## Deliverable

- `src/concepts/tasks-density/r2/CompositePreview.tsx` export `CompositePreview`
- `src/concepts/tasks-density/r2/composite.css` scoped `.td-composite`
- Use `useTasksDesk` — may need a local override for selectedId default so first row is NOT auto-selected for detail UI (if desk forces selected fallback, ignore desk.selected for detail panel until selectedId is set)

## Do not

- Ship to production TaskRecords yet
- Invent tasks / new palette
