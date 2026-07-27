# COMMENT-CANDIDATES.md

Rules that would have carried a `/* why */` comment in the old CSS, kept here
instead (rewrite rule: zero comments in shipped CSS). Each entry names the
selector and the constraint that is not obvious from the code.

- `.board-sky__canvas-host > :first-child` (app/globals.css) — `position: absolute !important`
  must beat the React Three Fiber root div's inline `position: relative`; the same rule also
  covers the FlatBoard SVG fallback. Removing `!important` changes map layout, so it stays and
  is logged here per the no-`!important` rule's conflict clause.

- `.board-sky__look-btn:hover` (app/globals.css) — `border-color: currentColor` is the exact
  computed behavior of the former `border-color: var(--color-stone-600)` (`--color-stone-600`
  was never defined; the declaration computed as `unset`, i.e. `currentColor`). Preserved, not
  "fixed".

- `.board-sky__look-btn` / `.board-sky__look-btn.is-on` / `.board-sky__look-btn--gem:hover` /
  `.map-region-marker.is-focus .map-region-marker__name` (app/globals.css) — these previously
  set `color: var(--color-parch-200)` / `var(--color-gem-100)`, neither of which was ever
  defined. The declarations computed as `unset` (inherited), so they were deleted; the
  inherited color is unchanged.

- `.data-organize__arrow` (theme.css, moved to src/components/data.css) — the old
  `color: var(--echo-gem-200, var(--echo-parch-200))` had *both* fallbacks undefined, so the
  declaration never applied. Deleted; the arrow inherits the button color as it always has.

- `.data-organize__type.is-on` (theme.css → src/components/data.css) — old
  `color: var(--echo-gem-100, var(--echo-parch-50))` always resolved to the parch fallback
  (`--echo-gem-100` undefined). Written through as the resolved value.

- `.data-location-link:hover` (theme.css → src/components/data.css) — same pattern:
  `var(--echo-gem-200, var(--echo-gem-300))` always resolved to the gem-300 fallback.

- `@media (prefers-reduced-motion: reduce)` reset (app/globals.css) — `!important` here is the
  sanctioned exception to the no-`!important` rule.

- `body` line-height (app/globals.css) — 1.4, not 1.5: the deleted override layer set 1.4 on
  the same element and won; 1.4 is the resolved production value.

- `.panel` / `.panel-head` / `.panel-body` / `.data-table` / `.facet-chip` (app/globals.css) —
  values are the resolved winners from the deleted global override layer, which always beat the
  old layered base rules (flat panel background, tighter head/body padding, 0.875rem table
  font, all-rows zebra striping, transparent chip face).

- `.tasks-page .facet-chip` (src/components/tasks/tasks.css) — only `min-height` survives on
  purpose: every other facet-chip property resolved to the shared `.facet-chip` rule, and
  re-declaring them here was dead weight that produced a different look the moment the override
  layer was removed.

- `src/map/palette.ts` `GEM_600` — mirrors `--color-gem-600`; the CSS token unified on the
  body's former override value `#167a55`, so the 3D constant moved with it.

- `.mc *` box-sizing (src/components/build-board.css) — deleted: Tailwind preflight already
  applies `box-sizing: border-box` universally; the local copy was a no-op.
