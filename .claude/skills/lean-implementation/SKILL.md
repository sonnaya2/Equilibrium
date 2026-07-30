---
name: lean-implementation
description: Scope and simplification rules for the whole RS3 Equilibrium app. Use when implementing, simplifying, refactoring, or reviewing UI, data scripts, map code, combat math, tests, or repository automation. Names the complexity that is load-bearing so simplification does not remove game mechanics or provenance.
---

# Lean implementation

Prefer the smallest implementation that preserves quality. Trace the real flow first: this file names
what is safe to simplify here and what is not.

## Whole-app defaults

- Extend existing files and helpers before adding files, libraries, stores, workflows, or abstractions.
- The generated SQLite database is the runtime data store; tracked authoring stays limited to one compressed seed, migrations, and small patches. Do not add an API, CMS, committed database, or duplicate authoring tree.
- Publish from the primary `main` checkout. Do not create branches, worktrees, or pull requests unless asked.
- Reuse the current test framework and scripts. Non-trivial behavior gets the smallest focused regression check that proves it.
- Delete stale automation and duplicated guidance instead of building synchronization machinery around it.
- Keep UI code lean without flattening visual hierarchy, accessibility, real art, or rendered QA.
- Keep Three.js fenced to Map; never make other routes pay for it.

## Preserve load-bearing complexity

Read `combat-math` before touching combat mechanics. Fewer lines never justify changing:

- ordered modifier stages and priority;
- intermediate rounding order;
- separate crit chance, crit damage, guaranteed crits, and per-hit eligibility;
- Damage Potential scaling;
- per-effect hit caps;
- the tested DPL curve;
- per-ability adrenaline and weapon timing;
- style-specific state machines;
- the League ruleset boundary;
- `SourceReference` provenance;
- the combat core's zero-React boundary.

Read `data-sync` before changing ingestion or generated data. Ingestion supplies candidates; verified
mechanics and sourced records stay explicit. Never replace a sourced rule with tooltip parsing or
plausible filler.

## Comments

Keep comments for non-obvious mechanics, compatibility, safety, provenance, or tool directives.
Do not leave notes about the process that produced the code — review passes, implementation history,
decorative section banners, or prose that restates the next line. Durable limits belong in a focused
test, an assertion, a skill file, or `AGENTS.md`.

## Domain intensity

- UI, routes, local storage, scripts, workflows, and tests: full simplification pressure.
- Data boundaries and combat: remove ceremony only after reading the relevant domain skill and tracing the path.
- Audit findings are suspects to verify, not automatic deletion orders.

The goal is fewer moving parts, not fewer product capabilities or weaker proof.
