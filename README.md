# Equilibrium

Companion webapp for RuneScape 3's **Leagues II: Equilibrium** (launches 10 Aug 2026): a region map,
complete task tracker, build planning across relics, blessings, gear and perks, and a from-scratch
combat engine for the current post-2026 game covering damage, rotations and progression.

Fan tool. Not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex Ltd.

Read `AGENTS.md` before writing code - it is the spec, this file is just the map.

## Status

Research/data ingestion is active. The Data route reads the audited region/skill snapshot, sourced media lives
under `assets/`, and the quest catalog is generated from revision-pinned RuneScape Wiki data. Unrevealed League
values and unresolved region boundaries stay explicit rather than being filled with guesses.

## Commands

```text
npm run dev          # local dev server
npm run build        # production build (what Vercel runs)
npm run typecheck    # tsc --noEmit
npm test             # vitest
npm run sync:combat  # combat data sync scaffold
npm run sync:league  # League data sync scaffold
npm run sync:assets  # harvest sourced RS3 / League media + provenance manifest
npm run sync:quests  # rebuild the full quest/region catalog from the RuneScape Wiki
npm run sync:quests:auto  # apply official Jagex region auto-completion lists when published
```

Node runs the data scripts directly; no ts-node/tsx wrapper is required for the existing TypeScript sync scripts,
and the asset/quest harvesters are plain `.mjs`.

## Layout

```text
app/                 App Router routes: Overview / Map / Tasks / Build / Combat / Data (+ /sources)
src/combat/          combat engine, zero React dependency
  core/ pipeline/ styles/{melee,ranged,magic,necromancy}/ shared/ rotation/ league/ target/ data/
src/league/          Equilibrium domain model (regions, relics, blessings, tasks)
src/research/        normalized audited research browser layer
src/lib/             localStorage persistence
src/components/      shared UI
data/combat/         canonical combat JSON store
data/league/         League data + generated quest catalog / region rules / official auto-quest overlay
scraped-data/        source-oriented research snapshots, provenance, post-its and unresolved facts
assets/              local sourced game-media archive + generated provenance manifest
scripts/             combat/League sync plus asset and quest harvesters
```

`src/combat/data/` is the typed accessor layer over the root `data/` store, so there is one copy of the
JSON rather than two.

## Data provenance

Game facts and media keep source links. `assets/manifest.generated.json` records the exact file/source page,
direct retrieval URL and local hash for every harvested binary. `data/league/quests.json` stores the source URL
and Wiki revision for every quest. Official Equilibrium quest auto-completions are a separate Jagex-only overlay;
geographic inference never marks a quest auto-completed.

## Deployment

Vercel, zero config. No env vars, no backend, no database - static JSON plus `localStorage`. Nothing in
the production build reads secrets or performs live game-data fetches; sync workflows update the checked-in data.

## Agent skills

Project skills in `.claude/skills/`:

- `combat-math` - the current-game combat model and the source-verification workflow. Load before
  touching `src/combat/`.
- `data-sync` - scrapers, the `SourceReference` contract, staleness reporting, source precedence.
- `league-data` - Equilibrium domain model, and the rule that countdown-post numbers stay provisional.

UI and copy work uses the globally installed skills rather than anything repo-local: `no-slop-ui`
(law), `ui-humanizer` and `text-humanizer` (surgery), `bot-audit` (pre-ship check), plus
`human-grade`, `frontend-design`, `dataviz` and `find-docs`.

## Credits

RuneScape Wiki, RS Analysis, PvME, leagues.build (UX inspiration only), and Jagex. See `/sources`.
