# Agent M — Crests + Data (R5 production)

**Scope:** ResearchBrowser region list identity, Data Browse title surface, shared workbench idle ink, shared `.data-table` on research tables. No Map 3D, no Combat, no e2e string/selector changes.

## Changes

### `src/components/ResearchBrowser.tsx`

1. **Region crests in listbox rows**
   - Import `GameIcon` + `regionCrestPath` from existing art helpers (same pattern as GearPanel).
   - Region options: `grid-cols-[auto_1fr_auto]` with 18px crest (`alt=""` via GameIcon default) so accessible names stay text-only.
   - Skill rows unchanged (no crest).

2. **Redundant Browse title**
   - Removed inner `h2` “Browse” (nav Data + page Data + tab Browse already title the surface).
   - Kept a single meta line: `N regions · N skills · N methods` at `text-[12px] text-parch-100`.

3. **Tables → `.data-table`**
   - Method table and region content table use `className="data-table min-w-[…]"`.
   - Dropped hand zebra / per-table border collapse; sticky thead + odd-row zebra come from globals.
   - Secondary cells use `.secondary` where the cell is meta (type, where, needs, status).
   - Upgrade list stays custom grid rows (not a table) — not rewritten.

### `src/components/WorkbenchTabs.tsx`

- Idle tab ink: `text-parch-300` → **`text-parch-100`** (hover `parch-50`; selected gem underline unchanged).
- Affects Data, Build, and any surface that mounts shared tabs (Combat if already on WorkbenchTabs).

## e2e / frozen contract

- No brand, nav, region pick-button, `0/3`/`3/3`, footer trademark, or WebGPU fallback strings touched.
- Listbox crests use empty alt — do not rename region option accessible names.
- No Playwright selectors pin “Browse” h2 or ResearchBrowser table classes.

## Left intentional

- Catalog 6-cell strip was already absent in this tree; not reintroduced.
- Skill listbox remains text-only.
- Upgrade blocks stay non-table layout.
- No new tokens / no palette edits.

## Verify

```bash
npm run typecheck
npm test
# e2e only if a selector regression is suspected; none expected for this pass
```
