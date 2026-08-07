---
name: simple-commit-messages
description: Enforces short, plain, human-readable Git commit messages. Use before creating, amending, squashing, rebasing, or suggesting any commit.
---

# Simple commit messages

Write Git commit messages like a normal developer recording what changed.

## Required style

Commit messages must be:

* short
* specific
* factual
* written in plain English
* focused on the main user-visible or technical change
* normally one line
* preferably 3–8 words
* no longer than 60 characters unless a longer name is genuinely necessary

Use the imperative form where natural:

```text
Add Big Boned passive
Fix shield armour scaling
Update Zuk cape abilities
Remove unused combat data
Split rotation state
Correct bleed duration
Add spear passive
Fix loadout life points
```

A slightly more descriptive message is acceptable when needed:

```text
Add Masterwork spear bleed extension
Fix Big Boned bonus damage scaling
Restore second weapon gizmo slot
Add region-limited solver pool
```

## Forbidden style

Do not write:

* essays
* multi-paragraph commit bodies
* implementation diaries
* detailed debugging narratives
* test-count summaries
* long lists of every changed file
* explanations of rejected approaches
* marketing language
* exaggerated claims
* model names
* agent names
* swarm terminology
* prompt numbers
* worktree names
* phrases such as “honest,” “robust,” “comprehensive,” or “production-grade” unless they are literally part of a feature name
* statements about how the code was generated
* decorative prefixes that add no value
* emoji
* automatic AI attribution trailers

Do not add any of the following unless the user explicitly requests it for that exact commit:

```text
Co-Authored-By: Claude ...
Co-Authored-By: ChatGPT ...
Co-Authored-By: Grok ...
Generated with ...
Written by ...
AI-assisted ...
```

Do not use commit messages like:

```text
Fix combat simulation with comprehensive correctness improvements

Refactor the combat engine to provide robust and mathematically honest
branching semantics while preserving all existing behavior and adding
extensive regression coverage.

Implement requested changes from PROMPT 3 using five parallel agents

Resolve a complex set of intertwined issues discovered during an
exhaustive audit of the combat pipeline
```

Replace them with:

```text
Fix combat branch merging
Split combat resolution
Add RNG summary bounds
Fix solver score ranking
```

## Commit body policy

Default to no body.

Use a body only when one of these is true:

1. A breaking migration requires operator action.
2. A security fix needs a private-safe explanation.
3. A non-obvious compatibility constraint cannot fit in the subject.
4. The user explicitly asks for a detailed commit message.

When a body is necessary:

* keep it under five short lines
* state only information needed by a future maintainer
* do not narrate the development process
* do not list routine tests
* do not mention agents or models

Example:

```text
Migrate combat data schema

Rebuild the generated database after pulling this commit.
Existing local SQLite files are incompatible.
```

## Choosing the subject

Identify the single most important completed change.

Use this order:

1. New feature or mechanic
2. Bug fixed
3. User-visible behavior changed
4. Structural refactor
5. Cleanup or documentation

Do not try to summarize every file in one subject.

For mixed changes, choose the main outcome:

```text
Add Big Boned passive
```

Not:

```text
Add Big Boned passive, update data, tests, UI, solver, docs and exports
```

## Prefixes

Conventional Commit prefixes are optional.

Prefer no prefix unless the repository already uses them consistently.

Good:

```text
Add Zuk cape passives
Fix Aegis armour scaling
Remove dead asset scripts
```

Also acceptable where established:

```text
feat: add Zuk cape passives
fix: correct Aegis armour scaling
chore: remove dead asset scripts
```

Never stack scopes and labels into a large header:

```text
feat(combat-engine-rotation-passives-data): implement ...
```

## Before committing

Before every commit:

1. Read the staged diff.
2. Determine the main completed change.
3. Write one short subject.
4. Remove any generated commit body.
5. Remove model or agent attribution.
6. Confirm the message describes what actually landed.
7. Do not claim tests passed unless the commit message genuinely needs that fact—which it almost never does.

## Amend rule

If an existing local commit has an overly long generated message and has not been published, shorten it.

Do not rewrite published history unless the user explicitly requests a history rewrite and understands the consequences.

## Examples for this repository

```text
Add Big Boned passive
Fix Big Boned crit damage
Add Zuk cape passives
Disable locked Zuk abilities
Add Masterwork spear passive
Fix Fortitude life scaling
Correct Aegis armour bonus
Add blessing combat rules
Fix equipment life points
Add Primal +5 armour
Restore invention perks
Fix solver score ranking
Add solver worker pool
Remove agent configuration
Update release gitignore
Add clean export audit
Rewrite combat documentation
```

## Final rule

A commit message is a label for a change, not a report about the work session.

When uncertain, use fewer words.
