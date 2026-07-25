# KIMI-START.md — work queue

`AGENTS.md` is the spec. This file is only the order to build it in, and what "done" means per item.
When the two disagree, AGENTS.md wins.

## Before you touch anything

Read `AGENTS.md` end to end. Load the project skills as they become relevant — `combat-math` before
`src/combat/`, `data-sync` before `scripts/` or `data/`, `league-data` before league modelling. For any
UI or copy work load `no-slop-ui` first, then `ui-humanizer` / `text-humanizer`, and run `bot-audit`
before calling a screen finished.

Verify with `npm run build`, `npm test`, `npm run typecheck`. Pushing to `main` deploys straight to
production — there is no staging gate.

## The clock

League launches **10 Aug 2026**. Relic and Blessing reveals land daily from **28 Jul** through launch.
So: build the shapes now, let real numbers arrive later. Anything that hardcodes a revealed value in a
component instead of reading `data/league/` will have to be rewritten in two weeks. The planner should
be usable on day one of the league; the combat engine can keep maturing after.

---

## 1. Design language and app shell

Everything else inherits this, and it is the hardest thing to retrofit. Do it first and do it properly.

Nav (Overview / Map / Tasks / Build / Combat / Data), theme tokens, typography scale, the shared
primitives — tables, stat readouts, tier/lock states, numeric display. RuneScape's colour vocabulary
and Wiki-grade information density, in our own design language.

**Done when**: every route renders inside the real shell, a `bot-audit` pass comes back clean, and no
screen reads as a template. No card-grid-plus-gradient-hero sludge.

## 2. League domain model + `data/league/`

Types and the store for regions, relics (7 tiers), blessings (8 tiers with Order/Chaos/Balance tracking
and God Tier derivation at 4 and 8, plus the 3 resets), tasks and League Points. Wire up
`scripts/sync-league-data.ts` for real.

Every record carries a `SourceReference`. Unrevealed content is explicitly `verified: false` and renders
as unknown in the UI — **never invent a number to fill a gap**, and never let a provisional value look
confirmed.

**Done when**: the model round-trips through the JSON store, God Tier derivation is unit-tested against
every path combination, and the sync script reports honestly instead of writing fiction.

## 3. Build planner

Regions, Relics, Blessings, Gear tabs. Region unlock milestones and their tradeoffs; relic tier
progression; blessing path tracking with live God Tier prediction and reset accounting. Persist to
`localStorage`; make builds shareable via URL if it stays cheap.

