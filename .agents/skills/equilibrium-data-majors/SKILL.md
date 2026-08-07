---
name: equilibrium-data-majors
description: >
  Author or fix RS3 Equilibrium /data region content majors via data patches
  (activity + unlock faces, set-record catalog homes, dual-region pairs, Unlocks
  chips, icons). Use when the user says "add major", "content major", "/data
  patch", "region content", Thalmund, Airuts dual region, fishing frenzy major,
  unlocks chips, data:rebuild, missing major under Kandarin/Asgarnia, or asks to
  surface a boss/hub/method on /data. Slash: /equilibrium-data-majors.
---

# Equilibrium content majors

Planner-facing faces on `/data` region pages: research catalog `content[]` (+ optional
`upgrades[]` unlock twin). Not training-method rows. Not combat engine math.

| Doc | Path |
|-----|------|
| Platform law | `docs/data-platform.md` |
| Agent hard rules | `AGENTS.md` → `/data majors` |
| Gotchas | `references/gotchas.md` (this skill) |
| Examples | `data/patches/2026-08-05` … `2026-08-10-*-major*.jsonl` |

## Non-negotiables

1. **Never hand-edit `data/canonical/`.** Patch → rebuild/apply → `data:canonical:export` → commit **patch + canonical**.
2. **`set-record` is the catalog home.** Column `upsert` alone does not put a major on the region board.
3. **One content/upgrades home per entity.** Dual geography ⇒ **two entities** (e.g. `airuts` + `airuts-desert`). Same display name OK; IDs must differ.
4. Patches are **immutable once applied.** Fix = new dated file. Caps: 1 MiB / 1000 ops.
5. **Never invent** league numbers. Cite wiki/official on `upsert-source`.
6. "Missing major" is often **cache / collapse / ordinal / CSS** — check `references/gotchas.md` before inventing rows.

## Region ordinals (catalog path `regions[R]`)

From `research_regions.ordinal` (not `REGION_IDS` file order):

| R | region | R | region |
|---|--------|---|--------|
| 0 | misthalin | 6 | forinthry |
| 1 | havenhythe | 7 | desert |
| 2 | karamja | 8 | morytania |
| 3 | asgarnia | 9 | tirannwn |
| 4 | kandarin | 10 | anachronia |
| 5 | fremennik | | |

Confirm live max content ordinal before writing:

```bash
npm run data:find -- --query "Name" --limit 20
npm run data:show -- --id activity:content:slug
```

## Procedure

### 1. Investigate

```bash
npm run data:find -- --query "<name>" --limit 30
npm run data:context -- --id activity:content:<slug> --format markdown
```

Is it soft-removed? Nested under a hub? Dual-region sites? Already a training method only?

### 2. Patch file `data/patches/YYYY-MM-DD-<slug>.jsonl`

Ops order per major:

1. `upsert-source` — stable `source:runescape-wiki:…`, url, verified_at
2. `upsert` `activity:content:<slug>` — status active, short + detailed with `· Unlocks: A, B, C`
3. `link-region` **primary** + **required** (`group: "single"` for self-supply)
4. Sibling region as **hint** only when a parallel major exists
5. `link-source`
6. `add-requirement` / `add-effect`
7. **`set-record`** `data/research/catalog.json` path `$.regions[R].content[N]` — body owns name/detail/kind/region fields/source
8. Optional unlock twin: `unlock:<region>:<slug>` + `set-record` on `$.regions[R].upgrades[M]` (append high M like 100+ OK)
9. Hygiene: hub prose points at the new major without deleting hub Unlocks

**Append** N = max content ordinal + 1 (default).
**Ordered insert:** park at `content[100]` → shift tail up → seat final (see `2026-08-07-aod-thalmund-content-ordinals.jsonl`).

**Dual region:** repeat with distinct activity + unlock ids; each `requiredRegions` is home only.

### 3. Unlocks chips

