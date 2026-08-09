---
name: wiki-target-research
description: Source, normalize, validate, and integrate current RuneScape Wiki monster target facts for RS3 Equilibrium. Use when researching NPC Defence, base armour, exact affinities, weaknesses, poisonability, size, life points, race or Slayer metadata, versioned monster rows, boss target manifests, or target presets that feed the generic combat model.
---

# Wiki Target Research

Own development-time acquisition and normalization of sourced RS3 monster target facts. Pair with `data-sync` for persistence, `combat-math` for accuracy and affinity semantics, and `combat-sim` when a target fact changes simulation state. Read `test-maintainer` before writing or changing tests.

## Boundaries

This skill owns:

- Wiki source retrieval and row/version selection;
- normalization, validation, provenance, and target coverage manifests;
- static target facts that feed the generic target model;
- regression fixtures for imported target facts.

This skill does not own:

- Damage Potential or player accuracy formulas;
- combat simulation, tick scheduling, or kill-time modeling;
- boss phases, encounter mechanics, or boss outgoing damage;
- player incoming damage assumptions;
- automatic proof that a player's weapon, spell, or ammunition satisfies an exact weakness.

Keep those concerns in `combat-math`, `combat-sim`, existing equipment/data seams, or an explicit scenario input. Do not create boss-specific calculators inside `src/combat/`.

## Source policy

Use this order when facts conflict:

1. Current official Jagex patch notes or update notes for an explicit stat change;
2. Current RuneScape Wiki Infobox Monster data from the `infobox_monster` Bucket;
3. The current monster page and its update history for row identity, version meaning, and conflict resolution;
4. A secondary combat source only as discovery or a discrepancy signal, never as an unverified replacement for a current target fact.

Do not use old spreadsheets, cached calculators, old PvME tables, or existing Equilibrium values as proof. Do not silently keep a repository value when a current source disagrees. Preserve the conflict in quarantine or patch context and choose the app-facing value deliberately.

Use the actual `SourceReference` type from `src/combat/types.ts`. Every shipped factual record needs a usable Wiki page URL and `verifiedAt`; include `revision` or a source content hash when available. Derived values use `source: "derived"` and `derivedFrom` references.

## Bucket retrieval

Retrieve data during a development or sync command, never from the browser or normal data rebuild. The RuneScape Wiki Bucket API uses:

```text
action=bucket
format=json
formatversion=2
query=bucket('infobox_monster')...run()
```

Use a bounded query with explicit `select` fields and a `where` clause for each manifest page. Do not scrape rendered HTML or scan a broad category and infer the target set. Retain the query, retrieval identity, page name, `page_name_sub`, and accepted version in the reviewable source context.

Request only fields needed by the target contract. The baseline is:

```text
page_name, page_name_sub, name, version_anchor, id,
life_points, size, defence_level, armour,
weakness, weakness_text, weakness_by_class, weakness_affinity,
melee_affinity, ranged_affinity, magic_affinity,
susceptible_to, susceptible_to_poison, slayer_category,
primary_attack_style
```

`page_name_sub` is part of row identity. `id` is NPC metadata, not the Equilibrium stable ID, and may be repeated or represented as an array. Bucket fields can be nullable; `susceptible_to_poison` is text rather than a Boolean. Treat repeated values and field types according to the Bucket schema instead of coercing them through generic truthiness.

Use the `json` field only when a required fact has no stable named field. If a fact such as race or a style immunity is not present in a named field, record the exact source evidence and keep the derived flag provisional unless the source clearly establishes it.

## Manifest and version selection

Use a tracked, curated target manifest. Do not define coverage from `Category:Bosses`.

Each manifest entry must declare:

```text
stable target id
canonical page name
accepted page_name_sub or version anchor
display encounter / variant name
accepted NPC id(s), when useful for disambiguation
supported, provisional, or unsupported status
collapse group, when rows intentionally share one target preset
source and a short reason for any intentional collapse
```

Resolve the exact page and version from the manifest. Never choose the first Bucket row. A missing page, missing accepted version, ambiguous row, or changed row identity is an import error.

Curate coverage from the current Combat Achievements or Combat Mastery universe, Soul Reaper universe, and explicitly documented major instanced encounters. Record the source and date for the coverage lists. Expand elite-dungeon and Sanctum encounters into individual attackable targets only where that target distinction is supported. Keep skilling or non-combat bosses out of normal offensive target selection; they may remain explicitly unsupported in the manifest.

## Static target contract

Keep source facts separate from player scenario state. A supported static record should contain, directly or through the existing data-sync source document:

```text
stable id and display name
source page/version identity
defenceLevel
baseArmour
affinities: melee, ranged, magic, optional exact weakness
weakness metadata: class, text, identifiers
maximumLifePoints, when sourced
size
poisonability: poisonable, immune, or unknown
slayer categories and explicitly sourced race flags
style immunity or allowed-style metadata, when relevant and supported
support status and sources
```

Use nullable fields for unknown facts. `0` is a valid value only when the source states zero; it is not an unknown marker.

### Defence and armour

Map Wiki `defence_level` to the target Defence level and Wiki `armour` to base armour. The generic target formula adds the Defence-derived armour component. Do not import total armour as base armour or add the Defence component a second time.

### Numeric affinities

Preserve exact numeric values from `melee_affinity`, `ranged_affinity`, `magic_affinity`, and `weakness_affinity`. Store a numeric profile, not only `weak`, `same`, `strong`, and `weakness` labels.

