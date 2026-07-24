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

- **Default:** current RuneScape Wiki page + update history is canonical for settled game data.
- **Explicit RS Analysis source:** preserve the exact RS Analysis provenance when a datum comes from its research, math or exposed state model. Use it as a validation/math reference; do not promote one configured calculator output into a universal game constant.
- **Explicit PvME source:** preserve the exact PvME link when it discovers a mechanic, dependency, perk interaction, method or upgrade-order relationship. PvME currently warns that most combat material predating the **2 March 2026 Combat Style Modernisation** is outdated. PvME alone therefore does **not** make a changed combat number current. Re-verify changed values and post-modernisation behaviour against a current Wiki/Jagex source before shipping them as current facts.
- **Jagex reveal/news posts:** useful for newly announced or provisional facts, but League reveal data stays `verified: false` until the Wiki confirms it. Preserve the Jagex link as provenance rather than silently treating a reveal as final normalized game data.
- Do not erase an explicit PvME/RS Analysis provenance link just to make sourcing look uniform. Keep discovery/validation provenance alongside the current source used to resolve the app-facing value.

When two sources discuss the same mechanic but disagree, keep both claims visible in the audit layer and resolve the app-facing value deliberately. Do not silently blend values.

## Scope

Scan only entities the app actually uses, tracked since **2024-03-04**. This is not indiscriminate Wiki crawling. `update-index.json` is the tracked-entity ledger: entity id, Wiki page, last seen revision, last verified date.

## Staleness

When a tracked entity has a newer Wiki revision than the stored record, surface it loudly rather than serving stale numbers silently. Treat pre-2-March-2026 PvME combat values as stale by default unless a current source independently confirms them. Report shape:

```text
COMBAT SYNC
Abilities checked: 74   Items checked: 183   Changed since dataset: 4   New entities: 2   Warnings: 1
```

The Combat > Data tab renders the same facts plus a stale-data warning.

## Hard rules

- **Ingestion supplies candidate data; the engine holds verified mechanical rules.** Keep them separate. Never implement the engine by regexing ability tooltips.
- **No plagiarism.** Never copy full Wiki, PvME, or RS Analysis descriptions into the app. Normalize facts in our own words.
- **Never invent a number to fill a stub.** An empty `records: []` is correct until real data exists.
- League records sourced only from countdown/reveal posts stay `verified: false`; Wiki confirmation flips that.
- The Data page must expose the canonical source link for each normalized row instead of hiding provenance in an internal manifest.
