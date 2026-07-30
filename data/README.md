# Tracked data

Three things live here, and nothing else on the data path is tracked:

- `seed-v1.json.gz`: immutable baseline containing the 65 source documents consolidated in commit `43c23873`;
- `migrations/`: forward-only SQLite schema changes;
- `patches/`: small sourced JSONL content changes.

`npm run data:rebuild` creates `.cache/equilibrium.sqlite` from scratch, applies every patch, validates it, materializes the remaining compatibility JSON under `.cache/data/`, and exports the browser shards under `public/data/v2/`. All of those outputs are ignored by Git. The research catalog is normalized into relational tables and is never written back out as a JSON file.

Correct a record with a patch rather than rewriting a dataset — [`docs/data-platform.md`](../docs/data-platform.md) has the commands. Do not restore the retired per-domain JSON files or mutation scripts. Unknown and unrevealed League values remain empty until sourced.

## House rules

- Do not open or rewrite `seed-v1.json.gz` for routine content work.
- Put a factual change in one small JSONL file under `patches/`, with stable IDs and source links attached. Patches are immutable once applied: a later correction is a new patch.
- Use a SQL migration for schema changes only, never one per content correction.
- Do not commit `.cache/`, generated reports, or `public/data/v2/`.
- `Troll Country` is not a region under this taxonomy — those records belong to Asgarnia, and validation fails if one slips back in.
