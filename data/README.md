# Data platform

Tracked data has three parts:

- `seed-v1.json.gz`: immutable baseline containing the 65 source documents consolidated in commit `43c23873`;
- `migrations/`: forward-only SQLite schema changes;
- `patches/`: small sourced JSONL content changes.

`npm run data:rebuild` creates `.cache/equilibrium.sqlite` from scratch, applies every patch, validates it, materializes remaining ignored compatibility JSON under `.cache/data/`, and exports ignored browser shards under `public/data/v2/`. The research catalog is normalized into relational tables and is never materialized as a JSON file.

Use the commands in `.claude/skills/data-sync/SKILL.md`. Do not restore the retired per-domain JSON files or mutation scripts. Unknown and unrevealed League values remain empty until sourced.
