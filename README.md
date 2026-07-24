# Equilibrium

A fan-made companion for **RuneScape 3: Leagues II — Equilibrium**, launching 10 August 2026.

The idea is simple: pick regions, work out what they actually give you, plan Relics and Blessings, keep track of tasks, and have current RS3 combat math in the same place instead of bouncing between a pile of tabs.

This is a side project, not a Jagex product. RuneScape is a trademark of Jagex Ltd.

## Where it is now

The region map and build state are working, the data browser is backed by the checked-in research set, and the quest catalog is generated from revision-pinned RuneScape Wiki data. The combat engine is being rebuilt around the post-2026 game rather than carrying old formulas forward.

The Equilibrium task page is deliberately sparse right now. Jagex has confirmed tasks from Easy through Master and the 10-to-400 point range, but the full task list is not out yet. The 30 / 80 / 200 middle values match Catalyst and stay marked provisional until an Equilibrium source states them directly.

The same rule applies everywhere else: unknown League numbers stay unknown.

## Sources

For normal RS3 game data, the RuneScape Wiki is the default reference. Rows that came specifically from PvME or RS Analysis keep those sources. Fresh League reveals and patch values can point straight to Jagex until the Wiki catches up.

Generated quest records keep their Wiki page and revision. Harvested game media keeps its source page, retrieval URL and local hash. Geographic quest inference never counts as an official League auto-completion; those are kept in a separate Jagex-only overlay.

See `/sources` in the app for the source list.

## Local development

```text
npm ci
npm run dev
```

Useful checks:

```text
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Data jobs:

```text
npm run normalize:data   # rebuild app-facing data from scraped-data/
npm run sync:combat      # combat data sync
npm run sync:league      # League data sync
npm run sync:assets      # refresh sourced RS3 / League media
npm run sync:quests      # rebuild quest/region data from the RuneScape Wiki
npm run sync:quests:auto # apply official Jagex auto-completion lists when they exist
npm run sync:planner     # rebuild sourced region-value / progression research
```

## Repo layout

```text
app/                 Next.js routes
src/combat/          combat engine; no React dependency
src/league/          Equilibrium region / Relic / Blessing / task model
src/research/        typed access to the research catalog
src/lib/             localStorage persistence
src/components/      shared UI

data/combat/         canonical combat JSON
data/league/         canonical League data + generated quest data
data/research/       app-facing research catalog + planner progression data
scraped-data/        source-oriented research and unresolved notes
assets/              sourced game media + provenance manifest
scripts/             data, quest and asset sync jobs
```

`data/` is the app-facing source of truth. `scraped-data/` is where source-oriented research lives before it is normalized. `src/combat/data/` is a typed accessor layer, not another hand-maintained copy of the JSON.

## Deployment

The app deploys on Vercel from `main`. There is no backend or account system here; builds use checked-in JSON and browser `localStorage`, and the sync jobs update the repository rather than fetching game data at runtime.

## Contributing

Read `AGENTS.md` before changing the app. The repo also has project-specific guidance for combat math, League data and data sync under `.claude/skills/`.

## Credits

RuneScape Wiki, RS Analysis, PvME, Jagex, and leagues.build for UX inspiration only.
