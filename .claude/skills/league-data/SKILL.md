---
name: league-data
description: Domain model for RuneScape 3 Leagues II Equilibrium. Use when changing regions, relics, blessings, task records, League Points, provisional data, or the Map, Tasks, and Build routes. Distinguishes verified Equilibrium rules from temporary Catalyst test data.
---

# Equilibrium league data

Model only sourced League rules. Keep unknown content empty and visibly provisional rather than filling gaps with plausible values.

## Regions

Start with Misthalin and Havenhythe. The first task milestone unlocks Karamja. Later milestones allow three elective regions from Asgarnia, Kandarin, Fremennik Province, Forinthry, Desert, Morytania, Tirannwn, and Anachronia.

Treat regions as a graph of content and unlock dependencies, not a flat checklist. Planning is ironman and self-sufficient; do not add a Grand Exchange mode.

## Relics and blessings

The League has seven relic tiers. Keep exact effects and unlock costs provisional until a current official or Wiki source verifies them.

Blessings are combat-only, use eight tiers, and track Order, Chaos, and Balance choices. Derive God Tier at tiers four and eight from ordered path history:

- two or more Chaos choices: Chaos God;
- two or more Order choices: Order God;
- two or more Balance choices, or one of each: Balance God.

Model resets by rewriting path history. Do not merge League effects into base RS3 formulas. `src/combat/league/ruleset.ts` exposes `LeagueLoadout` and `leagueModifiers(loadout): CombatModifier[]`; keep that function empty until each modifier has a verified source.

## Tasks

Tasks span Easy through Master and award League Points. Preserve point values, completion-rate qualifiers, region and build availability, provenance, and local completion state.

Catalyst records are temporary test data:

- label them on every Tasks render;
- preserve live versus snapshot status and `<0.1%` qualifiers;
- never import Catalyst rewards, milestones, categories, or unlock rules;
- replace them when official Equilibrium tasks publish.

Use the purpose-built Tasks card browser. Do not force tasks into Data's table layout.

## Provisional rule

Do not hardcode task points, relic effects, blessing effects, or unlock costs from countdown copy. A record stays unverified until its own `SourceReference` supports it.

Base combat math must remain independently testable with `leagueModifiers(loadout)` omitted. Add League modifiers through the existing ordered modifier pipeline only.
