# UI copy audit — RS3 Equilibrium

**Phase:** inventory + proposals only (no production edits)  
**Date:** 2026-07-26  
**Product:** RS3 Equilibrium · Hybrid Composite 9.2 · game-world surface + tool workbench  
**Repo:** `C:\Users\Sonnaya\Rs3Equilibrium`

---

## 1. Summary

| Metric | Count (approx.) |
|--------|----------------:|
| Production UI chrome strings inventoried | ~520 |
| High-priority rows with explicit proposals below | 118 |
| Pattern-ruled bulk strings (research empties, table headers, slot names) | ~400 |
| `zero_ok` (delete or keep empty) proposals | 34 |
| `one_sentence` rewrites | 51 |
| `frozen_keep` | 22 skill-frozen + ~40 e2e-hard combat/tasks pins |
| Dedup clusters | 12 |
| Problem board items | 18 |

| Route | Strings (est.) | Worst issue |
|-------|---------------:|-------------|
| chrome | 35 | footer vs meta disclaimer overlap |
| overview `/` | 55 | triple pick counters + poetic fluff |
| map | 70 | long PageHeading note |
| tasks | 50 | region display-name conflict vs map |
| build | 60 | multi-sentence empty helpers |
| combat | 140 | multi-sentence gear/revo helpers; e2e-hard pins |
| data | 180 | long research intros / tab descriptions |
| sources | 12 | multi-sentence credit notes (acceptable legal density) |

**bot-audit (current corpus):** SUSPICIOUS overall — no rainbow/SaaS BUSTED chrome; language TELLs (verbose helpers, repeated labels, occasional Title Case section heads).  
**bot-audit (on proposals):** PASSES with residual SMELLs only if apply phase follows zero/one-sentence gates.

---

## 2. Problem board

| ID | Flag | Severity | Location | Issue | Proposed direction |
|----|------|----------|----------|-------|--------------------|
| P01 | CONFLICT | high | Map vs Tasks region labels | Map ledger uses **Wilderness / Kharidian Desert / Fremennik Province** (`regionAnchors`). Tasks rail uses **Forinthry / Desert / Fremennik** (`tasks/regionMap.ts` REGION_DISPLAY). Same electives, different names. | Canonical = map/league display names; retarget Tasks display map in apply phase. Flag only here. |
| P02 | REDUNDANT | high | OverviewCourtyard | Pick count appears in: Nav meta, east jamb “Picks”, plan ledger “Region picks”, “Next on the board” checklist. Same fact four times. | Keep Nav + one desk fact; zero the rest or desk only. |
| P03 | REDUNDANT | med | OverviewCourtyard | “Blessings / Unrevealed” milestone + ledger “Empty until official reveal” + checklist “Blessings locked empty” + structure row. | One line total: `Blessings · unrevealed`. |
| P04 | VERBOSE | med | `app/map/page.tsx` PageHeading note | Four facts in one note (fixed starts, milestone, electives, shared picks). | One sentence or drop note (board/ledger already teach). |
| P05 | VERBOSE | med | GearPanel / Setup / Stats helpers | Multi-sentence explainers restating that weapon tier drives damage. | One short sentence or `""` next to controls. |
| P06 | VERBOSE | med | RevolutionPanel | Two long paragraphs on revo behavior. | One sentence + link label if needed. |
| P07 | VERBOSE | med | Data `*Research` intros + tab descriptions | Most are 2 sentences; many restate the tab title. | Tab noun only + empty `description` when list is self-explanatory; else ≤1 sentence. |
| P08 | FROZEN | high | e2e + equilibrium-ui | Brand, nav, footer trademark, `Clear picks`, `0/3`/`3/3`, `no WebGPU`, region button name prefix. | `frozen_keep` unless apply pairs e2e. |
| P09 | FROZEN-ish | med | combat.spec / tasks.spec | Many non-skill strings still hard-pinned (tab names, `Run`, `Damage Potential`, `My build`, filter labels). | Treat as **e2e-hard**: rewrite only with test update. |
| P10 | DATA_MISMATCH | low | Map page note vs structure | Note says “Same picks on Map, Build, and Combat” — Combat uses regions for gear filter, not full elective UX. Technically true for shared `useBuild` but easy to misread. | Soften to `Same region picks as Build.` or drop. |
| P11 | MARKETING / SMELL | low | Overview aperture | `Fort gate · living world` — decorative caption, zero info. | `proposed: ""` |
| P12 | REDUNDANT | med | Meta descriptions | layout vs overview page meta nearly identical; map/tasks/build each add SEO paragraphs. | One product meta in layout; route metas one short clause or omit. |
| P13 | CONFLICT | low | confidence label sets | ResearchBrowser vs ResearchSection use different confidence wordings (`Unresolved` vs `Still unresolved`, `League precedent` vs `Working region map`). | Unify on ResearchBrowser set or shared mapper. |
| P14 | WRONG_TERM | low | Tasks tier chips | Lowercase `easy`/`medium`… as chips; elsewhere Tier display is title-ish. | Sentence case `Easy` or keep data-case with CSS capitalize — pick one. |
| P15 | ACCESSIBILITY | low | Map board | Flat board / 3D chips `aria-hidden`; ledger owns a11y (correct per skill). No change. | Keep; note not a defect. |
| P16 | ERROR | none found | — | No broken “undefined” / empty button labels found in static chrome. | — |
| P17 | REDUNDANT | med | Build vs Map | Both teach “2 start + Karamja · 3 electives” / “Elective — pick 3 of 8”. | Map ledger keeps elective line; Build can drop helper if grid shows availability. |
| P18 | VERBOSE | med | Sources credits | Multi-sentence legal/attribution (Wiki, RS Analysis). | Allowed exception: legal credits may exceed one sentence; keep substance, trim adjectives only. |

