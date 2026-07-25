---
name: data-sync
description: Game-data ingestion for this repo - the scripts/sync-combat-data.ts and scripts/sync-league-data.ts scrapers, the SourceReference provenance contract every record must carry, tracked-entity scanning since 2024-03-04, staleness detection and the COMBAT SYNC report format, and the source-disagreement policy. Use when writing or changing anything under scripts/, data/combat/, data/league/, or code that reads those datasets.
---

# Data sync and provenance

The combat pipeline is live; the league side stays normalize-driven:

- `scripts/sync-combat-records.mjs` (last stage of `npm run normalize:data`) builds
  `data/combat/{abilities,equipment,prayers,perks,effects}.json` from the curated scraped-data
  corpus — one writer per dataset, never hand-edited. Record types live in
  `src/combat/data/records.ts`; region unlock labels come from the corpus joins in that script.
- `scripts/sync-combat-data.ts` (`npm run sync:combat`) maintains the tracked-entity ledger
  `data/combat/update-index.json` and polls each entity's Wiki page for revisions newer than
  the record's `verifiedAt`. It never scrapes values into records.
- `scripts/audit-combat-data.mjs` (`npm run audit:combat`, inside `audit:all-data`) enforces
  provenance, unique ids, valid region tags and enum sanity. `src/combat/data/index.test.ts`
  is the matching contract test.
- `scripts/sync-league-data.ts` writes `data/league/` from scraped-data, but the canonical
  producer of the on-disk league files is `scripts/normalize-scraped-data.mjs` — do not run
  sync:league expecting the same shape.
- `scripts/publish-assets.mjs` (inside `npm run sync:assets`) publishes attributed art from
  `assets/` to `public/game/<category>/`.

The RuneScape Wiki is the default ground truth for current game data. `src/combat/data/` and the app-facing research accessors read the normalized root `data/` store; components do not ingest `scraped-data/` directly.

## Patch-day loop

Game update lands → `npm run sync:combat` flags revised pages (exit 1, STALE lines) → re-verify
those records against the update post, bump `verifiedAt` in the corpus snapshot →
`npm run normalize:data` → `npm run audit:combat` → tests → update `docs/combat-changelog.md`
status date. League reveals (28 Jul → 10 Aug 2026) flip `verified: false` records only on Wiki
confirmation.

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

The Combat > Reference tab renders the dataset counts and the ledger's poll status (stale
warning included). `.agents/skills/data-sync/SKILL.md` mirrors this file; edit both together.

## Hard rules

- **Ingestion supplies candidate data; the engine holds verified mechanical rules.** Keep them separate. Never implement the engine by regexing ability tooltips.
- **No copied prose.** Never lift full Wiki, PvME, or RS Analysis descriptions into the app. Normalize facts in our own words. This is about *text* — wiki and game imagery is usable under CC BY-NC-SA with attribution, and is the preferred source for icons and art.
- **Never invent a number to fill a stub.** An empty `records: []` is correct until real data exists.
- League records sourced only from countdown/reveal posts stay `verified: false`; Wiki confirmation flips that.
- The Data page must expose the canonical source link for each normalized row instead of hiding provenance in an internal manifest.
