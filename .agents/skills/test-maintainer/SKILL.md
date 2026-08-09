---
name: test-maintainer
description: "MANDATORY for any Vitest or Playwright work in RS3 Equilibrium. Read and follow completely before writing, editing, deleting, relocating, or triaging tests; before changing expectations to green a suite; and before adding regressions for combat, solver, simulation, UI, or data. Covers anti-cheating rules, integer vs EV events, layer choice, and suite cleanup. Never weaken valid tests to pass incorrect production behavior."
---

# Test maintainer

**Mandatory entry gate.** If you are writing, editing, deleting, relocating, running-to-fix, or
triaging any test under `src/**/*.test.ts` or `e2e/`, or changing an assertion/expectation, you must
read and follow this skill first. Domain skills still own mechanic truth; this skill owns how the
suite may change. Skipping it is a process bug.

Maintain Equilibrium’s test suite as a trustworthy detector of production defects. This skill is for
**implementing** test maintenance, not proposal-only audits.

Domain truth lives elsewhere — read those skills before rewriting expectations:

| Skill | Owns |
| ----- | ---- |
| `combat-math` | Hit value, rounding, DPL, crit layers, modifier order, **source hierarchy** for every combat number |
| `combat-sim` | Engine layout, tick/cast/event semantics, stochastic lanes, horizon metrics |
| `equipment-effects` | Item/passive/set routing |
| `league-blessings` / `league-data` | League facts and support labels |
| `playwright-e2e` | How to run local Playwright (managed runner, ports, teardown) |
| `lean-implementation` | How much code a change deserves |

Do not restate those domains here. Do not invent mechanics to make a suite green.

## Repository layout (inspect, do not assume ideal)

- Vitest: `src/**/*.test.ts` only (`vitest.config.ts` `include`). New tests must land under that
  pattern or intentionally update the config.
- Playwright: `e2e/*.spec.ts`; combat-focused config is `playwright.combat.config.ts`.
- Scripts: `npm test` (Vitest; `pretest` runs `data:rebuild`), `npm run test:e2e`,
  `npm run test:e2e:combat`, `npm run test:e2e:webgpu`.
- CI: `.github/workflows/validate.yml` — data audit, art check, typecheck, lint, format, unit tests,
  build on **push to `main`** (and `workflow_dispatch`). Full Playwright is **not** in default CI;
  combat E2E is optional via `workflow_dispatch` input `enable_combat_e2e`. Work lands on `main`
  directly (see `AGENTS.md`) — do not design for a PR-only gate that does not exist.

Maximize useful confidence per test. Do not maximize count or coverage percentage.

## Absolute rule

A failing test is not automatically a broken test.

Before editing any failure, classify it:

1. Production code is wrong.
2. The test expectation is wrong.
3. The intended mechanic changed (source-verified).
4. The covered feature was removed.
5. The test is flaky or state-dependent.
6. It asserts an implementation detail rather than a public contract.
7. It belongs in another layer (Vitest vs Playwright).
8. Fixture or generated data is stale.
9. Selector/UI contract changed while behavior is still correct.

When production is wrong: fix production, keep the valid test, add a focused regression if the
existing case does not pin the bug. **Never** change an expected value only because the engine
currently emits another number.

## Anti-cheating

Do not make bad production code pass by:

- copying current engine output into the expected value;
- loosening tolerances without a mechanic-based reason;
- replacing exact assertions with `toBeTruthy`, bare existence checks, or broad snapshots;
- accepting multiple results when only one is valid;
- using `.first()` to hide duplicate/ambiguous accessible names;
- broadening selectors until an unrelated element matches;
- mocking the production boundary under test;
- skipping/quarantining without identifying cause;
- deleting a valid regression;
- reproducing the production formula inside the test as its own oracle;
- changing combat rules solely to satisfy a stale fixture;
- rounding expected results differently from the game mechanic;
- converting integer game events into fractional expected values.

Do not alter production solely to satisfy a stale or incorrect test. Establish the contract first.

## Mechanics ground truth

Code, comments, fixtures, screenshots, and existing expectations are **not** authority by themselves.

For unclear combat numbers or timings, follow **`combat-math`’s source hierarchy** (Jagex notes →
current Wiki → PvME/RS Analysis only where primary sources are incomplete → other calculators as
discrepancy signals only). Do not blindly match another calculator.

