# AGENTS.md — RS3 Equilibrium (Leagues II: Equilibrium companion)

Handoff brief for any coding agent (Claude, Kimi, opencode, etc). **Read this before writing code.**
`CLAUDE.md` imports this file (`@AGENTS.md`), so there is nothing to keep in sync — edit this file only.

Local: `C:\Users\Sonnaya\Rs3Equilibrium`
Remote: `https://github.com/sonnaya2/Equilibrium` — **public**, default branch `main` (there is no `master`)
Live: `https://equilibrium-ruddy.vercel.app` — Vercel project `equilibrium`, scope `ever-sense`
Vercel CLI: linked to `ever-sense/equilibrium` (`.vercel/`, gitignored); git-connected to `sonnaya2/Equilibrium`
Author: Sonnaya2
Not affiliated with or endorsed by Jagex. RuneScape is a trademark of Jagex Ltd.

**Deploys are automatic**: the Vercel project is git-connected, so any push to `main` ships to
production. Verify `npm run build`, `npm test`, and `npm run test:e2e` (Playwright; boots the dev server itself) locally before pushing — there is no staging gate.
The repo is public, so never commit secrets; git identity here is the noreply address
(`299354192+sonnaya2@users.noreply.github.com`), set repo-locally because GitHub blocks pushes that
would publish the private address.

---

## What this app is

A **Vercel-hosted webapp** (Next.js App Router + TypeScript + Tailwind) that is a companion tool for
**RuneScape 3's Leagues II: Equilibrium** (launches 10 Aug 2026). It combines:

1. **Build planner** — Region unlock paths, Relic tiers (7), Blessing tiers (8, Order/Chaos/Balance paths
   -> God Tier at 4/8), simulated before or during the league.
2. **Task tracker** — League Tasks (Easy..Master, 10-400 pts), League Points, tier thresholds, what
   unlocks next.
3. **Combat engine** — a from-scratch RS3 combat damage calculator/simulator reflecting the game as it
   exists **today** (post 2 Mar 2026 Combat Style Modernisation), with League Relic/Blessing modifiers
   layered on top as an isolated ruleset.

**No backend/DB.** All game data ships as static JSON bundled in the app; user progress/builds live in
`localStorage` only. No accounts, no server-side state, for v1.

**Not a clone** of rs-analysis.xyz, pvme.io, or leagues.build. Their math/mechanics/UX lessons inform this
tool; their HTML/CSS/React/copy/layout must never be copied. See "Visual sourcing rule" below.

---

## Stack (locked)

- Next.js (App Router) + TypeScript + Tailwind CSS
- Deploy target: Vercel
- No database. `localStorage` for user state. Static JSON for game data (regions/relics/blessings/tasks/combat).
- Combat calculation core has **zero React dependency** — pure TS functions, unit-testable in isolation.

---

## Design / visual rules

This must **not** look AI-generated. Before any UI work, load the `no-slop-ui` skill (law) and use
`ui-humanizer` / `text-humanizer` for surgery and copy. Run a `bot-audit` pass before considering any
screen shippable.

**Visual sourcing — four references, zero clones:**

| Reference | Steal the lesson | Never copy |
|---|---|---|
| RuneScape Wiki | density, dark-mode familiarity, tables, info hierarchy | HTML/CSS, prose |
| rs-analysis.xyz | serious technical-calculator feel, exposing many params without becoming unusable | their calculator UI/source |
| leagues.build | League-planner flow, fast tool switching, map -> build relationship | their nav, cards, layout, wording |
| RuneScape itself | color vocabulary, iconography, map presentation, League identity | — |