---

## 3. Dedup clusters

| Cluster | Canonical (keep) | Drop / zero / alias |
|---------|------------------|---------------------|
| D01 Brand | `EQUILIBRIUM` (nav) | Do not add second brand title on every route; gold `PageHeading` is route name only |
| D02 Nav labels | Overview Map Tasks Build Combat Data | Footer “Concepts lab” stays lab-only |
| D03 Pick counter | `n/3` in Nav (global) + Map ledger counter (route) | Overview jamb/ledger/checklist duplicates → zero extras |
| D04 Clear electives | `Clear picks` (frozen) | All instances must stay identical wording |
| D05 Unrevealed blessings | `Unrevealed` | Drop “Empty until official reveal” / “Blessings locked empty” siblings |
| D06 Empty search | `Nothing matches that search.` OR `No matches.` | Pick **one** app-wide: prefer `No matches.` |
| D07 Ironman policy | `Ironman / self-sufficient only.` | Overview “Trading · Off · ironman / self-sufficient” + Data footer — keep one desk line + Data note short |
| D08 Region structure | `2 start + Karamja + 3 electives` | Single wording (avoid “2 start + Karamja · 3 electives” vs long Map note) |
| D09 Damage tier disclaimer | `Weapon tier drives base AD until item bonuses are sourced.` | Setup, Stats, GearPanel helpers collapse to this one line or `""` |
| D10 Sources footer | Trademark sentence in layout footer | Jagex credit on Sources may restate affiliation once; don’t triple |
| D11 Confidence | Shared mapper (see P13) | Delete parallel maps in ResearchSection |
| D12 Region names | Map `regionAnchors` display names | Tasks `REGION_DISPLAY` short names → align (P01) |

---

## 4. Skill pass log

| Skill | Agent | Scope | Artifact |
|-------|-------|-------|----------|
| **human-grade** | A0 | Product detect RS3 Equilibrium; class game-world + tool workbench; pipeline bot-audit → law → surgery proposals | This document §1–6 |
| **equilibrium-ui** | A0/A2 | Frozen contracts; Hybrid DNA; sanctioned exceptions (frosted cells, path triad, courtyard, Board Sky) kept | §2 P08–P09; frozen rows below |
| **bot-audit** (before) | A4 | Language + structure on production chrome | §1 verdict SUSPICIOUS; §2 TELLs |
| **no-slop-ui** | A9 | §3 copy bans + §8 copy-relevant checklist | §5 checklist |
| **data-readability** | A7 | Tasks/Data/Combat/Build density of labels | §5 density notes |
| **ui-humanizer** | A6 | Orders 4/6/9 as proposals (de-hero copy, copy pass, chrome dedupe) | §2 P02–P03, §3 clusters |
| **text-humanizer** | A5 | Every priority row `proposed` | §6 route ledgers |
| **bot-audit** (after) | A10 | Proposals re-scored | §1 PASSES if applied |