**Done when**: a full build can be planned start to finish, survives reload, and the constraint rules
(can't unlock everything, God Tier derivation, reset limits) are enforced rather than merely displayed.

## 4. Tasks

Its own purpose-built interface, not a generic table. Thousands of rows: filter by region/tier/skill,
search, completion state, points earned against tier thresholds, what the next unlock needs. Fast on a
large dataset — virtualise before it gets slow, not after.

**Done when**: tracking a task takes one click, progress-to-next-unlock is always visible, and scrolling
stays smooth at full task count.

## 5. Map — 2D first, then 3D

Read the Map section of AGENTS.md before starting. Ship the 2D fallback first: clickable regions,
lock/unlock state, driven by `data/league/regions.json` and the same build state as step 3.

Then layer the 3D on top of that same data and state — R3F v10, client-only, `next/dynamic` with
`ssr: false`, nothing outside `app/map/` importing the 3D bundle.

**Done when**: region planning is fully completable with the 3D disabled, `three` is absent from the
shared chunk, and the reduced-motion / no-WebGL paths work.

## 6. Combat engine

Load `combat-math` first. React-free throughout, so this can proceed in parallel with the UI work.

Order: `core/` primitives (Damage Potential, crits, hit caps, rounding, ticks — `damagePerLevel.ts` is
already done and tested) → the ordered modifier pipeline → per-style state (Bloodlust, ranged on-hit,
Runic Charge and burns, Necromancy souls) → shared prayers/potions/perks → generic target → the League
ruleset as a separate layer → rotation timeline → the Quick / Build / Analysis / Rotation UI.

Build the internal combat changelog (Mar 2024 → now) before implementing mechanics, and validate against
RS Analysis as you go rather than at the end.

**Done when**: the 20-point "combat-complete" checklist at the end of AGENTS.md is satisfied.

---

## Kimi data-integration queue — integration only

This section is deliberately narrow. **Do not spend tokens researching, scraping, browsing, guessing, or re-validating game facts here.** The data/research pass is handled separately. Kimi's job is to consume the canonical data already present in the repo and wire it into the app cleanly.

### Non-negotiable data rules

- **ADD / MERGE ONLY. DO NOT DELETE existing data, sourced rows, source references, generated catalogs, unresolved placeholders, or richer records.** If two inputs overlap, keep the richer sourced record and merge missing fields by stable ID/name instead of replacing the dataset.
- `data/` is canonical. `src/**/data/` may expose typed accessors, but must not become a second hand-maintained copy.
- If a canonical file is empty, unrevealed, unresolved, or marked provisional, **leave it that way and move on**. Do not go hunting for the missing facts.
- Never hardcode a game value into a component when a canonical JSON record can own it.
- Preserve `SourceReference`, confidence/freshness, `verified`, and unresolved-state metadata all the way to the consumer. Do not make provisional data look confirmed.
- Generated files stay generated. Integrate them; do not manually rewrite them to make the UI easier.
- **Old research branches are not normal data sources.** The one temporary exception is the final cleanup below for closed PR #20 / `agent/invention-data-pass`; after that branch is reconciled, use only current `main`.

### Priority: finish closed PR #20, then kill the branch

- [ ] **Final `agent/invention-data-pass` salvage:** PR #20 is closed because the deployment path kept refusing to consume it. Work from the git branch directly (`origin/agent/invention-data-pass`), not from Vercel and not by reopening the PR. Compare the branch's current tree against the latest `main` and **copy/merge only records or files that are still absent or materially richer on the branch**. Do **not** merge the branch wholesale: its shared workflow/package/index/planner-sync edits are based on an old `main` and can overwrite newer audit logic.
- [ ] Most Slayer/Invention/Archaeology payloads from #20 are already on `main`; verify them instead of redoing them. In particular, do not recreate the existing `planner-expansions-slayer*.json`, `planner-expansions-invention-*.json`, typed Slayer/Invention readers, or existing supplement audits when `main` is already equal/richer.
- [ ] **Newest branch delta to reconcile:** `scraped-data/planner-expansions-archaeology-guild.json` is currently branch-only and contains current relic-loadout progression (2 tutorial presets → Professor third preset for 80,000 chronotes → Guildmaster fourth preset), Guild shop/storage/mattock/auto-screener progression, and a correction to the stale "Guildmaster grants second loadout" claim. Promote it only after checking for overlap with current Archaeology data; keep the correction explicit rather than silently leaving contradictory rows.
- [ ] `planner-expansions-archaeology-special-relics.json` and `planner-expansions-archaeology-production.json` have already started landing on `main`. Finish their normalization registration, typed `src/research/archaeologyPlanner.ts` coverage, and collection/production audit wiring rather than copying duplicate files again.
- [ ] Preserve the branch's structured Archaeology collection validation where it is stronger: `scripts/lib/archaeology-collection.mjs` + the current `scripts/audit-archaeology-collections.mjs` / production audit should validate collector/reward/level fields without discarding the newer current-main audit gates.
- [ ] When the branch-vs-main diff contains no unique useful data left, run `npm run normalize:data`, `npm run audit:supplements`, the progression/reference/boundary audits already on `main`, `npm run typecheck`, `npm test`, and `npm run build`. Then make `agent/invention-data-pass` match `main`/mark it safe to delete and leave PR #20 closed.

### Research feeds already on `main` — use these first

- **Base planner research:** `data/research/planner-expansions.json` — combat candidates, Runecrafting access, base Invention/Archaeology progression and regional drops.
- **Slayer:** `src/research/slayerPlanner.ts` over `planner-expansions-slayer*.json` — 29 deduplicated high-value, collection-log and boundary-sensitive routes. Preserve the explicit stale/rebenchmark warnings on old PvME metrics.
- **Invention:** `src/research/inventionPlanner.ts` over `planner-expansions-invention-*.json` — current rare-component taxonomy coverage, Ancient Invention/Archaeology links, perk-family material pressure, utility recipes and non-region bottlenecks.
- **Archaeology:** `src/research/archaeologyPlanner.ts` over `planner-expansions-archaeology-*.json` — collection rewards and repeatable progression data in addition to the base relic/dig-site table. Finish the PR #20 cleanup above before treating this feed as closed.
- **Combat seed:** `data/combat/ability-audit-2026-07-24.json` — current post-modernisation Magic/Ranged records. RS Analysis is a model/calculation cross-check, not a source of settings-dependent sample damage constants.
- **Permanent unlocks:** `data/reference/progression-unlocks.json` — composed current quest/activity/account/equipment dependencies, including post-2026 removals and acquisition changes. Apply Equilibrium overlays separately.
- **Region boundaries:** `data/league/regions.json` + `data/league/region-dependencies.json` — hard rules, historical working mappings and unresolved external/cross-boundary destinations are deliberately distinct.
- `npm run normalize:data` regenerates the research mirrors; `npm run audit:supplements` protects the salvaged Slayer/Invention/Archaeology datasets.

### Integrate now

- [ ] **Quest catalog:** wire the current `data/league/quests.json` dataset into the places that need quest/region dependency data. It already contains **281 quest-list entries**, primary-region grouping and recursive required-region grouping. Keep this distinct from official League auto-completion.
- [ ] **Official auto-quest overlay:** make consumers read `data/league/equilibrium-auto-quests.json` as a separate overlay. It is currently awaiting official per-region lists, so the correct current behavior is an honest empty overlay — not inferred auto-completions.
- [ ] **Research/Data browser:** ensure `data/research/catalog.json` is the source for every base region/skill row exposed on `/data`, then expose the specialist Slayer/Invention/Archaeology readers without copying their records into another catalog. Do not hardcode counts in UI copy.
- [ ] **Region content payloads:** consume the canonical region fields for areas, important content, upgrades, requirements, training-method IDs, warnings and sources. Do not maintain a parallel region-content list in UI code.
- [x] **Relics:** the build planner now consumes all records from `data/league/relics.json` generically. Unrevealed tiers stay visible as unknown and later reveal records can flow through without another Tier-1-only rewrite.
- [x] **Blessings:** all eight records from `data/league/blessings.json` now pass through to the planner with reveal state, choices payload, verification and source URL preserved. Do not invent node rendering before the published choice schema exists.
- [ ] **Tasks:** keep the Tasks UI/store bound to `data/league/tasks.json`. The file currently has tier metadata but zero task records. Treat Medium/Hard/Elite point values as provisional until an Equilibrium-specific source confirms them. Do not fabricate rows or scrape tasks. **Blocked on an actual normalized task-row schema; once records exist, build the purpose-made consumer from those real fields.**
- [ ] **Unknown-state handling:** use `data/reference/unknowns.json` and region dependency status to keep unrevealed or unresolved League facts visibly unresolved. This includes region boundaries, XP/drop curves, unlock thresholds, task data and League-specific drop behavior.
- [ ] **Slayer planner feed:** consume `getAllSlayerMethods()` / region filtering from `src/research/slayerPlanner.ts` in region/skill planning. Do not rank stale-warning PvME KPH as current combat performance.
- [ ] **Invention planner feed:** consume `src/research/inventionPlanner.ts` for self-supply/component/perk pressure. Keep global/account bottlenecks global instead of inventing a region gate because one convenient source exists in a region.
- [ ] **Archaeology planner feed:** consume `src/research/archaeologyPlanner.ts` for collection/repeatable/production/Guild value alongside the existing base Archaeology progression/relic records after the PR #20 cleanup is complete.

### Consume these as the research pass adds them

- [ ] **Region-value additions:** the base and specialist planner datasets are now committed and normalized. Feed them into existing region/skill/build views through the readers above; do not research replacements in this queue.
- [ ] **Training updates:** when current post-2026 rates/methods are added to canonical research data, expose them through existing skill/region method tables and preserve stale/current warnings. Do not independently benchmark or search for replacements.
- [ ] **League progression constants:** when exact XP multipliers, drop-rate multipliers, passive thresholds and elective-region unlock thresholds land in canonical League data, connect planner/progression calculations to those fields rather than duplicating constants.
- [ ] **League drop metadata:** when sourced region availability, unique-drop modifiers, bad-luck rules or League-specific drop modifiers are added, connect them to region/build views. Do not build boss guides or research drop rates yourself.
- [ ] **Combat tables:** start from `data/combat/ability-audit-2026-07-24.json` plus current `data/combat/modernisation-2026.json`; wire only records the engine actually models and keep future record-level sync additive. Do not re-scrape PvME, RS Analysis, the Wiki or Jagex from this queue.
- [ ] **Permanent unlock graph:** the permanent-unlock data is already exposed on `/data`; the remaining job is planner/domain consumption. Use `data/reference/progression-unlocks.json` for base-game quest/account/equipment/activity gates, then apply official Equilibrium auto-quest/relic overrides separately. `data/research/reference-site-harvest.json` is research/architecture context, not UI copy or a second source of game constants.

### Current-main consumer holes — fix these before doing more data work

- [x] **Relic reveal pass-through:** `app/build/page.tsx` now passes every relic tier, reveal state, verification and source metadata into `BuildPlanner` instead of extracting Tier 1 only.
- [x] **Blessing reveal pass-through:** `app/build/page.tsx` now preserves each Blessing tier's choice payload, source URL and verification state. Unrevealed tiers remain unknown.
- [x] **Task-record consumer:** `app/tasks/page.tsx` renders normalized records via `TaskRecords`, keeping the honest empty state while `data/league/tasks.json.records` is empty; rows will render/filter/search their actual fields once they land.
- [ ] **Base planner-expansion adapter:** add the typed join/accessor for `data/research/planner-expansions.json` keyed by stable record ID plus region/skill. **Do not rebuild the specialist adapters** — Slayer, Invention and Archaeology already have dedicated typed readers under `src/research/`.
- [ ] **Provenance pass-through — remaining:** relic/blessing tier source URLs and verification reach the planner. Preserve source/confidence/warning state from the base and specialist planner records through any view model; do not flatten sourced records into unsourced prose.
- [x] **Region-domain runtime derivation:** `src/league` derives starting/automatic/elective grouping from canonical region records and a contract test fails on drift from `data/league/regions.json`; `REGION_IDS` remains only as the compile-time `RegionId` union.

### Kimi stop condition

If a checkbox requires a fact that is not already present in `data/`, **stop that checkbox and pick another integration task**. Record the missing field/path if useful, but do not spend the coding context window becoming the researcher. The point of this queue is to keep Kimi on integration while the separate data pass keeps feeding the canonical store.

---

## Ways this goes wrong

- **Boss-specific scope.** No boss guides, phase sims, kill-time or enrage calculators. Generic target
  only. This is the single most likely place to drift.
- **Cloning another tool's interface.** rs-analysis.xyz, pvme.io and leagues.build are for lessons,
  not markup. Take the facts and the math; write our own components and our own words. This is about
  their *interface* — game art and wiki imagery are fine to use (CC BY-NC-SA, attribute it), and
  reaching for real art over invented substitutes is encouraged.
- **Stale combat data.** Pre-March-2026 values are wrong by default. PvME is for discovering that a
  mechanic exists, not for its current number unless the specific current page/value has been independently validated.
- **Merging the League ruleset into base combat.** It stays a separate layer that can be switched off.
- **Collapsing rounding.** `floor(A) → mod → floor(B)` is not `floor(A×B)`.
- **3D leaking into the shared bundle**, which would make every other route pay for a route most visits
  never open.
- **Inventing data to make a screen look finished.** An honest empty state beats a plausible lie.
