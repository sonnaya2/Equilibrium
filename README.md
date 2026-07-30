# Equilibrium

A fan-made planner for RuneScape 3's second league, **Equilibrium**, which starts 10 August 2026.

Planning a league means juggling reveal posts, a dozen Wiki tabs, a spreadsheet and somebody else's
DPS calculator. This puts region picks, Relics, Blessings, tasks, quest access and current RS3 combat
math on one site.

→ [equilibrium-ruddy.vercel.app](https://equilibrium-ruddy.vercel.app)

## What's in it

**Map** plans the three elective regions and shows what each one actually opens up. **Tasks** tracks
tasks and points; until Equilibrium publishes its own list, it shows Catalyst tasks as a marked
stand-in. **Build** keeps regions, Relics and Blessings in one place, so you aren't maintaining
three plans that quietly disagree with each other. **Combat** calculates against current RS3 rules,
with league modifiers layered on through a separate ruleset rather than baked into the formulas.
**Data** shows the records behind all of it, and every number links back to where it came from.

## What's actually finished

Map, build state and the data browser work today. Quests are generated from revision-pinned Wiki
data. The combat engine is a rebuild against the post-2026 game instead of old formulas dragged
forward, and it's the part still under construction.

Tasks is deliberately half-empty. Jagex confirmed the tiers (Easy through Master) and the 10–400
point range, then stopped. The 30 / 80 / 200 middle values in there right now are Catalyst's, marked
provisional, and they stay marked until an Equilibrium source says otherwise. Everything else
unrevealed is simply blank — a guess that looks plausible is worse than an empty field.

## Sources

RuneScape Wiki by default. Records lifted specifically from PvME or RS Analysis keep those instead.
Fresh reveals and patch values can cite Jagex directly until the Wiki catches up.

Generated quest records keep the Wiki page and the exact revision they were built from. Harvested
media keeps its source page, retrieval URL and a local hash. Guessing a quest's region from its
geography is kept well clear of Jagex's official auto-completion list; only a Jagex source moves a
quest into that overlay.

Full list is at `/sources`.

## Running it locally

Requires Node.js 22.

```bash
npm ci
npm run dev
```

Before you push:

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Playwright boots its own server on 3100, because 3000 was already taken on my machine. It won't boot
that server if you've got a dev server running from the same checkout, so stop yours first.

## Data jobs

```bash
npm run data:rebuild     # recreate SQLite, remaining compatibility cache, and frontend shards
npm run data:find -- --query "Seismic wand"
npm run data:context -- --id item:seismic-wand --format markdown
npm run audit:data       # rebuild plus architecture/provenance gates
npm run sync:assets      # refresh sourced RS3 and League media
```

Tracked data is one compressed seed, SQL migrations, and small JSONL patches. The generated SQLite
database, temporary compatibility JSON, reports, and frontend shards are ignored. The research
catalog is normalized in SQLite and is never recreated as `catalog.json`. See
`.claude/skills/data-sync/SKILL.md` before changing sourced facts.

## Layout

```text
app/                 Next.js routes
src/combat/          standalone combat engine
src/league/          regions, Relics, Blessings and task models
src/research/        typed access to normalized research
src/components/      shared UI
src/lib/             browser persistence

data/                compressed seed, migrations, and content patches
assets/              sourced game media and provenance manifest
scripts/data/        SQLite pipeline, bounded query CLI, and architecture audit
```

## House rules

- Never invent unrevealed league data.
- Every externally derived record carries its source.
- The base combat engine stays clear of React and of league modifiers, so base RS3 math can be
  validated on its own.
- The generic combat target stays generic. No boss sims, no phase models, no kill-times, no enrage
  curves.
- Steal lessons from PvME, RS Analysis and leagues.build. Never their layout, components, class
  names or wording.
- Game art and credited Wiki media are fine. Gen-AI imagery is not.
- This is a tool, not a product. It opens on information, not a marketing hero.

## Working on the repo

Read [`AGENTS.md`](./AGENTS.md) first. The detail lives in skills rather than being repeated in every
file:

- `combat-math` — damage pipeline and rounding
- `league-data` — regions, Relics, Blessings, tasks, provisional data
- `data-sync` — provenance, staleness, sync reports
- `equilibrium-ui` — the RuneScape-derived visual system
- `no-slop-ui`, `ui-humanizer`, `bot-audit` — interface cleanup and the final AI-pattern pass
- `text-humanizer` — copy that sounds like it belongs here
- `rs3-ponytail` — how much implementation a given change actually deserves

When you write copy, keep the exact game term, number, path, state or limitation. Cut filler before
you cut precision. No slogans, no manufactured enthusiasm, nothing that could describe any other
planner.

Pushes to `main` deploy straight to Vercel production, so there is no staging net. No backend and no
accounts either: game data ships as checked-in JSON and your progress lives in `localStorage`.

## Credits and licenses

Data and research come from the [RuneScape Wiki](https://runescape.wiki/),
[RS Analysis](https://rs-analysis.xyz/), [PvME](https://pvme.io/) and official
[Jagex](https://www.jagex.com/) material. Individual records keep their own source where possible.

- **Code:** MIT for original software only (`LICENSE` has an explicit scope limit)
- **Wiki-derived content:** [CC BY-NC-SA 3.0](https://creativecommons.org/licenses/by-nc-sa/3.0/)
  (Weird Gloop / [RuneScape Wiki](https://runescape.wiki/)) — adapted; share-alike; **non-commercial**
- **PvME research notes:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)
  ([pvme-guides](https://github.com/pvme/pvme-guides)) — discovery only, not a guide mirror; **non-commercial**
- **Jagex art / marks:** Jagex property under the
  [Fan Content Policy](https://legal.jagex.com/docs/policies/fan-content-policy) — **not for sale**

**Do not sell redistributions whose value is game art or wiki/PvME data.** MIT on code is not a
licence to commercialize Jagex media. Authoritative split: [`NOTICE`](./NOTICE).
Map of URIs: [`licenses/README.md`](./licenses/README.md). Contributing: [`CONTRIBUTING.md`](./CONTRIBUTING.md).
On-site credits: [/sources](https://equilibrium-ruddy.vercel.app/sources).

Unofficial, non-commercial fan project. Not affiliated with or endorsed by Jagex. RuneScape is a
trademark of Jagex Ltd.