Do not trace layouts pixel-for-pixel, copy component code, or reproduce long guide text. Normalize facts
into our own compact copy (e.g. "Wild Magic — 2 hits, 25% adrenaline, 5.4s cooldown, +20% crit dmg, +10%
crit chance" — not the Wiki's paragraph).

**Top-level information architecture** (don't add more top-nav links than this without a reason):

```
EQUILIBRIUM     Overview  Map  Tasks  Build  Combat  Data
```

- `Build` contains: Regions, Relics, Blessings, Gear
- `Combat` contains: Quick, Build(details), Analysis, Rotation
- `Tasks` gets its own purpose-built interface

**Calculator modes** inside Combat:
- **Quick** (default) — style/level/weapon/ability/regions/relics/blessings in, expected/min/max/DPS out. Compact.
- **Build** — full settings: equipment, prayer, potion, perks, relics, blessings, target.
- **Analysis** — damage distribution, crit split, Damage Potential, ability-tick breakdown, modifier
  pipeline, equipment contribution, DPL, on-hit damage, proc contribution, expected value.
- **Rotation** — separate tab, tick-based ability timeline simulator (see Rotation engine below).

---

## Map route — 3D, and the project's main technical risk

The Map is **genuinely 3D**: a stylised 3D Gielinor with selectable regions that visibly lock/unlock as
the build changes. It is the app's signature surface and its single largest bundle and performance risk,
so it is fenced off from the rest of the app.

- **Stack**: `three` + `@react-three/fiber` (v9) + `@react-three/drei`. Next 13.1+ transpiles `three`
  natively — do **not** add `next-transpile-modules`.
- **Isolation is mandatory.** The `<Canvas>` and everything under it is a client component
  (`"use client"`), loaded from the Map route via `next/dynamic` with `ssr: false` behind a real
  skeleton. Nothing outside `app/map/` may import from the 3D bundle. If `three` shows up in the
  shared chunk, that's a bug — every other route must stay static and light.
- **Region geometry is data, not art.** Region shapes/positions live in `data/league/regions.json`
  alongside the rest of the region model, so the map and the Build planner read one source. The 3D
  layer renders that data; it must not hardcode a region list of its own.
- **The map is a view over build state, never its own store.** Selecting a region on the map and
  selecting it in Build > Regions mutate the same state and must stay in sync automatically.
- **Non-negotiable fallback.** Ship a 2D fallback for WebGL-unavailable, mobile-constrained, and
  `prefers-reduced-motion` users. Region planning must be fully completable without the 3D map ever
  loading — the 3D is the good version of the experience, not a dependency of it.
- **Budgets**: the 3D chunk stays lazy and out of first load; no gen-AI textures; no idle
  `requestAnimationFrame` burn when the scene is static (`frameloop="demand"` where it fits).
- Ship the 2D fallback first, then layer the 3D on top of the same data and state. That ordering means
  a stalled 3D effort never blocks the planner.

---

## Game context (Leagues II: Equilibrium, launches 10 Aug 2026)

- Fresh league character in dedicated league worlds; separate from main account; Account Nomination sends
  final rewards to a chosen account.
- **Region locking**: start in Misthalin + Havenhythe; first task milestone unlocks Karamja; further
  milestones unlock 3 more of: Asgarnia, Kandarin, Fremennik Province, Forinthry (Wilderness), Desert,
  Morytania, Tirannwn, Anachronia. Can't unlock every region — meaningful tradeoffs. Unlocked regions get
  a large slate of quests auto-completed.
- **Tasks**: Easy -> Master tiers, 10-400 League Points each. Points drive League Trophy tier and Relic
  unlocks.
- **Relics**: 7 tiers, return from Leagues: Catalyst, rebalanced to avoid clear best-in-slot picks. Each
  tier also grants enhanced passive bonuses (XP, drop rates, run energy, skillcape perks, free Invention
  materials, etc).
- **Blessings**: new, combat-only progression, 8 tiers, unlocked via Blessing Tasks in unlocked regions.
  3 paths per tier (Order/Chaos/Balance). Tier 4 and 8 grant a God Tier Blessing determined by path
  choices so far (2+ Chaos -> Chaos God; 2+ Order -> Order God; 2+ Balance, or one of each -> Balance
  God). Up to 3 resets available (1 from Tier 1, 2 more as you progress).
- **F2P access**: dedicated F2P league worlds, first 3 Relic tiers, all F2P regions.
- No player trading this league.

Treat this section as flavor/reference for the planner's data model — verify exact numbers (task point
values, specific relic/blessing effects, region unlock costs) against the RuneScape Wiki and official
reveal blog as they're published daily through launch; don't hardcode anything from the countdown post
as final.

---

## Combat engine — this is the hard part, read carefully

**We are building a *current* RS3 combat engine**, incorporating everything since the 4 Mar 2024 Core
Combat Update through the 2 Mar 2026 Combat Style Modernisation and all patches since. The 2024 RS
Analysis paper is foundational research, **not** the current spec — always verify against current
sources (see Sourcing below).

### Reference set

- **RS Analysis** (rs-analysis.xyz, `/magic`, `/melee`, `/ranged`, `/necromancy`, `/rotation_builder`,
  paper: `/pdf/2024.001.pdf`) — math/validation reference. Use for expected-value checking, crit/no-crit
  splits, modifier ordering, rotation timing concepts. Never clone their UI/source.
- **PvME** (pvme.io — perk info, ability info, Constitution abilities, upgrade order, DPM advice) — good
  for discovering mechanics/interactions, **not** automatically authoritative for current numbers (PvME
  itself warns much of its material predates the 2 Mar 2026 modernisation and is being rebuilt). Verify
  any PvME value against current Wiki/Jagex/RS Analysis before trusting it.
- **RuneScape Wiki** (runescape.wiki) — primary structured current-game source. Use current pages **and**
  update histories for every mechanic touched: abilities, weapons, armour, jewellery, pocket slots,
  prayers, potions, perks, crit mechanics, hit caps, accuracy, Damage Potential, DPL, special attacks,
  bleeds/burns/channels/stacks, adrenaline, cooldowns, style-specific mechanics — scanning forward from
  4 Mar 2024, not stopping at 2 Mar 2026.
- **leagues.build** — UX reference only for League-planner flow (region-first build planning, fast tool
  switching). Not a data or visual source.

### Required internal changelog reconstruction

Before implementing, build an internal technical combat changelog covering:
pre-Mar-2024 -> 4 Mar 2024 Core Combat Update -> 2024-2025 patches -> Combat Styles Improvement betas
(Dec 2025-Feb 2026) -> 2 Mar 2026 Combat Style Modernisation -> 9 Mar 2026 refinements -> 16 Mar 2026
refinements -> 30 Mar 2026 ability refinements -> all later patches to current date. Individual
abilities/items may have been patched after 2 Mar 2026 — don't assume that date is the final state.

### Core mechanics to implement (post-Mar-2024 model)

- **Damage Potential**: accuracy no longer produces a binary hit/miss (splash) against NPCs — it scales
  outgoing damage. 70% accuracy = 100% attack connects, scaled to 70% Damage Potential. UI must label
  this as Damage Potential, not just "hit chance".
- **Critical strikes**: distinguish Critical Strike Chance vs Critical Strike Damage vs guaranteed crits
  vs modifiers to each vs crit-eligible/ineligible damage vs individual hits within multi-hit abilities.
  Never model crit as a flat `damage * 1.5`. Base Critical Strike Damage progression reaches 50% at level
  90 (post-Mar-2024); later mechanics modify further — model these as separate layers.
- **Hit caps**: standard cap is 30,000, but represent it as per-effect metadata/rules, not one hardcoded
  global — some effects alter/bypass/split it.
- **Combat levels to 120**: Attack/Strength/Ranged/Magic/Necromancy all 1-120. No UI sliders capped at
  99. Support temporary boosts above 120 where mechanically valid.
- **Damage Per Level (2026 curve)** — replaced the old linear `2.5 x level`:
  ```
  DPL(level) = 145 * 2.5 * ln(1 + 0.6 * level / 145) / ln(1.6)
  ```
  Implement as a pure, tested function (not a lookup table unless generated from this exact formula).
  Regression-test at levels 1, 20, 50, 80, 90, 99, 110, 120, 130+, 145. Optionally expose "Combat Level
  Contribution" in the UI.
- **Ability categories**: current model is broadly Basic / Enhanced / Ultimate / Utility (Basic/Threshold/
  Ultimate is obsolete for the three original styles; Constitution/Defence may retain threshold
  semantics). Don't assume a pre-2026 "threshold" ability still needs 50% adrenaline / costs 15% / behaves
  like its historical version.
- **Adrenaline**: ordinary Basics generally generate 9% (not the old 8%) — represent as per-ability data,
  not a magic global constant.
- **Weapon speed**: modernisation standardized fundamental attack timing to ~3 ticks across styles. Do
  not resurrect fast/average/slow weapon-speed assumptions for modern calculations (attack-speed metadata
  may be retained for historical/debug purposes only).
- **Equipment damage rebalance (9 Mar 2026)**: realigned bonuses to tier across armour/rings/amulets/
  pocket items/Necromancy/hybrid gear — some items lost bonus, others gained. Never use a static 2024/2025
  gear spreadsheet; pull current values from the Wiki and store `source`/`last verified` per item.

### Style identities (not palette-swapped clones of each other)

- **Melee** — burst + bleeds + Bloodlust. Model Bloodlust as *state* (generation/consumption/cap,
  typically 4 outside modifiers, Berserk can alter capacity), not a flat multiplier. Also: empowered
  abilities, Berserk interactions, on-next-attack/on-kill effects, dual-wield vs 2H restrictions.
- **Ranged** — on-hit effects + hit frequency + ammo/weapon interactions (Searing Winds, Galeshot, Imbue:
  Shadows, ammo effects, proc frequency, Greater Ricochet, multi-hit, Split Soul-type effects,
  weapon-specific procs, per-hit adrenaline where relevant). Not just `ability damage x Death's Swiftness`.
- **Magic** — critical strikes + burns. Model Runic Charge, empowered-ability interactions, crit
  chance/damage, burns, channels, Greater Concentrated Blast, Greater Sonic Wave, Sunshine, Smoke Cloud,
  Magma Tempest, Blast Infused, Channelled Might. Some abilities (Wild Magic, Asphyxiate) changed again
  after 2 Mar 2026 — always use current revision.
- **Necromancy** — was already close to the modern template; model Necrosis, Residual Souls, conjures,
  Skeleton Rage, Vengeful Ghost, Putrid Zombie, Phantom/Valour state, Death Spark, Death Skulls, Living
  Death, Split Soul, Bloat, Spectral Scythe stages, soul-consuming abilities. Don't force it into a
  Magic/Melee abstraction where it doesn't fit — shared infrastructure good, shared fake mechanics bad.

### Architecture (target layout under a future `src/combat/`)

```
combat/
  core/        abilityDamage.ts damagePotential.ts damagePerLevel.ts hitCaps.ts critical.ts rounding.ts ticks.ts
  pipeline/    calculateHit.ts calculateAbility.ts modifierPipeline.ts
  styles/      melee/{bloodlust,abilities,effects}.ts
               ranged/{onHit,abilities,ammo,effects}.ts
               magic/{runicCharge,burn,abilities,effects}.ts
               necromancy/{souls,necrosis,conjures,abilities,effects}.ts
  shared/      prayers.ts potions.ts perks.ts vulnerability.ts poison.ts slayer.ts equipment.ts
  rotation/    timeline.ts state.ts actions.ts simulate.ts
  league/      ruleset.ts        (Equilibrium modifiers, layered on — never merged into core)
  target/      genericTarget.ts  (generic target only; no boss-specific anything)
  data/        typed accessor over the root `data/` store — NOT a second copy of the JSON
```

Root `data/combat/*.json` and `data/league/*.json` are the single canonical stores, written by the sync
scripts. `src/combat/data/` only reads and types them. Never materialize a parallel copy under
`src/combat/` — one store, one source of truth.

Core calc code has **zero React dependency**.

**Modifier pipeline**: explicit, ordered, deterministic, tested — never one cursed combined formula.

```ts
interface CombatModifier {
  id: string
  stage: "base" | "ability" | "onCast" | "roll" | "critical" | "onHit" | "target" | "postHit"
  priority: number
  applies(context: CombatContext): boolean
  apply(state: DamageState): DamageState
  source: SourceReference
}
```

**Rounding**: preserve intermediate floor/modifier/floor/modifier/floor chains exactly. Never collapse
`floor(A) -> mod -> floor(B) -> mod -> floor(C)` into `floor(A*B*C)` — RS's intermediate rounding matters
and "close enough" produces wrong numbers. Where undocumented, derive/test against RS Analysis output.

**Rotation engine**: tick-based ability timeline (inspired by rs-analysis.xyz/rotation_builder — own UI/
impl, not cloned). Not a boss simulator. Useful because League Relics/Blessings can affect cooldowns,
adrenaline, hit count, crit, damage, timing, stacks, resource gen. Compute cumulative/average damage,
damage/tick, DPS, adrenaline, crit contribution, proc contribution, source breakdown. Save/load rotations
in localStorage. Lives as its own tab inside Combat, not bolted onto the main calculator.

**Generic target only — no boss-specific anything.** No boss guides, phase sims, drop calculators,
kill-time calculators, enrage math, or boss-specific strategies. Generic target settings suffice: Defence,
accuracy-relevant values, Damage Potential override, target size, target HP%, vulnerability, poisonable,
Slayer category, undead/dragon/demon flags. Elsewhere in the planner, bosses only appear as
"available in region" / "notable unlocks" / task associations.

**Perks**: use PvME to identify relevant Invention perks (Precise, Equilibrium, Aftershock, Crackling,
Biting, Impatient, style-specific combos), validate current behaviour against Wiki/RS Analysis. Provide
presets (None/Entry/Good/High-end/Custom) rather than recreating the full perk calculator; allow exact
rank config under Custom.

**League overrides are isolated from base combat — never baked into the core formulas.**

```ts
calculateCombat(baseState, { ruleset: "equilibrium", relics, blessings, regions })
```

This lets base RS3 math be validated independently of League craziness, toggled off for comparison, and
kept safe as future leagues/temporary modes are added. Relics/Blessings plug into the same
modifier/state architecture as everything else.

### Data ingestion & provenance

Extend the data pipeline with `scripts/sync-league-data.ts` and `scripts/sync-combat-data.ts`, primarily
scraping the RuneScape Wiki for `data/combat/{abilities,equipment,prayers,perks,effects,update-index}.json`.
Every record carries:

```ts
interface SourceReference {
  source: "runescape-wiki" | "jagex" | "rs-analysis" | "pvme" | "derived"
  url: string
  title?: string
  revision?: string
  publishedAt?: string
  verifiedAt: string
}
```

Derived values get `source: "derived"` + `derivedFrom: [...]`. Scope the update scanner to entities we
actually use, tracked since 2024-03-04 — not indiscriminate wiki scraping. When a tracked entity has a
newer Wiki revision than our stored data, surface it clearly ("combat dataset changed") rather than
silently serving stale numbers; report format e.g.:

```
COMBAT SYNC
Abilities checked: 74   Items checked: 183   Changed since dataset: 4   New entities: 2   Warnings: 1
```

**Source disagreement policy** (when sources conflict, don't guess — record it): prefer official Jagex >
current Wiki (with update history) > current RS Analysis behaviour/research > current verified PvME >
other community sources, but use judgment — RS Analysis's experimentally-derived mechanics can be more
precise than a simplified official tooltip. Store both `displayDescription` and `mechanicalImplementation`
when they diverge. Tooltip text is not the formula — never implement the engine by regexing ability
tooltips; ingestion supplies candidate data, the calc engine holds verified mechanical rules, kept separate.

**No plagiarism**: never copy full Wiki/PvME/RS Analysis descriptions into the app — normalize to facts
("Wild Magic — 2 hits, 25% adrenaline, 5.4s cooldown, +20% crit dmg, +10% crit chance"), write our own copy.

### Validation

Treat RS Analysis as an external reference implementation (never copy its internals). Build fixture
configs comparable against current engine output, per style: basic attack, basic ability, enhanced
ability, ultimate, multi-hit, DoT, crit-heavy ability, style-state ability — compare min/max/mean
noncrit and crit plus expected mean. Investigate any substantial disagreement; don't cherry-pick the
nicer-looking number.

### Attribution (required, real, not hidden in source)

Add a `Sources & Credits` page crediting: RuneScape Wiki (runescape.wiki), RS Analysis
(rs-analysis.xyz — including the "Quantitative Analysis of RuneScape 3 Combat" paper authors when its
concepts/results are referenced), PvM Encyclopedia / PvME (pvme.io), leagues.build (UX inspiration only),
and Jagex (official game/League info; fan tool disclaimer, not affiliated/endorsed, RuneScape is a
trademark of Jagex Ltd). Respect the RuneScape Wiki's attribution/licensing terms for Wiki-derived
material. For specific technical numbers, an in-UI "ⓘ Source" affordance should trace back to its
provenance (e.g. "Damage Per Level — changed 2 Mar 2026 — RuneScape Wiki, Jagex Combat Style
Modernisation") — not on every checkbox, but discoverable when someone's debugging a discrepancy.

### Freshness indicator

Combat > Data tab shows something like:

```
COMBAT DATA
Game model   Current        Last synced   24 Jul 2026
Abilities    74              Equipment    183           Perks   9
Sources: RuneScape Wiki, RS Analysis, PvME, Jagex
```

with a stale-data warning when tracked entities have changed since last sync.

### Definition of "combat-complete"

1. Damage Potential implemented. 2. Current crit system implemented. 3. Hit-cap behaviour represented as
metadata. 4. 2026 logarithmic DPL implemented + regression-tested. 5. Levels through 120+ work. 6. Current
equipment bonuses (post 9 Mar 2026) used. 7. Basic/Enhanced/Ultimate/Utility categories current. 8. 9%
basic adrenaline represented as data. 9. Melee Bloodlust works as state. 10. Ranged on-hit state works.
11. Magic crit/burn state works. 12. Necromancy resources work. 13. Important generic perks work. 14.
League modifiers isolated from base combat. 15. Ability data checked against post-Mar-2026 patches. 16.
Representative results validated against RS Analysis. 17. Source provenance exists. 18. No boss-specific
simulator snuck in. 19. Quick mode stays compact despite all of this. 20. Analysis mode has the nerd
detail when the user opens that tab.

---

## Hard invariants (never break)

- **No boss-specific calculators, guides, or phase sims** — generic target settings only.
- **No cloning** of rs-analysis.xyz / pvme.io / leagues.build UI, code, or copy — facts and math only,
  our own components and words.
- **No stale/fake combat data presented as current** — every combat number carries a `SourceReference`;
  old PvME/pre-2026 values are never used just because a source once said so.
- **Combat core has zero React dependency** and is unit-testable standalone.
- **League ruleset is layered on top of base combat, never merged into it.**
- **No backend/DB in v1** — localStorage + static JSON only.
- Real attribution page — never hide credits in source only.

## What not to do

- Don't build boss-specific damage calculators, enrage math, or kill-time tools.
- Don't hardcode gear/ability numbers from a 2024/2025 spreadsheet or from memory — pull from current
  Wiki data with provenance.
- Don't treat 2 Mar 2026 as the final combat patch — check for later refinements per ability/item.
- Don't collapse chained floor/modifier rounding into a single combined multiply.
- Don't add top-level nav items beyond Overview/Map/Tasks/Build/Combat/Data without a real reason.
- Don't hardcode League countdown-post numbers (task points, exact relic effects) as final — verify
  against the Wiki/official reveal blog as they're published through launch.

## Code style for agents

- Pure vibecoding: density over review niceties, no enterprise patterns, no premature abstraction.
- Minimal targeted diffs; no drive-by refactors.
- Lean-code policy is `rs3-ponytail`, layered on the installed ponytail plugin. Do not restate ponytail's ladder in project files.
- No comments explaining *what* code does; only non-obvious *why* (rounding order quirks, formula
  provenance, a specific Wiki-verified quirk).
