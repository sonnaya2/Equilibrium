# AGENTS.md — RS3 Equilibrium

Handoff for Grok / Claude / opencode / other agents. **Read before editing code.**

Repo: Equilibrium (Leagues II companion). Fan project, not Jagex.

## Comments (hard)

Prefer no comment. Names and types first.

Comments carry **load-bearing facts only**: formulas, wiki ticks, double-count traps, architecture boundaries, schema bumps. One short line when possible.

| Ban | Instead |
|-----|---------|
| U+2014 em-dash (`—`) or U+2013 en-dash (`–`) in `//` or block comments | ASCII `-` / `;` / `:` / parens |
| Lecture voice: "the only honest default", "never invent", "fake zero", "Behavior-preserving", "ensures that", "This module is responsible for" | State the rule once, plain |
| Narrating the next line (`// increment counter`) | Delete |
| Multi-paragraph file-header README clones | One line or nothing |
| Section banners (`// --- helpers ---`) | Delete |

**Keep:** wiki URLs, exact numbers, floor-chain / crit-layer / proof-label gotchas.

**Keep:** solver **"honest"** only as product jargon for proof/score honesty (not moralizing).

User-facing UI strings may use en/em dash if copy needs it. **Comments must not.**

Machine gate: `npm run audit:comments` (`scripts/comments/check.mjs`). Do not bypass. Do not weaken the gate to land a PR.

## Product shape (short)

- Next.js planner + task tracker + from-scratch RS3 combat engine.
- Combat core: **no React**. Ordered modifier pipeline, intermediate rounding, layered crits, DPL, hit caps, style state machines, League ruleset layering, `SourceReference` provenance.
- Data: canonical JSONL + migrations + patches; do not hand-edit `data/canonical/` (use patches).
- UI: game-tool density; see `docs/ui-contracts.md` and CONTRIBUTING.

Longer detail: `CONTRIBUTING.md`, `docs/combat-engine.md`, `docs/combat-model.md`, `docs/data-platform.md`.

## Hard engine invariants (do not collapse)

- Floor chains stay stepwise; never rewrite as one `floor(A*B*C)`.
- Crit is not `damage * 1.5`.
- Hit caps are per-effect metadata.
- League blessings/relics layer on; do not bake into base formulas.
- Never write invented league numbers as facts.

## Code style

- Extend existing files; split past ~600 lines when a file becomes a dump.
- Minimal targeted diffs; no drive-by refactors.
- Verify with the npm scripts that match the change (`test:combat`, `audit:architecture`, `audit:comments`, etc.).
