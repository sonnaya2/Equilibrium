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

| Path                          | Owner                     | Notes                                                                            |
| ----------------------------- | ------------------------- | -------------------------------------------------------------------------------- |
| `data/seed-v1.json.gz`        | Immutable baseline        | Never edit or broadly inspect it for routine data work                           |
| `data/migrations/`            | Relational schema         | Forward-only schema changes                                                      |
| `data/patches/`               | Reviewable content edits  | Use stable IDs and validated transactional operations                            |
| `.cache/`                     | Generated local data      | Never edit or commit; the research catalog exists only as normalized SQLite rows |
| `public/data/v2/`             | Generated browser exports | Never edit or commit; regenerate through the data platform                       |
| `assets/source-manifest.json` | Art provenance catalog    | New icons must register here, then run `npm run sync:assets`                     |

## Scripts

- Prefer documented npm scripts in `package.json`.
- `sync:league:disabled` exits 1 on purpose (wrong schema).
- Product scripts live under `scripts/` and are wired from `package.json` or CI. One-shot agent passes are not kept in the tree.

## House rules

- Never invent unrevealed Equilibrium numbers.
- Every external fact keeps a `SourceReference`.
- No gen-AI game art.
- No cloning pvme / rs-analysis / leagues.build UI.
- Pushes to `main` deploy production — run `npm test` / `npm run build` / local e2e first.

## Before a data PR

```bash
node scripts/audit-main-data.mjs
npm run audit:data   # or broader audit:all-data when changing research feeds
npm run typecheck
npm test
```