Sanctioned exceptions **not** treated as slop: dark stone, gem chrome, frosted unrevealed, path colors as data, courtyard keyart aperture, timber/top-light materials.

---

## 5. no-slop §8 + data-readability (copy-only)

### no-slop copy checklist

| Check | Result |
|-------|--------|
| Banned marketing words in production chrome | Clean (hits only in `concepts/` lab relic blurbs — Tier C) |
| Contrast tic / reimagined / say goodbye | Clean |
| Title Case chrome | Partial TELL — panel heads like `Plan ledger`, `Standing picks` |
| Empty states one sentence + action | Mostly good; some multi-line research empties OK |
| Badge spam wording | `Provisional · Catalyst` once on Tasks — OK |
| Exclamation / emoji | Clean |

### data-readability

| Surface | Finding |
|---------|---------|
| Tasks table | Headers `Task Tier Comp% Pts` good; dense OK |
| Map ledger | Title + counter + pips slightly triple; pips need aria only |
| Combat results | Key figures present; helpers too long beside them |
| Data twin desk | Tab description under every tab costs vertical scan — prefer zero |

---

## 6. Route ledgers (priority proposals)

Rules: `proposed` = `""` if control is obvious, else ≤1 short sentence.  
`length_rule`: `zero_ok` | `one_sentence` | `frozen_keep`.

### 6.1 Chrome

| id | location | kind | current | proposed | length_rule | bot | flags | notes |
|----|----------|------|---------|----------|-------------|-----|-------|-------|
| chrome.brand | Nav.tsx | button | EQUILIBRIUM | EQUILIBRIUM | frozen_keep | clean | FROZEN | |
| chrome.nav.overview…data | Nav.tsx | tab | Overview…Data | keep | frozen_keep | clean | FROZEN | |
| chrome.nav.aria | Nav.tsx | aria | Primary | Primary | frozen_keep | clean | | short noun OK |
| chrome.nav.picks | Nav.tsx | status | picks n/3 | picks n/3 | frozen_keep | clean | | global counter canonical |
| chrome.skip | layout | button | Skip to main content | Skip to main content | frozen_keep | clean | | a11y |
| chrome.footer.legal | layout | helper | Fan tool. Not affiliated… Jagex Ltd. | keep (contains frozen substring) | frozen_keep | clean | FROZEN | |
| chrome.footer.concepts | layout | button | Concepts lab | Concepts lab | one_sentence | clean | | lab entry |
| chrome.footer.hybrid | layout | button | Hybrid · Composite | Hybrid | zero_ok | SMELL | REDUNDANT | optional shorten |
| chrome.footer.sources | layout | button | Sources & credits | Sources | one_sentence | clean | | |
| chrome.meta.default | layout | helper | Planner and combat calculator… | Planner for RS3 Leagues II: Equilibrium. | one_sentence | TELL | VERBOSE | |
| chrome.meta.overview | page.tsx | helper | Planner, task tracker, and combat… | "" (inherit layout) | zero_ok | TELL | REDUNDANT | |
| chrome.error.head | error.tsx | heading | Something went wrong | Page error | one_sentence | TELL | | |
| chrome.error.body | error.tsx | error | This page hit an error. Try again, or open Overview or Map. | Try again, or open Overview or Map. | one_sentence | clean | | |
| chrome.error.retry | error.tsx | button | Try again | Try again | frozen_keep | clean | | |
| chrome.404.head | not-found | heading | Page not found | Page not found | frozen_keep | clean | | |
| chrome.404.body | not-found | error | No route matches this URL. Open a working surface: | No page here. | one_sentence | TELL | VERBOSE | |
| chrome.share.title | ShareImport | heading | Shared build | Shared build | one_sentence | clean | | |
| chrome.share.body | ShareImport | helper | This link carries a build that differs… | Link differs from the build saved here. | one_sentence | TELL | VERBOSE | |
| chrome.share.import | ShareImport | button | Import shared build | Import | one_sentence | clean | | |
| chrome.share.keep | ShareImport | button | Keep mine | Keep mine | one_sentence | clean | | |