When sources disagree: name the dispute, prefer the strongest source, pin the chosen interpretation
in a focused test, and leave a short source comment only when maintainers would otherwise not know
why the expectation exists. No essay comments.

## Integer events vs expected values

**Integers** when representing actual simulated events: hit counts, cast counts, ticks, stacks,
souls, necrosis/parasite stacks, event counts, cooldown ticks, ability slots.

**Fractional OK** for expected damage, probability-weighted damage, average DPM, weighted lane
totals, expected crit contribution.

The Analysis UI must never describe a fractional number of actual hits, casts, ticks, or stacks.

## Working procedure

1. **Surface first** — failing test, production module, callers, fixtures, nearby tests, generated
   data setup if staleness is plausible. Do not start by editing the assertion.
2. **Narrow baseline** — one Vitest file/name, one domain directory, or one Playwright spec via
   `playwright-e2e`. Record the original failure before changing code. Do not run full audit +
   rebuild + e2e + production build after every edit.
3. **Classify** (internally): Keep · Improve · Relocate · Rewrite · Delete. No giant inventory
   report unless asked.
4. **Smallest correct repair** — prefer one production fix + one regression; strengthen an existing
   test over near-duplicates; delete without mandatory replacement; readable integration over private
   helper spam; explicit small fixtures over giant factories; state assertions over broad snapshots.
   Do not turn test maintenance into an unrelated engine rewrite.

## Layer rules

### Vitest

Formulas, rounding, ability contracts, cast prepare/commit, event scheduling, runtime snapshots,
stochastic lanes, summaries, style mechanics, solver scoring/constraints, small exhaustive solver oracles,
parsers/data validation, components that do not need a real browser, combat-module integrations.

### Playwright

Real browser flows only: open `/combat`, configure loadout, run manual/Revolution rotation, start
and finish a solver run, apply results, persistence across reload, worker integration, critical a11y
keyboard paths, failures that cannot be reproduced below the browser.

Not for pure damage formulas, reducers, trivial toggles, implementation markup, or ability
permutation matrices already covered by Vitest.

Run Playwright only through `playwright-e2e` (managed runner). Default headless WebGPU skips are
expected; other skips need investigation.

Prefer roles, labels, and accessible names. Use test IDs only when no stable semantic selector
exists. Do not hide ambiguous UI with `.first()`.

Split a bloated `e2e/combat.spec.ts` by user responsibility only when each file has clear weight —
not into tiny one-test specs.

### Generated data / SQLite

`pretest` rebuilds data. While iterating on pure unit logic, prefer targeting a single file with
`npx vitest run path` when a full `npm test` rebuild is wasteful — but final validation should still
use the normal scripts when data was in play.

Tests must not: modify committed source data; leave generated files dirty; depend on an arbitrary
local DB; use live network; share mutable generated outputs across parallel tests.

Prefer small committed fixtures; isolated temp DBs for DB integration; one explicit data-validation
stage. When the bug is in the pipeline, cover source→normalized **and** consumer behavior — do not
only patch a frontend expectation.

## Domain priorities (contracts, not checklists)

**Combat math** — small fixtures that make wrong floors or modifier order obvious; goldens derived
independently per `combat-math` (never by calling the function under test). Cover base damage by
weapon config, DP, accuracy, crit layers, hit caps, intermediate rounding, multi-hit/DoT, add vs
mult, once-only effects.

**Ability contracts** — style/weapon legality, adrenaline, cooldown, hit count/timing, channel/DoT
scheduling, crit/cap interaction, unlock restrictions, miss vs stack rules, per-cast vs per-hit
effects. Group by style or mechanic; do not force one file per ability.

**Simulation / runtime** — rejected casts mutate nothing; successful casts commit once; monotonic
timestamps; deterministic same-tick order; GCD/cooldown/adrenaline integrity; snapshot safety;
lane weights sum to 1; aggregation preserves weighted totals; fixed seeds; damage-only RNG stays
expected-value; future-changing RNG uses concrete lane state; fixed-window vs natural-completion metrics not mixed; no NaN/
Infinity; DoT vs direct classification. Seeded random counts stay modest.

