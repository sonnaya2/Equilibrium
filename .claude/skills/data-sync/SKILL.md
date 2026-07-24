---
name: data-sync
description: Game-data ingestion for this repo - the scripts/sync-combat-data.ts and scripts/sync-league-data.ts scrapers, the SourceReference provenance contract every record must carry, tracked-entity scanning since 2024-03-04, staleness detection and the COMBAT SYNC report format, and the source-disagreement precedence policy. Use when writing or changing anything under scripts/, data/combat/, data/league/, or code that reads those datasets.
---

# Data sync and provenance

Two scrapers, both currently stubs that exit non-zero:

- `scripts/sync-combat-data.ts` -> `data/combat/{abilities,equipment,prayers,perks,effects,update-index}.json`
- `scripts/sync-league-data.ts` -> `data/league/{regions,relics,blessings,tasks}.json`

Primary source is the RuneScape Wiki. `src/combat/data/` holds typed accessors over the root `data/`
store; nothing hand-edits those JSON files.

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

Derived values get `source: "derived"` plus `derivedFrom: [...]`. A record without a usable
`SourceReference` does not ship. Respect the RuneScape Wiki's attribution and licensing terms for
Wiki-derived material.

## Scope

Scan only entities the app actually uses, tracked since **2024-03-04**. This is not indiscriminate
wiki crawling. `update-index.json` is the tracked-entity ledger: entity id, wiki page, last seen
revision, last verified date.

## Staleness

When a tracked entity has a newer Wiki revision than the stored record, surface it loudly rather than
serving stale numbers silently. Report shape:

```
COMBAT SYNC
Abilities checked: 74   Items checked: 183   Changed since dataset: 4   New entities: 2   Warnings: 1
```

The Combat > Data tab renders the same facts plus a stale-data warning.

## Disagreement policy

Precedence: official Jagex > current Wiki (with update history) > current RS Analysis behaviour and
research > current verified PvME > other community sources. Use judgment: an experimentally derived
RS Analysis mechanic can be more precise than a simplified official tooltip. When sources diverge,
record both `displayDescription` and `mechanicalImplementation` instead of picking one silently.

## Hard rules

- **Ingestion supplies candidate data; the engine holds verified mechanical rules.** Keep them
  separate. Never implement the engine by regexing ability tooltips.
- **No plagiarism.** Never copy full Wiki, PvME, or RS Analysis descriptions into the app. Normalize
  to facts in our own words: "Wild Magic - 2 hits, 25% adrenaline, 5.4s cooldown, +20% crit dmg,
  +10% crit chance".
- **Never invent a number to fill a stub.** An empty `records: []` is correct until real data exists.
  Fake data that looks real is the worst possible failure mode here.
- League records stay `verified: false` while they come from the countdown post or a reveal blog.
  Only Wiki confirmation flips that.