### 6.2 Overview `/`

| id | location | kind | current | proposed | length_rule | bot | flags | notes |
|----|----------|------|---------|----------|-------------|-----|-------|-------|
| ov.lintel | OverviewCourtyard | heading | Courtyard plan | Plan | one_sentence | TELL | | or keep flavor |
| ov.meta | OverviewCourtyard | helper | Leagues II · Equilibrium | "" | zero_ok | SMELL | REDUNDANT | brand already in nav |
| ov.standing | OverviewCourtyard | label | Standing picks | Picks | one_sentence | TELL | | |
| ov.slot | OverviewCourtyard | empty | Slot n | Slot n | one_sentence | clean | | |
| ov.caption | OverviewCourtyard | helper | Fort gate · living world | "" | zero_ok | SMELL | MARKETING | P11 |
| ov.milestones | OverviewCourtyard | label | Milestones | "" | zero_ok | SMELL | REDUNDANT | keys already labeled |
| ov.ms.picks | OverviewCourtyard | label+status | Picks n/3 | "" | zero_ok | TELL | REDUNDANT | D03 — Nav owns |
| ov.ms.tasks | OverviewCourtyard | label | Tasks | Tasks | one_sentence | clean | | keep one metric |
| ov.ms.catalog | OverviewCourtyard | label | Catalog | Catalog | one_sentence | clean | | |
| ov.ms.t1 | OverviewCourtyard | label | T1 Relic | T1 | one_sentence | clean | | |
| ov.ms.bless | OverviewCourtyard | status | Unrevealed | Unrevealed | one_sentence | clean | | D05 canonical |
| ov.ledger.head | OverviewCourtyard | heading | Plan ledger | "" | zero_ok | TELL | REDUNDANT | panel optional |
| ov.ledger.picks.empty | OverviewCourtyard | empty | · none chosen — open Map or Build | none — Map or Build | one_sentence | clean | | |
| ov.ledger.relic.empty | OverviewCourtyard | empty | Court open — seat on Build → Relics | Seat T1 on Build | one_sentence | TELL | VERBOSE | |
| ov.ledger.bless | OverviewCourtyard | status | Empty until official reveal | Unrevealed | one_sentence | TELL | REDUNDANT | D05 |
| ov.ledger.note | OverviewCourtyard | helper | Blank means unrevealed. No invented league numbers. | No invented league numbers. | one_sentence | clean | | |
| ov.next.head | OverviewCourtyard | heading | Next on the board | Next | one_sentence | SMELL | | |
| ov.next.cta.incomplete | OverviewCourtyard | helper | Finish three region picks on Map or Build. | Pick three regions on Map or Build. | one_sentence | clean | | |
| ov.next.cta.full | OverviewCourtyard | helper | Region cap filled. Seat a T1 relic or open Combat. | Seat T1 on Build, or open Combat. | one_sentence | clean | | was 2 sentences |
| ov.next.bless | OverviewCourtyard | status | Blessings locked empty | "" | zero_ok | TELL | REDUNDANT | D05 |
| ov.next.combat | OverviewCourtyard | status | Combat DPL unbound until setup | Combat unbound until Setup | one_sentence | clean | | |
| ov.struct.head | OverviewCourtyard | heading | League structure | Structure | one_sentence | clean | | |
| ov.struct.regions | OverviewCourtyard | helper | 2 start + Karamja + 3 electives | 2 start + Karamja + 3 electives | one_sentence | clean | | D08 canonical |
| ov.struct.relics | OverviewCourtyard | helper | 7 tiers · one pick when revealed | 7 tiers · one pick when revealed | one_sentence | clean | | |
| ov.struct.bless | OverviewCourtyard | helper | 8 tiers · Order / Chaos / Balance · God Tier 4 & 8 | 8 tiers · Order / Chaos / Balance · God 4 & 8 | one_sentence | clean | | |
| ov.struct.trade | OverviewCourtyard | helper | Off · ironman / self-sufficient | Ironman only | one_sentence | clean | | D07 |

