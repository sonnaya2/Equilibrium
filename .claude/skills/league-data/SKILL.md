---
name: league-data
description: The Leagues II Equilibrium domain model for this repo - region locking and unlock milestones, the 7 relic tiers, the 8 blessing tiers with Order/Chaos/Balance path tracking and God Tier derivation at tiers 4 and 8, blessing resets, and task tiers and League Points. Use when modelling league content in src/league/, data/league/, or the Map, Tasks and Build routes, or when deciding whether a league number is safe to hardcode.
---

# Leagues II: Equilibrium domain model

Launches 10 Aug 2026. Fresh league character on dedicated league worlds, separate from the main
account; Account Nomination sends final rewards to a chosen account. No player trading this league.

## Regions

Start in **Misthalin + Havenhythe**. The first task milestone unlocks **Karamja**. Further milestones
unlock 3 more from: Asgarnia, Kandarin, Fremennik Province, Forinthry (Wilderness), Desert, Morytania,
Tirannwn, Anachronia. You cannot unlock everything - the tradeoff *is* the build. Unlocking a region
auto-completes a large slate of its quests.

Model regions as a graph of unlock milestones, not a flat checklist: what a region gates (content,
skills, tasks, bosses-as-unlocks) is what the planner needs to answer.

## Relics

7 tiers, returning from Leagues: Catalyst, rebalanced to avoid obvious best-in-slot picks. Each tier
also grants enhanced passive bonuses (XP, drop rates, run energy, skillcape perks, free Invention
materials, and so on). F2P gets the first 3 tiers.

## Blessings

New this league, combat-only, 8 tiers, unlocked via Blessing Tasks inside unlocked regions.
Three paths per tier: **Order / Chaos / Balance**.

God Tier Blessings are granted at **tier 4** and **tier 8**, derived from path choices so far:

- 2 or more Chaos -> Chaos God
- 2 or more Order -> Order God
- 2 or more Balance, or one of each -> Balance God

Up to 3 resets: one from Tier 1, two more as you progress. Model path history as an ordered list -
derivation needs the counts, and resets rewrite history.

## Tasks

Easy through Master, worth 10-400 League Points each. Points drive the League Trophy tier and relic
unlocks. Tasks get their own purpose-built interface, not a generic checklist grid.

## The provisional rule

Everything above comes from the 23 Jul 2026 countdown post. **It is flavour and structure, not final
numbers.** Do not hardcode task point values, exact relic or blessing effects, or region unlock costs
from that post. Verify against the RuneScape Wiki and the official reveal blogs as they publish daily
through launch. Records in `data/league/` stay `verified: false` until Wiki-confirmed, and the UI
should be able to say which numbers are still provisional.

## Where this plugs into combat

Relics and Blessings are combat modifiers like any other - same `CombatModifier` stage/priority
architecture - but they enter through the ruleset boundary:

```ts
calculateCombat(baseState, { ruleset: "equilibrium", relics, blessings, regions })
```

Never merged into base formulas. Base RS3 math must stay independently validatable and toggleable off.
