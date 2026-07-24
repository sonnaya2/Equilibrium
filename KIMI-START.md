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

### Integrate now

- [ ] **Quest catalog:** wire the current `data/league/quests.json` dataset into the places that need quest/region dependency data. It already contains **281 quest-list entries**, primary-region grouping and recursive required-region grouping. Keep this distinct from official League auto-completion.
- [ ] **Official auto-quest overlay:** make consumers read `data/league/equilibrium-auto-quests.json` as a separate overlay. It is currently awaiting official per-region lists, so the correct current behavior is an honest empty overlay — not inferred auto-completions.
- [ ] **Research/Data browser:** ensure `data/research/catalog.json` is the source for every region/skill row exposed on `/data`. Do not hardcode catalog counts in UI copy; new rows added by the data pass should appear without component edits.
- [ ] **Region content payloads:** consume the canonical region fields for areas, important content, upgrades, requirements, training-method IDs, warnings and sources. Do not maintain a parallel region-content list in UI code.
- [ ] **Relics:** consume `data/league/relics.json` generically. Tier 1 is populated; tiers 2–7 are intentionally unrevealed. The planner/UI should automatically pick up later records without hardcoded per-tier component edits.
- [ ] **Blessings:** consume `data/league/blessings.json` generically across all eight tiers, preserving Order / Balance / Chaos, God Tiers at 4 and 8, and the three-reset rule. All reveal payloads are currently empty; do not research them.
- [ ] **Tasks:** keep the Tasks UI/store bound to `data/league/tasks.json`. The file currently has tier metadata but zero task records. Treat Medium/Hard/Elite point values as provisional until an Equilibrium-specific source confirms them. Do not fabricate rows or scrape tasks; make the UI accept normalized task records as soon as the data pass adds them.
- [ ] **Unknown-state handling:** use `data/reference/unknowns.json` to keep unrevealed or unresolved League facts visibly unresolved. This includes region boundaries, XP/drop curves, unlock thresholds, task data and League-specific drop behavior.

### Consume these as the research pass adds them

- [ ] **Region-value additions:** `data/research/planner-expansions.json` now has sourced combat/training spots, unique drops, Runecrafting altars/access, Invention unlocks/material loops and Archaeology progression. Wire those records into the existing region/skill views; do not research replacements in this queue.
- [ ] **Training updates:** when current post-2026 rates/methods are added to the canonical research data, expose them through the existing skill/region method tables and preserve stale/current warnings. Do not independently benchmark or search for replacements.
- [ ] **League progression constants:** when exact XP multipliers, drop-rate multipliers, passive thresholds and elective-region unlock thresholds land in canonical League data, connect planner/progression calculations to those fields rather than duplicating constants.
- [ ] **League drop metadata:** when sourced region availability, unique-drop modifiers, bad-luck rules or League-specific drop modifiers are added, connect them to region/build views. Do not build boss guides or research drop rates yourself.
- [ ] **Combat tables:** when the data pass adds/updates current ability, cooldown, adrenaline, hit-range, weapon override, special-attack, prayer/potion/perk or 2026-hotfix records under `data/combat/`, wire the typed combat accessors/engine to them. Do not re-scrape PvME, RS Analysis, the Wiki or Jagex from this queue.
- [ ] **Permanent unlock graph:** when `data/reference/progression-unlocks.json` is present, consume it for base-game quest/account/equipment gates, then apply official Equilibrium auto-quest/relic overrides separately. `data/research/reference-site-harvest.json` is research/architecture context, not UI copy or a second source of game constants.

### Current-main consumer holes — fix these before doing more data work

- [x] **Relic reveal pass-through:** `app/build/page.tsx` currently finds only Tier 1 and passes `tierOneRelics` into `BuildPlanner`. Replace that one-off shape with the full tier records from `data/league/relics.json`, including `revealed`, `verified` and source metadata. `BuildPlanner` must render whatever tiers are populated later without code changes or hardcoded "Tier 1 only" copy.
- [x] **Blessing reveal pass-through:** `app/build/page.tsx` currently drops each Blessing tier's future choice/effect/source payload and passes only tier/path/god-tier/revealed metadata. Pass the normalized record through so a later data sync can populate nodes/effects and have them appear automatically. Preserve unrevealed rows as unknown.
- [ ] **Task-record consumer:** `app/tasks/page.tsx` currently shows point metadata, the record count and the waiting-on message but never renders `tasksData.records`. Add a normalized records consumer with filtering/search built from fields actually present in the canonical task schema. With zero records it must preserve the current honest empty state; once rows land they should appear without a component rewrite.
- [ ] **Planner-expansion adapter:** add one typed accessor/join for `data/research/planner-expansions.json` keyed by stable record ID plus region/skill. Feed the sourced combat-training spots, Runecrafting access, Invention/Archaeology progression and unique-drop rows into the existing region/skill/build views. Do not copy those rows into component-local arrays.
- [ ] **Provenance pass-through:** stop dropping source/confidence state between JSON and planner consumers. Relic `sourceUrl` is already mapped but not rendered; Blessing source/verification is not passed at all. Planner-expansion rows also need their source/confidence state kept available to the UI rather than flattened into unsourced prose.
- [ ] **Region-domain drift guard:** `src/league/index.ts` currently repeats the region IDs and starting/automatic/elective grouping that already exists in `data/league/regions.json`. Keep any compile-time union needed by TypeScript, but make runtime grouping come from canonical region records and add a contract test that fails when the domain IDs/availability drift from `data/league/regions.json`. Do not create another hand-maintained region list.

### Kimi stop condition

If a checkbox requires a fact that is not already present in `data/`, **stop that checkbox and pick another integration task**. Record the missing field/path if useful, but do not spend the coding context window becoming the researcher. The point of this queue is to keep Kimi on integration while the separate data pass keeps feeding the canonical store.

---

## Ways this goes wrong

- **Boss-specific scope.** No boss guides, phase sims, kill-time or enrage calculators. Generic target
  only. This is the single most likely place to drift.
- **Cloning.** rs-analysis.xyz, pvme.io and leagues.build are for lessons, not markup. Take the facts and
  the math; write our own components and our own words.
- **Stale combat data.** Pre-March-2026 values are wrong by default. PvME is for discovering that a
  mechanic exists, not for its current number.
- **Merging the League ruleset into base combat.** It stays a separate layer that can be switched off.
- **Collapsing rounding.** `floor(A) → mod → floor(B)` is not `floor(A×B)`.
- **3D leaking into the shared bundle**, which would make every other route pay for a route most visits
  never open.
- **Inventing data to make a screen look finished.** An honest empty state beats a plausible lie.
