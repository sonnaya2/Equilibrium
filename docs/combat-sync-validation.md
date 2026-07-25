# Combat sync validation — 25 Jul 2026

First full validation of the combat data layer against runescape.wiki, pvme.io and
rs-analysis.xyz, plus the local/remote git state. This file records what was checked and
what it found; the standing mechanism lives in `npm run sync:combat` (see the data-sync
skill for the patch-day loop).

## Sources

- **runescape.wiki — current.** All 76 wiki pages cited in `docs/combat-changelog.md`
  polled via the MediaWiki API (`prop=revisions`): zero revisions newer than the
  changelog's 24 Jul 2026 status date, and the `Game updates` index page was unchanged,
  so no game update landed outside the changelog's coverage.
- **rs-analysis.xyz — reference only.** Per the corpus source policy its displayed sample
  numbers depend on calculator settings and are never stored as game constants. The
  ability audit's `rs_analysis_cross_check` lists the entities confirmed modelled there.
- **pvme.io — discovery only.** PvME-sourced records (the 8 invention perk recipes) carry
  explicit `pvme` provenance and sit outside wiki revision tracking by design; the sync
  report lists them as warnings, not gaps.
- **Engine/corpus consistency — clean.** Engine Assault/Overpower/Dismember-line values
  match the 9 Mar 2026 refinements (§6 of the changelog); the apparent §5.7 conflict was
  release-vs-refinement wording. Corpus igneous Overpower (280–340%) is the post-refinement
  form (AVG 310).

## Git state (was: diverged)

Local `main` and `origin/main` had both moved: 7 local commits (War Table, combat sim) vs
159 remote commits (the data-queue sessions: progression enrichment, prayer books, asset
expansion). Reconciled by merge after confirming the remote already contained the
concurrent session's uncommitted data work. The `agent/permanent-unlocks-pass-2` salvage
was already upstream; trigger-only branches carry nothing to harvest.

## What was missing (and now exists)

At validation time the sync infrastructure was contract-only: all five
`data/combat/*.json` datasets empty, `update-index.json` empty, `sync-combat-data.ts` a
stub, no staleness detection, no region labels on combat entities. Built and validated:

- Datasets populated from the verified corpus (33 abilities, 46 region-tagged items,
  6 curses, 8 perks, 4 effects), every record carrying `SourceReference.verifiedAt`.
- `update-index.json` ledger: 89 tracked entities across 26 wiki pages.
- `npm run audit:combat` and `npm run sync:combat` exit 0 with the COMBAT SYNC report.

## First live staleness incident — resolved

Same day, the poll flagged 7 equipment records (Vorago and Amascut pages revised
25 Jul 2026). All seven drop facts were confirmed present on the current revisions; the
corpus snapshot and record `verifiedAt` moved to 2026-07-25 and the ledger returned to
zero stale. The loop worked as designed.

## Honest gaps (unchanged by this validation)

- Item stat bonuses (post 9 Mar 2026 per-item values), potion/prayer/poison/Slayer
  mechanics, and necromancy bands beyond Volley of Souls have no sourced values in the
  corpus. They are explicit `ponytail:` stubs in the engine and empty fields in data —
  not estimates.
- Two Zamorak-undercity codex unlocks (Chaos Roar, Greater Death's Swiftness) carry an
  unresolved region per the cross-boundary case in `region-dependencies.json`.