**Revolution / rotation** — bar order, legality, adrenaline, channels, duration, summary DPM **plus**
a few intermediate casts/timings so failures name the broken mechanic — not only one giant final DPM.

**Solver (high risk)** — only legal abilities; bar min/max slots; illegal duplicates/exclusives;
region locks; unsupported abilities excluded or reported; exploratory scores not mixed with
full-horizon scores; consistent ranking units; failed/NaN evaluations never win; fixed seed;
returned best ≥ baseline; applied bar is the scored bar; progress/cancel leaves UI usable; diversity
must not discard the true best; honest fallback labels. For **tiny** candidate pools, enumerate every
legal bar as an oracle. For large spaces, invariants and known regressions only — no massive formal
verification framework.

**Component / state wiring** — loadout→calc path, slot compatibility, DB-derived stats, LP, prayer/
overload/relic/blessing/perk selection, reset, persistence/migrations/corrupt state, analysis
formatting (integer event counts), solver progress/results/errors, accessible names and keyboard.
Not incidental CSS or DOM nesting unless it is an intentional contract.

## Delete and improve

**Delete** when the feature is gone; coverage is duplicated more strongly; the test cannot fail;
it only asserts “renders”; it tests the framework; it pins temporary copy/layout with no contract;
it uses production as oracle; it tests mocks instead of the claimed integration; it is permanently
skipped; it depends on obsolete architecture; it is expensive with no distinct protection; the
snapshot is too broad; it only covers a private helper already proven via public behavior.

Before deleting: confirm the real contract is covered elsewhere **or** no longer deserves coverage.
Do not auto-replace every deletion.

**Improve** in place when possible: sharper assertion, correct accessible selector, resulting state
over intermediate markup, replace giant snapshots, less setup, isolate persistence, fix fixtures,
move layer, one boundary case. Parameterize only for meaningful mechanic boundaries — no huge
matrices.

## Suite and CI discipline

Optimize like a serious personal app: cut duplicated browser coverage; move narrow UI cases to
Vitest; avoid needless full rebuilds while iterating; fixed seeds; small fixtures; focused commands
while editing; full relevant validation once stable.

Do **not** introduce without demonstrated need: another framework, testing DSL, giant fixture
builder, repo-wide property/mutation testing, broad browser matrix, arbitrary coverage gates,
hundreds of generated cases, perf harnesses for ordinary functional tests, dashboards.

Do not “optimize” by deleting valuable regressions.

CI claims must match reality: unit tests run on `main` push; Playwright is local (and optional
combat job only when explicitly enabled). Do not claim browser coverage is CI-gated when it is not.
Modest CI fixes are fine when they are the task; do not turn cleanup into a CI-platform rewrite, and
do not enable combat E2E on every push without measured stability.

## Validation cadence

While editing: affected Vitest file/name → domain tests → Playwright only if browser behavior
changed (via `playwright-e2e`) → typecheck if production types moved → lint/format when stable.

Near completion, from `package.json` as relevant: data audit/rebuild only if data was affected;
typecheck; lint; format check; full Vitest; combat Playwright / other affected e2e; production
build. Do not re-run the full stack after every small edit.

## Communication

Sparse updates: confirmed production bug; a “broken” test that is actually valid; large obsolete
group removal; blockers; final validation failures. No narration of every file, command, rename, or
passing case.

### Final summary (required)

- production bugs fixed
- incorrect tests repaired
- dead/duplicate/obsolete tests removed
- important regressions added
- Vitest ↔ Playwright relocations
- suite/setup optimizations
- final commands and pass/fail
- material coverage gaps remaining

No inflated test count as quality evidence.

## Done when

Valid failures produced production fixes (not weakened expectations); wrong expectations corrected
from independent evidence; obsolete/low-value tests gone; important combat/sim/solver regressions
have direct coverage; discrete events stay integers; tests do not use production as oracle;
Playwright stays on real user flows; Vitest owns calc/state/focused integration; data tests are
isolated and deterministic; runs leave the repo clean; the suite is proportionate and reasonably
fast; final relevant validation passes.

Be skeptical and restrained. Do not rewrite the combat engine because tests need maintenance. Do not
rewrite valid tests to protect incorrect code. Fix what is actually wrong.
