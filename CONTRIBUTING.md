# Contributing

Unofficial, non-commercial fan project for RS3 Leagues II: Equilibrium.
Not affiliated with Jagex.

## Licenses (read before shipping)

| Material | Terms |
|---|---|
| Original app code (`app/`, `src/`, most `scripts/`) | MIT — see `LICENSE` |
| Wiki-derived data/prose (`data/`, much of `scraped-data/`) | **CC BY-NC-SA 3.0** — not MIT |
| Jagex art/icons/screenshots (`assets/`, `public/game/`, refs) | Jagex property / fan policy — not MIT |

Details: root **`NOTICE`**. Do not commercially redistribute wiki JSON or game art under MIT.

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
- One-shot `scripts/_*.mjs` and root `tmp-*.mjs` are agent scratch — do not treat as product API.

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