### 6.3 Map

| id | location | kind | current | proposed | length_rule | bot | flags | notes |
|----|----------|------|---------|----------|-------------|-----|-------|-------|
| map.title | map/page | heading | Region map | Map | one_sentence | SMELL | REDUNDANT | nav says Map |
| map.note | map/page | helper | Misthalin and Havenhythe fixed. Karamja at the first milestone. Three picks from the other eight. Same picks on Map, Build, and Combat. | Three electives · same picks as Build. | one_sentence | TELL | VERBOSE,P04,P10 | |
| map.meta | map/page | helper | Three elective region picks… | "" | zero_ok | TELL | VERBOSE | |
| map.ledger.title | RegionLedger | heading | Region ledger | Regions | one_sentence | SMELL | | |
| map.ledger.elective | RegionLedger | label | Elective — pick 3 of 8 | Elective · 3 of 8 | one_sentence | clean | | |
| map.ledger.clear | RegionLedger | button | Clear picks | Clear picks | frozen_keep | clean | FROZEN | |
| map.ledger.counter | RegionLedger | status | n/3 | n/3 | frozen_keep | clean | FROZEN | |
| map.pips.aria | RegionLedger | aria | n of 3 elective picks used | n of 3 elective picks used | one_sentence | clean | | keep for a11y |
| map.nowebgpu | MapScene | fallback | This browser has no WebGPU, so the 3D table stays off. The board below is the full planner - every region choice works here. | no WebGPU — flat board still plans all regions. | one_sentence | TELL | FROZEN | must keep substring `no WebGPU` |
| map.narrow | MapScene | fallback | Narrow layout uses the flat board… | Flat board on narrow layout. | one_sentence | TELL | VERBOSE | |
| map.insp.empty | RegionInspector | empty | Nothing mapped here yet. | Nothing mapped. | one_sentence | clean | | |
| map.insp.tabs | RegionInspector | tab | Bosses, Skilling, … | keep nouns | one_sentence | clean | | |
| map.insp.confirmed | RegionInspector | button | confirmed only | Confirmed only | one_sentence | TELL | | sentence case |
| map.insp.find | RegionInspector | placeholder | Find | Find | zero_ok | clean | | |
| map.insp.unlock.elective | RegionInspector | helper | Elective pick — 3 of 8 | Elective · 3 of 8 | one_sentence | clean | | align D08 |

### 6.4 Tasks

| id | location | kind | current | proposed | length_rule | bot | flags | notes |
|----|----------|------|---------|----------|-------------|-----|-------|-------|
| tasks.badge | tasks/page | status | Provisional · Catalyst | Provisional · Catalyst | one_sentence | clean | e2e-hard | |
| tasks.loaded | tasks/page | status | n tasks loaded | n tasks loaded | frozen_keep | clean | e2e-hard | |
| tasks.points | tasks/page | label | Points | Points | frozen_keep | clean | e2e-hard | |
| tasks.empty | tasks/page | empty | No tasks loaded yet. | No tasks loaded. | one_sentence | clean | | |
| tasks.fail | tasks/page | error | Catalyst list failed: … | Catalyst list failed: … | one_sentence | clean | | keep error detail |
| tasks.filter.aria | TaskRecords | aria | Filter by region | Filter by region | frozen_keep | clean | e2e-hard | |
| tasks.mybuild | TaskRecords | chip | My build | My build | frozen_keep | clean | e2e-hard | |
| tasks.empty.filter | TaskRecords | empty | No tasks match. | No tasks match. | one_sentence | clean | | good already |
| tasks.wiki | TaskRecords | link | Open on Wiki | Wiki | one_sentence | clean | | Comp% link name e2e-hard |
| tasks.region.names | regionMap.ts | label | Forinthry / Desert / Fremennik | Wilderness / Kharidian Desert / Fremennik Province | one_sentence | TELL | CONFLICT P01 | apply phase |

### 6.5 Build

