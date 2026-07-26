/**
 * Guarded entry for `npm run sync:league`.
 *
 * Historical output used an incompatible blessings/relics envelope
 * (`status` / `sources[]` / nested `structure`) that breaks the app, which
 * expects the normalize envelope: top-level `paths`, `godTiers`, `resetCount`,
 * per-record `revealed`, and singular `source`.
 *
 * Canonical writer: scripts/normalize-scraped-data.mjs via `npm run normalize:data`.
 * Do not re-enable writes here without matching that envelope end-to-end
 * (regions hardRules shape, singular source, etc. as well).
 */
console.error(
  [
    "sync:league is disabled: it would write an incompatible blessings/relics schema and break the app.",
    "Use: npm run normalize:data",
    "(scripts/normalize-scraped-data.mjs owns data/league/{regions,relics,blessings,tasks}.json)",
  ].join("\n"),
);
process.exit(1);
