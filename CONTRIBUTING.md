# Contributing

Unofficial, non-commercial fan project for RS3 Leagues II: Equilibrium.
Not affiliated with Jagex.

## Licenses (read before shipping)

| Material | Terms |
|---|---|
| Original app code (`app/`, `src/`, most `scripts/`) | MIT — see `LICENSE` |
| Wiki-derived data/prose (`data/`, much of `scraped-data/`) | **CC BY-NC-SA 3.0** — not MIT |
| PvME-derived research notes | **CC BY-NC-SA 4.0** (pvme-guides) — not MIT |
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
- New icons: register provenance (`assets/source-manifest*.json`) — see `assets/README.md`.

## Data ownership

| Path | Owner | Notes |
|---|---|---|
| `scraped-data/` | Research inputs | Source-shaped; not read at runtime |
| `npm run normalize:data` | Regenerates many `data/**` mirrors | Do not hand-edit those outputs expecting them to stick |
| `data/research/catalog.json` | **Hand-owned majors** | Region major unlocks / POI rows are curated in-app; re-normalize carefully so you do not clobber recent majors |
| `data/league/*` | Normalize + official reveals | Empty tasks / unrevealed relics are correct until sourced |
| `assets/source-manifest*.json` | Art provenance catalog | New icons must register here, then `npm run sync:assets` |

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
