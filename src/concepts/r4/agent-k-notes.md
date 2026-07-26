# Round 4 — Agent K: Combat + Tasks ink

**Scope:** Production polish only — ink/size floors on Combat tabs and Task records. No layout redesign, no token hex edits, no hero chrome.

## Law applied

From `equilibrium-ui` density floors + R3 Hybrid Ink secondary-body rule:

| Role | Floor | Ink |
|---|---|---|
| Data (names, figures, list rows, table cells) | `text-sm` (14px) | `parch-50` primary / `parch-100` secondary |
| Field labels / dt / checkbox rows | `text-xs` (≥11px) | `parch-100` (was `parch-300`) |
| Quiet helper prose under section heads | `text-xs` | `parch-300` kept |
| Key result figures | already `text-sm`+ mono | `parch-50` |

`parch-300` is **not** sole body ink on scannable rows. `stone-700` is not a theme token — migrate to `stone-750` / `stone-850`.

CombatTabs gem-active pattern (`border-gem-400` + `text-gem-300`) **left alone**.

## Changes

### Shared

- `NumberField`: label `parch-100`; mono input `text-sm parch-50`; suffix `parch-100`.

### Combat tabs

- **Quick:** style toggles idle `parch-100`, selected border `stone-750` (not `stone-700`); ability list `text-sm` + idle `parch-100`; result `dt` → `parch-100`.
- **Build:** section heads `text-sm`; checkbox/select labels `parch-100`; selects `text-sm`; equipment rows `text-sm` + secondary meta `parch-100`; sort chips no `stone-700`.
- **Analysis:** ability list + A/B stat dl at data floor; table header/line labels `parch-100`; section heads `text-sm`.
- **Rotation:** loadout strip + palette/queue lists at `text-sm`; mode/style chips + Run CTA borders on `stone-750`; cast table mono cells `text-sm` / secondary `parch-100`.
- **Revolution:** bar slot names `text-xs`; modelled chip border `stone-750`; summary dt + contribution rows lifted.

### Tasks

- Filter idle chips `parch-100`; count meta `text-sm parch-100`.
- Description `text-sm parch-100` (readable content, not caption).
- Requirements / region·skills meta: `text-xs parch-100` (was `text-[11px] parch-400`).
- Tier badge + pts unit: `parch-100`.
- Mobile Comp% label: `text-[11px]` floor (was `10px`).

## Left intentional

- Helper captions under h2/h3 stay `text-xs parch-300`.
- CombatTabs gem underline unchanged.
- No pink, no gold on interactive chrome, no layout grid changes.

## Files touched

```
src/components/combat/NumberField.tsx
src/components/combat/QuickCalculator.tsx
src/components/combat/BuildTab.tsx
src/components/combat/AnalysisTab.tsx
src/components/combat/RotationPlanner.tsx
src/components/combat/RevolutionPanel.tsx
src/components/TaskRecords.tsx
src/concepts/r4/agent-k-notes.md
```

CombatTabs.tsx — inspected only, no edit.
