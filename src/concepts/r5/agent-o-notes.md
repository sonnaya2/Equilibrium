# Agent O — Ink leftovers (R5 residual polish)

Minimal ink / accent SMELL cleanup from `bot-audit.md` + `must-fix.md` P1–P2. No data invention, no e2e string changes, no P0 TELL work (CombatTabs / shared tabs left for other agents if still open).

## Edits

| File | Change | Smell / item |
|---|---|---|
| `app/data/page.tsx` | Research notes body `text-parch-300` → `text-parch-100` | SMELL #5 / must-fix §4 |
| `app/layout.tsx` | Footer band `parch-500` → `parch-300`; Concepts link `parch-400` → `parch-300`; Sources link → `parch-100` | SMELL #6 / must-fix §5 |
| `src/components/ResearchBrowser.tsx` | Drop `tracking-tight` on region + skill `h2`s | SMELL #3 / must-fix §9 |
| `src/components/ResearchBrowser.tsx` | Remove six-cell catalog count strip; keep single meta count line; drop redundant inner **Browse** `h2` (counts already on that line) | SMELL #1 / must-fix §8 A + TELL #1 cheap side-clear |
| `src/components/ResearchSection.tsx` | Drop `tracking-tight` on tool section `h2` | SMELL #3 (research shells) |
| `src/components/QuestBrowser.tsx` | Drop `tracking-tight` on Quests `h2` | same ladder |
| `src/components/PermanentUnlockResearch.tsx` | Drop `tracking-tight` on Permanent unlocks `h2` | same ladder |
| `src/components/ProgressionResearch.tsx` | Drop `tracking-tight` on Progression research `h2` | same ladder |
| `src/components/BuildPlanner.tsx` | Tier caption `text-gem-400` → `text-parch-100` (“Tier N · pick one”) | SMELL #8 / must-fix §7 |

## Left alone (on purpose)

- **Trademark substring** `RuneScape is a trademark of Jagex Ltd.` — text unchanged (e2e frozen); only ink class on the footer container.
- **Gem on active chrome** — Nav, `WorkbenchTabs`, ResearchSection active filter underline, selected list rows, selected hex cells. Not demoted.
- **ResearchSection filter gem** — only when active (`border-gem-400 text-gem-300`); no non-active gem chrome found.
- **P0 CombatTabs → WorkbenchTabs**, MethodTable → `.data-table`, em-dash effect lines, `.stat-strip .stat-label` — out of this agent’s ink-leftover pass.
- **No invented data**, no copy rewrites beyond structural delete of the duplicate “Browse” label.

## Verify notes

- Footer still exposes the frozen trademark string for e2e.
- Catalog strip delete loses only redundant tiles (relic/blessing/task counts were strip-only extras not on the remaining meta line). Region/skill/method counts remain in the header meta line. Relic/blessing/task dataset counts remain available on Build / Tasks / catalog JSON if needed later; not re-added as dashboard tiles.
- Region list buttons with region crests: untouched; accessible names still start with display names.