UI prefers middot segment `Unlocks:` over `Effects:` (`contentRewardsSource`).

```text
…prose… · Unlocks: Item A, Item B, Item C
```

Put that on **entity detailed_description and set-record detail**.
`CONTENT_REWARD_OVERRIDES` in `src/lib/researchRewards.ts` only when parse cannot carry a clean list.

### 4. Icons

| Surface | Module | Allowed roots |
|---------|--------|----------------|
| Row face | `dataEntityIconPath` / `DATA_ICON_ALIASES` / `dataIconIndex` | activities, bosses, upgrades, combat |
| Reward chips | `REWARD_ICON_BY_LABEL` / `resolveRewardIcon` | **only** `/game/upgrades/`, `/game/combat/`, `/game/bosses/` |

- Wrong related art is worse than empty name well.
- Chip aliases must not use `/game/activities/` (tests enforce).
- New art: wiki PNG → webp under `public/game/...` → alias + `npm run art:index` when bulk; or hand-add slug to index if pipeline already maps.
- Cases: eternal magic was wood-box (wrong) → logs/tree; Kuradal chathead; Manor Farm un-fence; Legiones boss plate; burial under skilling-production.

### 5. Apply + verify

```bash
npm run data:rebuild
npm run data:canonical:export
npm run data:show -- --id activity:content:<slug>
npx vitest run src/lib/dataContentPresentation.test.ts src/research/catalog.test.ts src/lib/gameArt.test.ts
```

Ship gate when large: `npm run audit:data`.
UI: hard-refresh `/data` (regionStore Map pins first fetch for the tab).

## Dual-region pattern (Airuts)

| Region | Activity | Unlock |
|--------|----------|--------|
| Kandarin | `activity:content:airuts` | `unlock:kandarin:airuts` |
| Desert | `activity:content:airuts-desert` | `unlock:desert:airuts` |

`set-record` **deletes all** `research_region_entries` for that entity+section before insert — one entity cannot live in two region content arrays.

## Anti-patterns

- Hand-edit canonical / mutate applied patch
- One entity dual-homed in two `content[]` slots
- Content major without `set-record`
- Product wants a major, reward buried only in hub prose
- Invent drop rates / league points without sources
- Trust "data fixed" without hard-reload when UI empty
- Assume missing major = missing entity before checking collapse/cache/ordinal 100

## Minimal Kandarin append recipe

```jsonl
{"op":"upsert-source","source":"source:runescape-wiki:…","set":{"url":"https://runescape.wiki/w/…","page_title":"…","publisher":"RuneScape Wiki","source_family":"runescape-wiki","verified_at":"YYYY-MM-DD","source_role":"verification"},"reason":"…"}
{"op":"upsert","entity":"activity:content:slug","set":{"entity_type":"activity","name":"Display Name","short_description":"…","detailed_description":"… · Unlocks: A, B, C","status":"active","verified_at":"YYYY-MM-DD","sort_key":"display name"},"reason":"…"}
{"op":"link-region","entity":"activity:content:slug","region":"kandarin","relation":"primary","order":0,"reason":"…"}
{"op":"link-region","entity":"activity:content:slug","region":"kandarin","relation":"required","order":0,"group":"single","reason":"…"}
{"op":"link-source","entity":"activity:content:slug","source":"source:runescape-wiki:…","role":"verification","order":0,"reason":"…"}
{"op":"set-record","file":"data/research/catalog.json","path":"$.regions[4].content[N]","entity":"activity:content:slug","body":{"name":"Display Name","kind":"…","detail":"… · Unlocks: A, B, C","regionId":"kandarin","regionRequirementType":"single","requiredRegions":["kandarin"],"confidence":"confirmed_wiki","source":{"source":"runescape-wiki","title":"…","url":"https://runescape.wiki/w/…","verifiedAt":"YYYY-MM-DD"}},"reason":"…"}
```
