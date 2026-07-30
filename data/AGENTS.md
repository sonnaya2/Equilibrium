# Data editing rules

- Do not open or rewrite `seed-v1.json.gz` for routine content work.
- Start with `npm run data:find`, then `data:context` and `data:impact`.
- Put factual changes in one small, immutable JSONL file under `patches/`; include stable IDs and keep source links attached.
- Run `npm run data:apply -- data/patches/<file>.jsonl`, then the changed validation/export commands.
- Use a SQL migration only for schema changes. Never use one migration per content correction.
- Do not commit `.cache/equilibrium.sqlite`, `.cache/data/`, generated reports, or `public/data/v2/`.
- `Troll Country` is not a region. Use Asgarnia under this repository's taxonomy.
