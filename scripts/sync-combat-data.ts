/**
 * Scrapes the RuneScape Wiki for the entities we actually use and writes
 * data/combat/{abilities,equipment,prayers,perks,effects,update-index}.json.
 * Every record carries a SourceReference; derived values carry derivedFrom.
 * Scope is the tracked entity list since 2024-03-04, not the whole wiki.
 *
 * Report format:
 *   COMBAT SYNC
 *   Abilities checked: N   Items checked: N   Changed since dataset: N   New entities: N   Warnings: N
 *
 * Run: npm run sync:combat
 */
// TODO: not implemented. Writing invented numbers here is worse than writing nothing.
// scraped-data/combat-2026.json + midgame-rebalance-2026-07-20.json hold system-level changes,
// not record-level ability/equipment tables — the record pass needs a Wiki scrape, not this dump.
console.error("sync-combat-data: not implemented yet");
process.exitCode = 1;
