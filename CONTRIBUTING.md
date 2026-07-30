# Contributing

Unofficial, non-commercial fan project for RS3 Leagues II: Equilibrium.
Not affiliated with Jagex.

## Licenses (read before shipping)

| Material                                                      | Terms                                         |
| ------------------------------------------------------------- | --------------------------------------------- |
| Original app code (`app/`, `src/`, most `scripts/`)           | MIT — see `LICENSE`                           |
| Wiki-derived data/prose (`data/seed-v1.json.gz`, patches)     | **CC BY-NC-SA 3.0** — not MIT                 |
| PvME-derived research notes                                   | **CC BY-NC-SA 4.0** (pvme-guides) — not MIT   |
| Jagex art/icons/screenshots (`assets/`, `public/game/`, refs) | Jagex property / Fan Content Policy — not MIT |

Details: root **`NOTICE`** (authoritative) and **`LICENSE`** (MIT code only, with scope limit).

**Hard bans**

- Do not sell or commercially package `assets/`, `public/game/`, or other Jagex media.
- Do not re-label wiki (CC BY-NC-SA 3.0) or PvME (CC BY-NC-SA 4.0) material as MIT-only.
- Do not strip footer / `/sources` / `SourceReference` fields when forking.

### When adding data

- Prefer RuneScape Wiki URLs on every external fact (`SourceReference`).
- If a fact came from PvME, tag source `pvme` and re-verify on the Wiki before `verified: true`.
- Never strip source URLs to “clean” a row.
- Never copy PvME / RS Analysis guide prose or UI.
- New icons: register provenance in `assets/source-manifest.json` — see `assets/README.md`.

## Data ownership

Only the first three rows are tracked. Everything else on this list is rebuilt by
`npm run data:rebuild`; see [`docs/data-platform.md`](docs/data-platform.md).

| Path                          | Owner                     | Notes                                                        |
| ----------------------------- | ------------------------- | ------------------------------------------------------------ |
| `data/seed-v1.json.gz`        | Immutable baseline        | Never edit or broadly inspect it for routine data work       |
| `data/migrations/`            | Relational schema         | Forward-only schema changes                                  |
| `data/patches/`               | Reviewable content edits  | Use stable IDs and validated transactional operations        |
| `assets/source-manifest.json` | Art provenance catalog    | New icons must register here, then run `npm run sync:assets` |
| `.cache/`                     | Generated SQLite and JSON | Never edit or commit                                         |
| `public/data/v2/`             | Generated browser exports | Never edit or commit; regenerate with `data:export`          |
| `reports/`                    | Generated run reports     | Never edit or commit                                         |

## Scripts

- Prefer the documented npm scripts in `package.json`.
- Scripts under `scripts/` are the ones wired to those npm scripts or to CI. Local one-off tooling
  stays untracked — `.gitignore` reserves the `scripts/_*` prefix for it.

## House rules

- Never invent unrevealed Equilibrium numbers.
- Every external fact keeps a `SourceReference`.
- No gen-AI game art.
- No cloning pvme / rs-analysis / leagues.build UI.
- Pushes to `main` deploy production — run `npm test` / `npm run build` / local e2e first.

## Changing data

Correct one record with one patch file rather than rewriting a dataset:

```bash
npm run data:find -- --query "Seismic wand"
npm run data:context -- --id item:seismic-wand
npm run data:impact -- --id item:seismic-wand
# write data/patches/YYYY-MM-DD-description.jsonl
npm run data:apply -- data/patches/YYYY-MM-DD-description.jsonl
npm run data:validate:changed && npm run data:export:changed
```

Then, before pushing:

```bash
npm run audit:data
npm run typecheck
npm test
```
