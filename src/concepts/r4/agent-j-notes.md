# Agent J — Data scan (R4 readability)

Scope: Data route research surfaces only. No workbench mount changes; tab keys/logic untouched.

## Ladder applied

| Role | Size | Colour |
|------|------|--------|
| Table / row body | `text-[15px]` (notes ≥14px) | `text-parch-50` primary, `text-parch-100` secondary |
| Labels / thead / meta | `text-[12px]` | `text-parch-100` |
| Active controls | unchanged | `text-gem-300` + gem border only when pressed/selected |
| Surfaces | — | `bg-stone-raised` active list items; odd rows `bg-stone-zebra` |

## Files

### `src/components/ResearchBrowser.tsx`
- Method + content tables: 15px body, 12px headers, zebra odd rows.
- Lifted muddied `text-xs` / `text-[10px]` / `text-[11px]` / `parch-300` body off readable content.
- Skill listbox matched region listbox (15px names, 12px meta, `stone-raised` active).
- Mode / filter chips: 12px labels; gem only when active; raised fill when pressed.
- Prose (rules, notes, warnings, empty states) → 14–15px `parch-100`/`parch-50`.

### `src/components/ResearchSection.tsx`
- Shared shell for most Data tabs (Slayer, Invention, Consumables, etc.).
- Intro / description / detail body → 15px; subtitle / region / status → 12px `parch-100`.
- Row titles 15px `parch-50`; odd rows zebra.
- Tab chrome 12px; gem only on selected tab.

### `src/components/PermanentUnlockResearch.tsx`
- Custom duplicate of ResearchSection row layout — same size/colour ladder as above.

### `src/components/ProgressionResearch.tsx`
- Same as PermanentUnlock: size lift + parch ladder + zebra; no logic changes.

## Not touched
- `DataWorkbench` / host mount-active behaviour.
- Thin `*Research.tsx` wrappers that only feed `ResearchSection` (they inherit the shell fix).
- No new design tokens.
