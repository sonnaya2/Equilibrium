---
name: rs3-ponytail
description: Lean-code rules for the whole RS3 Equilibrium app. Use when implementing, simplifying, refactoring, or reviewing UI, data scripts, map code, combat math, tests, or repository automation. Preserves load-bearing game mechanics and provenance while preventing needless stores, branches, dependencies, files, abstractions, and agent comments.
---

# RS3 Equilibrium Ponytail

Apply the normal Ponytail ladder after tracing the real flow. This repo layer identifies what is safe to simplify and what is not.

## Whole-app defaults

- Extend existing files and helpers before adding files, libraries, stores, workflows, or abstractions.
- Root `data/` is the one shipped store. Do not add a database, API, CMS, or duplicate data tree.
- Publish from the primary `main` checkout. Do not create branches, worktrees, or pull requests unless the user asks.
- Reuse the current test framework and scripts. Non-trivial behavior gets the smallest focused regression check that proves it.
- Delete stale automation and duplicated guidance instead of building synchronization machinery around it.
- Keep UI code lean without flattening visual hierarchy, accessibility, real art, or rendered QA.
- Keep Three.js fenced to Map; never make other routes pay for it.

## Preserve load-bearing complexity

Load `combat-math` before touching combat mechanics. Fewer lines never justify changing:

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

Load `data-sync` before changing ingestion or generated data. Ingestion supplies candidates; verified mechanics and canonical records remain explicit. Never replace sourced rules with tooltip parsing or plausible filler.

## Comments

Do not emit `ponytail:`, agent, prompt, pass, reviewer, implementation-history, decorative, or code-narration comments in this repo. Put durable ceilings in the focused test, assertion, canonical skill, or `AGENTS.md`. Keep code comments only for non-obvious mechanics, compatibility, safety, provenance, or tool directives.

## Domain intensity

- UI, routes, local storage, scripts, workflows, and tests: full lean pressure.
- Data boundaries and combat: remove ceremony only after loading the relevant domain skill and tracing the path.
- Audits: findings are suspects to verify, not automatic deletion orders.

The goal is fewer moving parts, not fewer product capabilities or weaker proof.