| id | location | kind | current | proposed | length_rule | bot | flags | notes |
|----|----------|------|---------|----------|-------------|-----|-------|-------|
| build.h1 | BuildPlanner | heading | Leagues II: Equilibrium | Build | one_sentence | SMELL | REDUNDANT | or keep league flavor once |
| build.tabs | BuildPlanner | tab | Regions Relics Blessings Share | keep | one_sentence | clean | | |
| build.clear | BuildPlanner | button | Clear picks | Clear picks | frozen_keep | clean | FROZEN | |
| build.regions.helper | BuildPlanner | helper | 2 start + Karamja · 3 electives | "" | zero_ok | SMELL | REDUNDANT | D08/D17 grid shows it |
| build.relic.empty | BuildPlanner | empty | Tier sealed until Jagex reveals choices. | Sealed until reveal. | one_sentence | clean | | |
| build.relic.detail | BuildPlanner | helper | Pick one Tier n choice on the left. Higher tiers stay sealed until official reveal. | Pick one Tier n choice. | one_sentence | TELL | VERBOSE | |
| build.bless.helper | BuildPlanner | helper | Order · Chaos · Balance · God Tier at 4 & 8 | Order · Chaos · Balance · God 4 & 8 | one_sentence | clean | | |
| build.bless.empty | BuildPlanner | empty | Blessing choices empty until Jagex publishes… | Paths plan now; choices unrevealed. | one_sentence | TELL | VERBOSE | |
| build.share.helper | BuildPlanner | helper | Copy a link that restores regions, relics, and blessing path on another device. | Copies regions, relics, and blessing path. | one_sentence | clean | | |
| build.share.copy | BuildPlanner | button | Copy link | Copy link | one_sentence | clean | | |
| build.reset | BuildPlanner | button | Reset build | Reset build | one_sentence | clean | | |
| build.credit | BuildPlanner | credit | Layout modelled on the official… | "" or one credit line in Sources | zero_ok | SMELL | REDUNDANT | |

### 6.6 Combat (patterns + worst offenders)

e2e-hard: tab names Quick/Setup/Rotation/Analysis, `Run`, `Run revolution`, `Damage Potential`, `Auto-weave basics`, `Use Setup loadout`, `manual`, gear slot labels, etc. — **keep wording** unless tests updated.

| id | location | kind | current | proposed | length_rule | bot | flags | notes |
|----|----------|------|---------|----------|-------------|-----|-------|-------|
| combat.page.note | combat/page | helper | Post-March 2026 kit · live math on Quick | Live math on Quick · post-March 2026 kit | one_sentence | clean | | OK as-is optional |
| combat.quick.sub | QuickCalculator | helper | facet desk · live math | "" | zero_ok | SMELL | REDUNDANT | |
| combat.quick.empty | QuickCalculator | empty | Select an ability. | Select an ability. | one_sentence | clean | | good |
| combat.quick.nodmg | QuickCalculator | empty | No damage hits — summons and buffs do not produce an expected damage figure here. | No damage hits on summons/buffs. | one_sentence | TELL | VERBOSE | |
| combat.setup.helper | SetupTab | helper | Shared with Rotation and Analysis. Item bonuses empty until sourced — weapon tier still drives damage. | Shared loadout. Weapon tier drives damage until bonuses are sourced. | one_sentence | TELL | VERBOSE | was 2 sentences |
| combat.stats.helper | StatsPanel | helper | Item bonuses empty until sourced — weapon tier still drives damage. | "" | zero_ok | TELL | REDUNDANT | D09 |
| combat.gear.helper | GearPanel | helper | Wearables require a slot. Style filter defaults… (long) | Wearables need a slot; tier drives base AD. | one_sentence | TELL | VERBOSE P05 | |
| combat.gear.empty* | GearPanel | empty | No wearables for… (long variants) | No wearables for this slot/filter. | one_sentence | TELL | VERBOSE | unify 4 variants |
| combat.buffs.helper | BuffsPanel | helper | Player-controlled, wiki-sourced only. Overload raises accuracy levels, not ability damage (post-2024 DPL rule). | Overload raises accuracy levels, not ability damage. | one_sentence | TELL | VERBOSE | |
| combat.perks.helper | PerksPanel | helper | Only sourced current values — unsourced perks stay out rather than guessed. | Unsourced perks stay out. | one_sentence | clean | | |
| combat.target.helper | TargetPanel | helper | Model an NPC instead of entering accuracy directly — Damage Potential follows the verified hit-chance chain. | NPC model drives hit chance and Damage Potential. | one_sentence | TELL | VERBOSE | |
| combat.analysis.helper | AnalysisTab | helper | A is the shared loadout… B is a scratch line… | A = Setup loadout. B = scratch compare. | one_sentence | TELL | VERBOSE | |
| combat.rot.helper | RotationPlanner | helper | Revolution runs the wiki's recommended bars… Manual for deliberate cast-by-cast work. | Revo = wiki bars. Manual = cast-by-cast. | one_sentence | TELL | VERBOSE | |
| combat.rot.empty | RotationPlanner | empty | Add abilities from the list to build a rotation. | Add abilities to the queue. | one_sentence | clean | | |
| combat.revo.helper1 | RevolutionPanel | helper | Continuous revo over the duration… (long) | Fires first ready affordable bar ability each GCD. | one_sentence | TELL | VERBOSE P06 | |
| combat.revo.helper2 | RevolutionPanel | helper | Single-target bars from PvME… (long) | Bars from PvME Revolution Bars. | one_sentence | TELL | VERBOSE | |
| combat.revo.prerun | RevolutionPanel | empty | Run revolution for a full duration cast log | Run revolution for the cast log. | one_sentence | clean | e2e-hard | soft pin |
| combat.ref.catalyst | combat/page | helper | History only — not Equilibrium multipliers or relics. | History only — not Equilibrium multipliers. | one_sentence | clean | | good |

