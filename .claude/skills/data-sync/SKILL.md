---
name: data-sync
description: Game-data ingestion for this repo - the scripts/sync-combat-data.ts and scripts/sync-league-data.ts scrapers, the SourceReference provenance contract every record must carry, tracked-entity scanning since 2024-03-04, staleness detection and the COMBAT SYNC report format, and the source-disagreement policy. Use when writing or changing anything under scripts/, data/combat/, data/league/, or code that reads those datasets.
---

# Data sync and provenance

Two source sync paths feed the normalized `data/` store:

- `scripts/sync-combat-data.ts` -> `data/combat/{abilities,equipment,prayers,perks,effects,update-index}.json`
- `scripts/sync-league-data.ts` -> `data/league/{regions,relics,blessings,tasks}.json`
- `scripts/normalize-scraped-data.mjs` -> converts audited `scraped-data/` research into the canonical app-facing `data/` shapes while the direct sync scripts are still being completed.

The RuneScape Wiki is the default ground truth for current game data. `src/combat/data/` and the app-facing research accessors read the normalized root `data/` store; components do not ingest `scraped-data/` directly.

## Provenance contract

Every record carries:

```ts
interface SourceReference {
  source: "runescape-wiki" | "jagex" | "rs-analysis" | "pvme" | "derived"
  url: string
  title?: string
  revision?: string
  publishedAt?: string
  verifiedAt: string
}
```

Derived values get `source: "derived"` plus `derivedFrom: [...]`. A record without a usable source URL does not ship. Respect the RuneScape Wiki's attribution and licensing terms for Wiki-derived material.

## Ground-truth rule

- **Default:** current RuneScape Wiki page + update history is canonical.
- **Explicit RS Analysis source:** when a datum was deliberately taken from RS Analysis research/math/behaviour, keep RS Analysis as the canonical source for that datum and link its exact page.
- **Explicit PvME source:** when a datum was deliberately taken from PvME guidance, perks, upgrade ordering, or interaction documentation, keep PvME as the canonical source for that datum and link its exact page.
- **Jagex reveal/news posts:** useful for newly announced or provisional facts, but League reveal data stays `verified: false` until the Wiki confirms it. Preserve the Jagex link as provenance rather than silently treating a reveal as final normalized game data.
- Do not replace an explicit PvME/RS Analysis provenance link with a generic Wiki page just to make sourcing look uniform.

When two sources discuss the same mechanic but disagree, keep both claims visible in the audit layer and resolve the app-facing value deliberately. Do not silently blend values.

## Scope

Scan only entities the app actually uses, tracked since **2024-03-04**. This is not indiscriminate Wiki crawling. `update-index.json` is the tracked-entity ledger: entity id, Wiki page, last seen revision, last verified date.

## Staleness

When a tracked entity has a newer Wiki revision than the stored record, surface it loudly rather than serving stale numbers silently. Report shape:

```text
COMBAT SYNC
Abilities checked: 74   Items checked: 183   Changed since dataset: 4   New entities: 2   Warnings: 1
```

The Combat > Data tab renders the same facts plus a stale-data warning.

## Hard rules

- **Ingestion supplies candidate data; the engine holds verified mechanical rules.** Keep them separate. Never implement the engine by regexing ability tooltips.
- **No copied prose.** Never lift full Wiki, PvME, or RS Analysis descriptions into the app. Normalize facts in our own words. This is about *text* — wiki and game imagery is usable under CC BY-NC-SA with attribution, and is the preferred source for icons and art.
- **Never invent a number to fill a stub.** An empty `records: []` is correct until real data exists.
- League records sourced only from countdown/reveal posts stay `verified: false`; Wiki confirmation flips that.
- The Data page must expose the canonical source link for each normalized row instead of hiding provenance in an internal manifest.
