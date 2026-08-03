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

## /data majors (content patches)

Regional **content majors** on `/data` are catalog faces (`$.regions[N].content[i]`) backed by `activity:content:*` (+ optional `unlock:<region>:*` upgrade faces). Authored only via `data/patches/*.jsonl`.

**Skill (full cookbook):** `.grok/skills/equilibrium-data-majors/` — use when adding/fixing majors, dual-region, unlocks chips, "missing major".

| Do | Don't |
|----|--------|
| Patch → `data:rebuild` → `data:canonical:export` → commit **patch + canonical** | Hand-edit `data/canonical/**` or mutate an applied patch |
| Wiki-sourced facts; empty until sourced | Invent league numbers as facts |
| `set-record` for the catalog face the UI reads | Column-only `upsert` and assume the major shows |
| Detail ends with `· Unlocks: A, B, C` | Prose-only rewards when chips need item names |
| Dual-region site → **two entities** (e.g. `airuts` + `airuts-desert`) | One entity dual-homed in two `content[]` slots |
| Look up live `regions[N]` / max content ordinal | Guess ordinals from `REGION_IDS` order |
| Append free ordinal, or cascade via temp `content[100]` | Clobber live `content[i]` without shifting neighbors |

### Hard mechanics (learned the hard way)

1. **`set-record` is single-home.** Handler deletes all `research_region_entries` for that entity+section, then inserts one. Dual geography = dual IDs; same display name OK.
2. **Catalog path region index** = `research_regions.ordinal` (kandarin=`4`, asgarnia=`3`, desert=`7`, …). Confirm with `data:show` / region-entries before writing.
3. **Reactivate** soft-removed majors with `status: active` **and** `set-record` (Warforge, Advanced Barbarian, AoD hygiene).
4. **Reward chips:** parse prefers `· Unlocks:` over `Effects:`. Override only via `CONTENT_REWARD_OVERRIDES` in `src/lib/researchRewards.ts` when needed. Chip icons only under `/game/upgrades/`, `/game/combat/`, `/game/bosses/` — not `/game/activities/`.
5. **Row face icons:** `DATA_ICON_ALIASES` + `dataIconIndex` / `dataEntityIconPath`. Empty well > wrong art (eternal magic was wood-box; fix logs/tree).

### Pipeline

```text
data/patches/YYYY-MM-DD-slug.jsonl
  -> npm run data:rebuild
  -> npm run data:canonical:export
  -> npm run data:show -- --id activity:content:slug
  -> npx vitest run src/lib/dataContentPresentation.test.ts src/research/catalog.test.ts
```

Ship gate: `npm run audit:data`. Examples: `2026-08-05-thalmund-forge-aod-majors` … `2026-08-10-fishing-frenzy-kandarin-major`.

### UI traps (majors "missing" with data present)

Check **before** inventing entities. Full list: skill `references/gotchas.md`.

| Trap | Symptom | Fix / check |
|------|---------|-------------|
| Route 500 | Empty majors | `dynamic = "force-dynamic"` static string; no-store headers |
| SPA pin | Old list after rebuild | Hard reload; `regionStore` Map pins first fetch |
| `majorContentRows` | In JSON, not in table | Collapse under boss package parent |
| Ordinal 100 | Row at list end / wrong neighbor | Finish cascade park → shift → seat |
| CSS | Rows below fold look gone | Scroll Major unlocks panel; flex min-height chain |

Region APIs: `force-dynamic` + `Cache-Control: private, no-store`. Client fetch: `cache: "no-store"`.

Longer law: `docs/data-platform.md`. Keep **CLAUDE.md** pointer in sync when hard rules here change.
