# Equilibrium scraped data

Snapshot date: **2026-07-24**

This folder is a normalized research dump for RuneScape 3 combat, 2026 balance/content changes, Leagues: CATALYST, and Leagues II: EQUILIBRIUM.

The goal is to keep source facts usable by code without copying wiki prose 1:1.

## Files

- `sources.json` — source manifest and provenance.
- `equilibrium.json` — confirmed Leagues II structure, regions, progression systems, and currently revealed relics.
- `catalyst.json` — historical Catalyst progression, relic tiers, passives, and task scoring for comparison.
- `combat-2026.json` — the March 2026 Combat Style Modernisation and related combat-system changes.
- `regions.json` — region-gated content, notable bosses, skilling/training anchors, and upgrade dependencies.
- `training-methods.json` — high-value/current training methods mapped to region access with freshness notes.
- `2026-changes.json` — other 2026 changes that materially affect League planning.
- `unknowns.json` — intentionally unresolved or not-yet-revealed data. Do not silently guess these values.

## Confidence fields

- `confirmed_official` — explicitly stated by Jagex.
- `confirmed_wiki` — directly supported by current RuneScape Wiki data.
- `inferred_region` — location mapping is strong but Equilibrium-specific region behavior has not yet been explicitly confirmed.
- `legacy` — Catalyst-era behavior retained for comparison only.
- `unrevealed` — Jagex has announced the system but has not published the specific value/effect yet.

## Important date caveat

Jagex says daily Equilibrium reveals begin **2026-07-28** and continue through launch on **2026-08-10**. As of this snapshot, only Tier 1 relics are public; later relic choices and the concrete Blessing effects are intentionally left unresolved.
