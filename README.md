# Equilibrium

Companion webapp for RuneScape 3's **Leagues II: Equilibrium** (launches 10 Aug 2026): a region map,
complete task tracker, build planning across relics, blessings, gear and perks, and a from-scratch
combat engine for the current post-2026 game covering damage, rotations and progression.

Fan tool. Not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex Ltd.

Read `AGENTS.md` before writing code - it is the spec, this file is just the map.

## Status

Scaffold. Routes are stubs, datasets are empty on purpose, and the only real engine code is
`src/combat/core/damagePerLevel.ts`. Nothing here invents game numbers.

## Commands

```
npm run dev        # local dev server
npm run build      # production build (what Vercel runs)
npm run typecheck  # tsc --noEmit
npm test           # vitest, combat core only
npm run sync:combat / sync:league   # data scrapers (stubs, exit non-zero)
```

Node 26 runs the `scripts/*.ts` files directly via type stripping - no ts-node/tsx in the tree.

## Layout

```
app/                 App Router routes: Overview / Map / Tasks / Build / Combat / Data (+ /sources)
src/combat/          combat engine, zero React dependency
  core/ pipeline/ styles/{melee,ranged,magic,necromancy}/ shared/ rotation/ league/ target/ data/
src/league/          Equilibrium domain model (regions, relics, blessings, tasks)
src/lib/             localStorage persistence
src/components/      shared UI
data/combat/         canonical JSON store written by scripts/sync-combat-data.ts
data/league/         canonical JSON store written by scripts/sync-league-data.ts
scripts/             sync-combat-data.ts, sync-league-data.ts
```

`src/combat/data/` is the typed accessor layer over the root `data/` store, so there is one copy of the
JSON rather than two.

## Deployment

Vercel, zero config. No env vars, no backend, no database - static JSON plus `localStorage`. Nothing in
the build reads secrets or network.

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
