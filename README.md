# Equilibrium

**Equilibrium** is a fan-made planner for **RuneScape 3: Leagues II — Equilibrium**, launching 10 August 2026.

I built it because planning a League across reveal posts, Wiki pages, spreadsheets and separate combat tools gets messy fast. The app keeps region picks, Relics, Blessings, tasks, quest access and current RS3 combat math in one place.

[Open the live planner](https://equilibrium-ruddy.vercel.app)

## What is in the app

- **Map** — plan the three elective region picks and inspect what each region opens up.
- **Tasks** — track League tasks and points as Jagex publishes them.
- **Build** — keep regions, Relics, Blessings and gear together instead of maintaining a separate plan for each system.
- **Combat** — calculate against current RS3 rules, with League modifiers applied through a separate ruleset layer.
- **Data** — browse the records behind the planner and follow them back to their sources.

The map, build state and data browser are usable now. The quest catalog is generated from revision-pinned RuneScape Wiki data. The combat engine is still being rebuilt around the post-2026 game rather than carrying old formulas forward.

The task page is intentionally incomplete. Jagex has confirmed task tiers from Easy through Master and the 10-to-400 point range, but has not published the full Equilibrium task list yet. The 30 / 80 / 200 middle values currently mirror Catalyst and remain marked provisional until an Equilibrium source confirms them.

Unknown League values stay blank. The app does not fill gaps with plausible-looking numbers.

## Data and sources

The RuneScape Wiki is the default source for normal RS3 game data. Records taken specifically from PvME or RS Analysis keep those sources. New League reveals and patch values can point directly to Jagex until the Wiki catches up.

Generated quest records retain the Wiki page and revision used to build them. Harvested media retains its source page, retrieval URL and local hash. Geographic quest inference is kept separate from official League auto-completion; only a Jagex source can move a quest into the official overlay.

The full source list is available at `/sources` in the app.

## Local development

```bash
npm ci
npm run dev
```

Before pushing:

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Playwright boots its own server on port 3100. Stop any existing dev server from this checkout before running `npm run test:e2e`.

## Data work

```bash
npm run normalize:data   # rebuild app-facing data from scraped-data/
npm run sync:combat      # refresh combat data
npm run sync:league      # refresh League data
npm run sync:assets      # refresh sourced RS3 and League media
npm run sync:quests      # rebuild quest and region data from the Wiki
npm run sync:quests:auto # apply official auto-completion lists when published
npm run sync:planner     # rebuild region-value and progression research
npm run audit:all-data   # run the full data audit set
```

`data/` is the app-facing source of truth. `scraped-data/` holds source-oriented research before normalization. `src/combat/data/` reads and types the canonical combat JSON; it is not a second hand-maintained copy.

## Repository layout

```text
app/                 Next.js routes
src/combat/          standalone combat engine
src/league/          regions, Relics, Blessings and task models
src/research/        typed access to normalized research
src/components/      shared UI
src/lib/             browser persistence

data/combat/         canonical combat JSON
data/league/         canonical League and generated quest data
data/research/       normalized research and progression data
scraped-data/        source-oriented research and unresolved notes
assets/              sourced game media and provenance manifest
scripts/             sync, normalization and audit jobs
```

## Project rules

- Do not invent unrevealed League data.
- Keep a source on every externally derived record.
- Keep the base RS3 combat engine independent from React and from League modifiers.
- Do not add boss simulators, phase models, kill-time or enrage calculators to the generic combat target.
- Do not copy the layout, component structure, classes or wording of PvME, RS Analysis or leagues.build.
- Game art and sourced Wiki media are allowed with the proper credit. Generated-AI imagery is not.
- Do not turn the tool into a SaaS landing page. It should open on useful information, not a marketing hero.

## Working on the repo

Read [`AGENTS.md`](./AGENTS.md) before changing the app. Detailed rules live in the project skills rather than being repeated in every file:

- `combat-math` for the damage pipeline and rounding rules
- `league-data` for regions, Relics, Blessings, tasks and provisional data
- `data-sync` for provenance, staleness and sync reports
- `equilibrium-ui` for the RuneScape-derived visual system
- `no-slop-ui` and `ui-humanizer` for interface cleanup
- `text-humanizer` for copy that sounds like it belongs in this project
- `bot-audit` for the final AI-pattern pass
- `rs3-ponytail` for deciding how much implementation effort a change deserves

For copy, keep the exact game term, number, path, state or limitation. Cut filler before cutting precision. Avoid generic product claims, slogan-shaped headings, fake enthusiasm and copy that could describe any planner.

The app deploys to Vercel from `main`. There is no backend or account system: game data ships as checked-in JSON and user progress stays in browser `localStorage`.

## Credits

Data and research come from the [RuneScape Wiki](https://runescape.wiki/), [RS Analysis](https://rs-analysis.xyz/), [PvME](https://pvme.io/) and official [Jagex](https://www.jagex.com/) material. Individual records keep their own source where possible.

This is an unofficial, non-commercial fan project. It is not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex Ltd.
