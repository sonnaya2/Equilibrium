# R5 must-fix — CEO 9.0 blockers only

Ordered concrete edits. Scope preference: files in the R5 audit set. Adjacent files only when the same defect blocks the axis.

**Do not** restyle the product, invent a new palette, strip sanctioned exceptions (frost / timber / dark ground / path triad), or redesign Map 3D.

**Pass intent:** bot-audit → **PASSES** (SMELLs only or clean) + pick up consistency / operability / residual readability for ≥9.0.

---

## P0 — clear both TELLs (anti-slop + consistency)

### 1. `src/components/combat/CombatTabs.tsx` — adopt shared tab chrome

**Change:**
- Import `WorkbenchTabs` + `WorkbenchPanel` from `@/components/WorkbenchTabs`.
- Replace the hand-rolled `flex gap-1 border-b…` button row with:

```tsx
const COMBAT_TABS = [
  { id: "Quick", label: "Quick" },
  { id: "Build", label: "Build" },
  { id: "Rotation", label: "Rotation" },
  { id: "Analysis", label: "Analysis" },
  { id: "Reference", label: "Reference" },
] as const;
// …
<WorkbenchTabs aria-label="Combat sections" tabs={COMBAT_TABS} active={tab} onChange={setTab} />
<WorkbenchPanel id="Quick" active={tab}><QuickCalculator /></WorkbenchPanel>
// …same for Build / Rotation / Analysis / Reference
```

**Why:** One tab system across Data / Build / Combat (consistency 5, operability a11y). Removes TELL #2. Visual gem underline already matches.

**Verify:** Combat still mounts only the active panel; frozen e2e does not pin combat tab roles — no e2e change required unless a selector exists.

---

### 2. `src/components/ResearchBrowser.tsx:417-422` — kill redundant Browse title

**Change:**
- Delete the `h2` “Browse” (or replace the whole top bar with a single meta line).
- Keep the dataset count line (`N regions · N skills · N methods`) as plain `text-[12px] text-parch-100`, left or right aligned under the workbench tabs — not as a second section title.

**Why:** Clears TELL #1 (nav Data + h1 Data + tab Browse + h2 Browse).

---

## P1 — readability / shared table law (readability + consistency)

### 3. `src/components/ResearchBrowser.tsx` — MethodTable + content table → `.data-table`

**Change:**
- Method table (~L128) and content table (~L234): use `className="data-table min-w-[…]"` (keep min-width wrappers).
- Drop per-row hand zebra if `.data-table tbody tr:nth-child(odd)` covers it; keep `align-top` via `align-top` on `tr` or `td` utilities if needed.
- Ensure thead cells stay 12px uppercase via `.data-table th` (remove competing `text-[12px]` noise only where redundant).

**Why:** Sticky opaque headers + one table skin. Long training lists stop losing column meaning on scroll.

---

### 4. `app/data/page.tsx:29` — research notes ink

**Change:**
- `text-parch-300` → `text-parch-100` on the notes `<p>` (keep `text-sm leading-6`).
- Optional: `max-w-3xl` can stay; do not widen into a blog column.

**Why:** Multi-sentence body must clear the R4 secondary-ink ladder.

---

### 5. `app/layout.tsx:40-48` — footer readable quiet

**Change:**
- Footer container: `text-parch-500` → `text-parch-300`.
- Concepts lab link: `text-parch-400` → `text-parch-300` (hover `parch-50` stays).
- Sources link already `parch-300` — leave.
- **Do not** alter the trademark substring `RuneScape is a trademark of Jagex Ltd.` (e2e frozen).

**Why:** Last global mud band; legal line still quiet, still arm’s-length legible.

---

## P2 — micro tells that cheaply buy anti-slop / accent discipline

### 6. `src/components/BuildPlanner.tsx:292,412` — em-dash in effect lines

**Change:**
- ` — ` → ` · ` (or `: `) between choice name and effects.

**Why:** Language micro-tell in user-facing relic/blessing summaries.

---

### 7. `src/components/BuildPlanner.tsx:263` — tier caption gem

**Change:**
- `text-gem-400` on “Tier {n} · pick one” → `text-parch-100` (or `text-parch-300`).
- Selected relic cells already carry gem via `hexClass(…, "selected")`.

**Why:** Gem reserved for active chrome + selected cells, not every tier eyebrow.

---

### 8. `src/components/ResearchBrowser.tsx:424-431` — collapse or demote catalog strip

**Change (pick one):**
- **A (preferred):** Delete the 6-cell strip; counts already appear in the list header (`:421`).
- **B:** Keep one horizontal meta line of plain text (`11 regions · 7 relic tiers · …`) without the panel grid cells.

**Why:** Removes dashboard-tile SMELL without losing information.

---

### 9. Region/skill titles — drop `tracking-tight` (in audited browser)

**Change in `ResearchBrowser.tsx:186,307`:**
- `text-2xl font-semibold tracking-tight text-parch-50` → `text-2xl font-semibold text-parch-50`  
  (or `font-display text-xl uppercase tracking-[0.1em] text-parch-50` only if you want Build-inspector parity — do **not** gold them).

**Why:** Soft SaaS headline tell; not a hard fail alone.

---

## P3 — optional axis polish (only if still under 9.0 after P0–P2)

### 10. `app/globals.css` — `.stat-strip .stat-label`

**Change:** `color: var(--color-parch-500)` → `var(--color-parch-300)` (or `parch-100` if map inspector still muddy in screenshots).

**Why:** Completes R4 caption lift for the shared strip. Touches Map inspector — re-squint map after.

### 11. Out of strict audit set but same ladder (if Combat still reads small)

- `src/components/combat/GearPanel.tsx:184` — slot label `text-[10px]` → `text-[11px]` minimum (`text-xs` preferred).
- `src/components/QuestBrowser.tsx:61,140` — intro `parch-300` → `parch-100`; `cross-region` `parch-500` → `parch-100`.

Only if CEO still docks readability after P0–P2.

---

## Explicit non-fixes (do not open)

| Temptation | Why not |
|---|---|
| Strip cell gradients / unrevealed frost | Sanctioned; stripping → WASHED |
| Lighten void ground toward SaaS slate | Dark warm ground is product law |
| Gold active nav or order-blue buttons | Hard-fail chrome |
| New radii / shadow elevation system | One carve method already ships |
| Hero or feature cards on Overview | Would BUST anti-slop |
| Rewrite Overview into marketing | Already correct: status + table |
| Pin e2e dates / change brand string | Frozen contracts |

---

## Done when

1. Re-run bot-audit mindset on the same file set → **PASSES** (no TELLs).  
2. `CombatTabs` and `WorkbenchTabs` share one implementation.  
3. Data Browse has a single title surface (page h1 + tab; no inner “Browse”).  
4. Research long tables keep headers (`.data-table` sticky).  
5. No new hex outside tokens; no production copy with marketing lexicon.  
6. Local: `npm run typecheck` · `npm test` · `npm run test:e2e` if selectors touched (Combat a11y roles usually fine; re-run if any test queries combat tabs).

**Fix route:** `ui-humanizer` for P0/P1/P2 structure · `text-humanizer` only for em-dash lines (item 6).