### 6.7 Data + Sources

**Pattern rules (bulk):**

| Pattern | current pattern | proposed | length_rule |
|---------|-----------------|----------|-------------|
| `research.tab.desc` | 1–2 sentence description under every Data tab | `""` if title + rows enough; else ≤1 sentence | zero_ok preferred |
| `research.intro` | h2 + intro paragraph | keep h2 noun; intro ≤1 sentence | one_sentence |
| `research.empty.search` | Nothing matches that search. / No matches. | `No matches.` | one_sentence D06 |
| `research.count` | n shown | n shown | one_sentence |
| `data.loading` | Loading… | Loading… | one_sentence |

| id | location | kind | current | proposed | length_rule | bot | flags | notes |
|----|----------|------|---------|----------|-------------|-----|-------|-------|
| data.tabs | DataWorkbench | tab | Browse…Boundaries | keep short nouns; `Permanent unlocks` OK | one_sentence | clean | | |
| data.footer | data/page | helper | Ironman / self-sufficient only. Each row carries its own source. Policy on Sources. | Ironman only. Each row has a source. | one_sentence | TELL | VERBOSE | was 3 clauses |
| data.browse.skill.rates | ResearchBrowser | helper | Rates are before Equilibrium XP multipliers. | Rates ignore League XP multipliers. | one_sentence | clean | | |
| data.quest.intro | QuestBrowser | helper | n Wiki quest-list entries… (long) | Wiki quest list with primary/required regions. | one_sentence | TELL | VERBOSE | |
| data.prog.intro | ProgressionResearch | helper | Region-sensitive methods… (2 sentences) | Methods and unlock chains outside the skill catalog. | one_sentence | TELL | VERBOSE | |
| data.perm.intro | PermanentUnlockResearch | helper | Base-game dependencies first… (2 sentences) | Base-game deps first; League overrides second. | one_sentence | TELL | VERBOSE | |
| data.slayer.intro | SlayerResearch | helper | Deduplicated high-value… (2 sentences) | High-value Slayer routes for elective picks — not kill times. | one_sentence | TELL | VERBOSE | |
| data.inv.intro | InventionResearch | helper | Active perks… (2 sentences) | Active perks, recipes, components for ironman Invention. | one_sentence | TELL | VERBOSE | |
| data.cons.intro | ConsumablesResearch | helper | Unlock and production… (2 sentences) | Unlock/production deps; no live prices. | one_sentence | TELL | VERBOSE | |
| data.cons.poison.desc | ConsumablesResearch | helper | Weapon poison tiers worth planning around. | Weapon poison tiers. | one_sentence | SMELL | MARKETING | |
| data.arch.intro | ArchaeologyProductionResearch | helper | Collections, guild… (2 sentences) | Collections, guild, supply loops, relics. | one_sentence | TELL | VERBOSE | |
| data.mw.intro | MasterworkChainResearch | helper | long JSON interpretation | Masterwork staff self-source pulls multi-region chains. | one_sentence | TELL | VERBOSE | |
| data.bound.intro | RegionBoundariesResearch | helper | Hard boundary rules… (2 sentences) | Hard rules and unresolved crossings; Catalyst is precedent only. | one_sentence | TELL | VERBOSE | |
| data.conf.* | ResearchSection vs Browser | label | divergent sets | unify (P13) | one_sentence | TELL | CONFLICT | |
| sources.title | sources/page | heading | Sources & credits | Sources | one_sentence | clean | | |
| sources.note | sources/page | helper | Every combat number… (2 sentences) | Every combat number has a source reference. | one_sentence | TELL | VERBOSE | |
| sources.wiki | sources/page | credit | long Wiki note | Wiki mechanics under CC BY-NC-SA 3.0; facts rewritten. | one_sentence | clean | P18 | legal may stay longer |
| sources.rsa | sources/page | credit | long RS Analysis | Math reference only — no code or UI taken. | one_sentence | clean | P18 | |
| sources.pvme | sources/page | credit | long PvME | Mechanics discovery; values re-verified. | one_sentence | clean | P18 | |
| sources.jagex | sources/page | credit | long Jagex | Fan tool; not affiliated with Jagex. | one_sentence | clean | FROZEN-ish | trademark elsewhere |