The generic defaults are 90 for an applicable specific weakness, 70 for a weak style, 60 for neutral or Necromancy, and 50 for a strong style. These are fallback game rules, not permission to fill a missing source field. If a target lacks enough source data to establish its profile, leave the value nullable and mark the target provisional.

Resolve the selected style affinity from the numeric profile. A specific weakness is a separate scenario/loadout choice; do not set it merely because the target has weakness metadata. Generic melee, ranged, or magic weaknesses use the corresponding style affinity.

For a custom three-style profile, derive Necromancy from the numeric middle value and retain `derivedFrom` references to all three source affinities. Test at least `70 / 60 / 50 -> 60` and `55 / 55 / 55 -> 55`. Do not store the derived value as a Wiki-sourced field.

League effects that use the target weakness must compare and apply the exact numeric weakness affinity. Do not route them through the legacy affinity enum or assume weakness is always 90.

### Weakness, race, and Slayer

Preserve weakness class, text, and identifiers. Do not set `hasApplicableWeakness` from the target name or weakness metadata. Until the equipment system proves exact compatibility, leave applicability as an explicit scenario choice.

Preserve `slayer_category` and `susceptible_to` as source metadata. Do not infer Demon Slayer, Dragon Slayer, or Undead Slayer flags from a name, appearance, encounter name, or `susceptible_to` entry alone. Set a race flag only when the Wiki page or another explicit cited source establishes the race.

`onSlayerTask` is always player scenario state. A target preset must not enable it.

### Poisonability

Normalize the Wiki poison field to exactly three states:

- explicit true token: `poisonable`;
- explicit false or immunity token: `immune`;
- missing, null, or unresolved token: `unknown`.

Normalize text deliberately; do not use JavaScript truthiness. The existing Boolean `poisonImmune` path cannot represent unknown safely. Keep unknown out of poison-dependent calculations or add an explicit support/scenario policy before wiring the preset into the engine.

### Size and life points

Normalize a documented omitted size for a normal 1x1 NPC to `1`. Treat an edit placeholder such as `? (edit)` as unknown, not as 1. Preserve the distinction between `size` and the engine's `occupiedTiles`; do not set `occupiedTiles = size²` without a sourced mechanic.

Import `life_points` as maximum target life when it is part of the supported target contract. Do not map it to `hpPercent`. `hpPercent` is current scenario state. Maximum life already affects supported target mechanics such as target vitality and Death Mark, so rows differing only in maximum life may not be collapsed globally.

### Immunity and phases

If a version or phase has style-specific damage immunity or an allowed-style restriction, either model that metadata in the generic target contract or mark the row unsupported/provisional. Do not present a phase-imperfect row as a normal offensive target. A phase distinction may be collapsed only when all simulator-relevant target facts are identical, including life points, affinities, weakness, poisonability, size, race flags, and immunity metadata.

Differences only in outgoing attacks do not require a separate target preset when outgoing boss behavior is outside scope. Differences in any supported target fact do.

## Scenario separation

Keep these out of static target facts unless the user explicitly selects them:

- current `hpPercent`;
- applicable exact weakness;
- `onSlayerTask`;
- area target count;
- `occupiedTiles` when it is an engine spatial assumption;
- incoming hit interval or incoming hit damage;
- phase selection or encounter state not modeled by the generic target.

Persist a stable target preset ID and scenario overrides rather than copying an expanded static record into the loadout. Do not create a second source of truth in a giant TypeScript target table.

## Data-sync integration

Use the established pipeline:

1. Retrieve a bounded Bucket payload using the manifest.
2. Normalize and validate into a reviewable candidate result.
3. Review source conflicts, row identity, collapse decisions, and support status.
4. Add the smallest dated JSONL patch under `data/patches/`.
5. Run `npm run data:rebuild`.
6. Run `npm run data:canonical:export` and `npm run data:canonical:validate`.
7. Run `npm run audit:data` and focused target/data tests.

Do not hand-edit `data/canonical/`. Do not commit `.cache/`, `.generated/`, SQLite, generated reports, or browser payloads. Normal rebuilds must remain offline and must not call the Wiki. Use a canonical data source document plus a typed adapter; do not add a parallel importer or runtime network dependency.

## Failure policy

Stop the affected target when:

- the manifest page or accepted version cannot be resolved;
- a selected row changes identity or required numeric fields become malformed;
- duplicate candidate rows differ in a simulator-relevant fact without an explicit policy;
- an edit placeholder is coerced into a fact;
- a current-game regression fixture fails.

Report the target ID, page/subentity, field, source value, and reason. Keep incomplete or disputed facts nullable and provisional rather than guessing.

## Regression coverage

Use source-backed fixtures that test normalization and relationships, not a hand-authored replacement dataset. Include representative current-game cases for:

- post-modernisation GWD1 Defence and armour;
- Kalphite Queen's `70 / 60 / 50` profile plus its phase/immunity handling;
- Helwyr, Gregorovic, and Twin Furies affinity changes;
- Vindicta/Gorvek's selected current version rather than a challenge-mode row;
- distinct Araxxor and Araxxi custom profiles;
- TzTok-Jad's custom all-style affinity;
- King Black Dragon's current asymmetric style values;
- Amascut's arbitrary numeric affinity such as 55;
- Silverquill's current version, poison immunity, and intended row deduplication.

Also test deterministic byte-equivalent output for the same payload and manifest, explicit null handling, exact page/version selection, numeric affinity selection for all four combat styles, unknown poisonability, and collapse rejection when maximum life or immunity differs.
