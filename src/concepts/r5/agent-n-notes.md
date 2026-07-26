# Agent N — Combat WorkbenchTabs (R5)

## Scope

P0 item 1 from `must-fix.md` + P3 item 10 (stat-strip caption lift).

## Changes

### `src/components/combat/CombatTabs.tsx`

- Replaced hand-rolled gem tab row with shared `WorkbenchTabs` + `WorkbenchPanel` from `@/components/WorkbenchTabs` (same contract as DataWorkbench / BuildPlanner).
- Tabs (ids = labels): Quick · Build · Rotation · Analysis · Reference.
- **Build** mounts existing `SetupTab` (component name unchanged; chrome label matches must-fix / e2e Build fallback).
- Default tab remains Quick; only the active panel mounts.
- Gem active styling is owned by `WorkbenchTabs` (`border-gem-400` + `text-gem-300`).
- Added `role="tablist"` / `role="tab"` / `role="tabpanel"` via the shared chrome (`aria-label="Combat sections"`).

### `app/globals.css` — `.stat-strip .stat-label`

- `color: var(--color-parch-500)` → `var(--color-parch-300)` for ≥4.5:1 caption contrast on map inspector strips (R4 secondary-ink ladder).

## Non-changes

- No SetupTab / calculator / rotation logic edits.
- No e2e edits (`openSetupTab` already prefers Setup then falls back to Build).
- No palette / token inventing; no Combat form floors.

## Verify

```bash
npm run typecheck
# optional if re-running combat selectors:
# npm run test:e2e -- e2e/combat.spec.ts
```
