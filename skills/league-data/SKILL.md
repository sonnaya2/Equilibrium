---
name: league-data
description: Domain model for RuneScape 3 Leagues II Equilibrium. Use when changing regions, relics, blessings, task records, League Points, provisional data, or the Map, Tasks, and Build routes. Distinguishes verified Equilibrium rules from temporary Catalyst test data.
---

# Equilibrium league data

Model only sourced League rules. Keep unknown content empty and visibly provisional rather than filling gaps with plausible values.

## Regions

Start with Misthalin and Havenhythe. The first task milestone unlocks Karamja. Later milestones allow three elective regions from Asgarnia, Kandarin, Fremennik Province, Forinthry, Desert, Morytania, Tirannwn, and Anachronia.

Treat regions as a graph of content and unlock dependencies, not a flat checklist. Planning is ironman and self-sufficient; do not add a Grand Exchange mode.

## Relics

The League has seven relic tiers. Keep exact effects and unlock costs provisional until a current official or Wiki source verifies them. F2P access to the first three tiers is structural context, not permission to invent their contents.

## Blessings

Blessings are combat-only, use eight tiers, and track Order, Chaos, and Balance choices. Derive God Tier at tiers four and eight from the ordered path history:

- two or more Chaos choices: Chaos God;
- two or more Order choices: Order God;
- two or more Balance choices, or one of each: Balance God.

Model resets by rewriting path history. Do not merge Blessing modifiers into base RS3 formulas; pass them through the combat ruleset boundary.

## Tasks

Tasks span Easy through Master and award League Points. Preserve source point values, completion-rate qualifiers, region/build availability, provenance, and local completion state.

Present tasks in a purpose-built, readable card browser with build-aware filters and progress. Do not force Tasks into a dense data table merely because Data uses tables.

Catalyst records are temporary testing data only:

- label them clearly on every Tasks render;
- preserve live versus snapshot completion status and `<0.1%` qualifiers;
- never import Catalyst rewards, milestones, categories, or unlock rules;
- replace them when official Equilibrium tasks publish.

## Provisional rule

Do not hardcode task point values, exact relic or blessing effects, or region unlock costs from countdown copy. Verify against current official posts and the RuneScape Wiki. Keep records unverified until their own `SourceReference` supports them.

## Combat boundary

Enter League modifiers through the ruleset boundary:

```ts
calculateCombat(baseState, { ruleset: "equilibrium", relics, blessings, regions })
```

Base combat math must remain independently testable and usable with the League ruleset disabled.