---

## 7. Apply backlog (future phase — do not run now)

1. **P01 region names** — align Tasks `REGION_DISPLAY` to map/league names; update task tests if labels appear.  
2. **ERROR-free CONFLICT** — unify confidence mappers (P13); empty-search string (D06).  
3. **REDUNDANT zero_ok** — Overview counters/blessings; drop meta dupes; zero self-explanatory captions.  
4. **VERBOSE one_sentence** — Map note; combat helpers; Data research intros/tab descs.  
5. **FROZEN cluster** — only with e2e updates (`Clear picks`, counters, `no WebGPU`, nav, combat hard pins).  
6. **Tier C** — `app/concepts/**` marketing relic blurbs (`powerful gathering tools`).

**Verify after apply:** `npm run typecheck`, `npm test`, `npm run test:e2e` (local port 3100).  
**Deploy risk:** push to `main` ships live — batch carefully.

---

## 8. Orchestrator sign-off (A12)

| Criterion | Status |
|-----------|--------|
| All Humanizer skills + equilibrium-ui logged | Yes §4 |
| Production routes + chrome inventoried | Yes (agents A1–A2 + synthesis) |
| Proposals follow 0 / 1 sentence / frozen | Yes §6 |
| Dedup clusters listed | Yes §3 |
| Problem board complete | Yes §2 |
| No production source edits this phase | **Confirmed** |
| Catalog path | `docs/ui-copy-audit.md` + `docs/ui-copy-audit.json` |

**DONE** — ready for human review of proposals before any apply phase.

---

## 9. Apply status (2026-07-26)

Applied in production UI (this phase):

- Overview dedupe / shorten; region labels via map anchors
- Chrome: layout meta, footer links, error/404, ShareImport
- Map: PageHeading, no-WebGPU / narrow fallbacks, ledger titles, elective line
- Tasks: region display names aligned to map (P01); catalyst test updated
- Build: helpers shortened; credit line removed
- Combat: helpers shortened (e2e-hard labels left intact)
- Data/Sources: intros, empties (`No matches.`), credits shortened
- Frozen strings left unchanged: brand, nav, `Clear picks`, counters, trademark

Not applied: full confidence-mapper unify (P13); concepts lab Tier C; e2e-hard combat/task chrome renames.
