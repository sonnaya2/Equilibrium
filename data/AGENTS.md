# Data editing rules

- Do not read or rewrite a complete legacy JSON file for one record. Start with `npm run data:find`, then `data:context` and `data:impact`.
- Treat existing JSON as legacy seed evidence while compatibility consumers remain. Do not hand-edit `.cache/equilibrium.sqlite`.
- Put factual changes in one small, immutable JSONL file under `data/patches/`; include stable IDs and keep source links attached.
- Run `npm run data:apply -- data/patches/<file>.jsonl`, then the changed validation/export commands.
- Use a SQL migration only for schema changes. Never use one migration per content correction.
- `Troll Country` is not a region. Use Asgarnia under this repository's taxonomy.
