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
