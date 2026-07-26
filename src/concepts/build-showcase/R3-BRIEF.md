# Build Showcase — Phase 0 fail ledger + R3 brief

**Product:** RS3 Equilibrium · **Route:** `/build`  
**Date:** 2026-07-26  
**Law:** `equilibrium-ui` Hybrid Composite 9.2 · bot-audit · no-slop §§1–4.5  
**Verdict on R1/R2:** all fail production crown. Rebuild only under R3 topology rules.

---

## Topology maps (ASCII)

### Production `/build` (tabbed menu clone)

```
┌──────────────────────────────────────┐
│ titlebar (gold h1) · picks N/3       │
├──────────────────────────────────────┤
│ [Regions] [Relics] [Blessings] [Share]│  ← only one body mounts
├──────────────────────────────────────┤
│ track bar + 7 pips (decorative fill) │
├──────────────────────────────────────┤
│                                      │
│   single-tab body (max-w 1100)       │
│                                      │
└──────────────────────────────────────┘
```

**DNA:** modal client-menu recreation · sequential systems · gold rim as chrome.

### R2 War Court

```
┌ mast: title · N/3 · Copy · Clear ─────────────────┐
│ underlay: desaturated relic-menu plate            │
├────────────┬──────────────────┬───────────────────┤
│ region     │ relic hex + T1–7 │ portrait + effects│
│ crest grid │ rail             │                   │
├────────────┴──────────────────┴───────────────────┤
│ full blessing lattice (3×8 + God)                 │
└───────────────────────────────────────────────────┘
```

**DNA:** single viewport · three columns + lattice footer · no tabs.

### R2 Dossier Board

```
┌ sticky strip: N/3 · Clear · Copy · meta ──────────┐
├─────────────────────────┬─────────────────────────┤
│ wiki region table       │ hex court + splash      │
│ (dense rows)            │ blessing path stamps    │
│                         │ effects list            │
└─────────────────────────┴─────────────────────────┘
```

**DNA:** two-column folio · sticky share · no tabs.

### R2 Herald Stage

```
┌════════ SHARE PLAQUE (tall crop) ════════┐
│ seal · crests · hex stamp · path ribbon  │
│ N/3 · Clear · Copy                       │
├──────────────────────────────────────────┤
│ tools: region grid · T1 row · lattice    │
└──────────────────────────────────────────┘
```

**DNA:** share-first · tools secondary · no tabs.

### Topology clone check

| Pair | Same bones? |
|---|---|
| War Court ↔ Dossier | **Yes** — regions + relic court + blessings + share, different column chrome |
| War Court ↔ Herald | **Mostly** — same systems; Herald stacks share plaque above tools |
| Dossier ↔ Herald | **Yes** — strip/plaque + planner tools |
| All R2 ↔ Production | Different (tabs vs tabless) but R2 trio **do not diverge from each other** |

**§4.5 ruling:** R2 failed as three skins of one map. R3 must ship **three non-isomorphic maps**.

---

## BOT AUDIT — production `/build`

**Target:** `BuildPlanner` + `build-game-menu.css`

| Sev | Finding |
|---|---|
| **TELL** | Gold rim / gold-title used as **active tab border and button hover chrome** — gold is display-only under Hybrid law |
| **TELL** | Parallel token island (`--gold-rim`, `--bg-frame`, …) ignores Editorial `@theme`; fights rest of app |
| **TELL** | `max-width: 1100` centered work surface — under-fills 1440p workbench (fill axis) |
| **TELL** | Decorative track fill + 7 pips not bound to real league milestones cleanly (progress theater) |
| **TELL** | Idle gem `box-shadow` glow on selected/pip elements (selection OK; ambient 8px glow cluster is soft idle glow) |
| **SMELL** | Tab isolation hides regions while editing relics — related facts not adjacent |
| **SMELL** | Hex PNG icons underused; monogram/portrait only |
| **—** | Dark warm ground: **sanctioned** |
| **—** | Frosted unrevealed: **sanctioned** if present |

**Verdict: SUSPICIOUS** (multiple TELLs, no pure BUSTED marketing hero).  
**Not shippable as Hybrid Relic Court.**

---

## BOT AUDIT — R2 concepts (summary)

| Concept | Hard issues | Verdict |
|---|---|---|
| **War Court** | Tabless dump; underlay plate as atmosphere OK; hierarchy flat; self-score ≠ CEO | **FAIL** crown |
| **Dossier Board** | Best density of R2; still topology clone of War Court; sticky strip good | **FAIL** crown |
| **Herald Stage** | Share plaque primary = showcase not workbench; “EQUILIBRIUM / herald stage” lab voice on face | **FAIL** crown (hard fail: tool opens on share crop, not working surface) |

R1 (Herald Card, Roster, Plaque, Billboard, Court Dossier): monogram-era share crops — **do not rebuild**. Same share-first / single-system-crop bones.

---

## CEO scores (adversarial, post-hoc)

Weighted: Workbench fill 20 · Categorization 20 · Readability 15 · Game identity 15 · Anti-slop 15 · Operability 10 · Consistency 5. Cap ≤6 on hard fail.

| Surface | Fill | Cat | Read | ID | Slop | Op | Con | **/10** | Note |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| Production menu | 11 | 16 | 12 | 10 | 10 | 8 | 2 | **6.9** | Gold chrome + token island |
| War Court R2 | 16 | 8 | 12 | 14 | 12 | 8 | 2 | **7.2** | Identity up; cat fails |
| Dossier R2 | 17 | 9 | 13 | 14 | 12 | 8 | 2 | **7.5** | Best R2; still clone |
| Herald Stage R2 | 12 | 7 | 12 | 13 | 9 | 7 | 2 | **6.2** | Share-first hard fail pressure |

Pass bar **9.0**. None clear it.

---

## Production gap list

1. No `relic-court` / `Hex` / `WorkbenchTabs` / Editorial twin-desk shell  
2. Gold as interactive chrome  
3. Parallel CSS product (`build-game-menu.css`)  
4. Viewport underfill  
5. Systems isolated by tabs (categorization without spatial overview)  
6. Share buried in 4th tab while mast already shows pick count  
7. Real hex icons + crests not the visual spine  
8. Copy: see `docs/ui-copy-audit.md` §6.5  

Domain logic is fine — **UI skin + IA only**.

---

## R3 topology briefs (must not share maps)

### A · Court Rail — `/concepts/build-showcase/court-rail`

```
┌ mast: N/3 · Clear · Copy · Reset ─────────────────┐
├──────────┬────────────────────────┬───────────────┤
│ T1–T7    │ choice list + hex      │ region hive   │
│ rail     │ effects (seated)       │ (crest cells) │
│ seated   │                        │               │
│ hex      │                        │               │
├──────────┴────────────────────────┴───────────────┤
│ blessing lattice (always on, reduced height)      │
└───────────────────────────────────────────────────┘
```

**Bones:** vertical tier rail + center court + right hive + lattice belt.  
**Not** two-column folio. **Not** plaque-over-tools.

### B · Twin Desk Build — `/concepts/build-showcase/twin-desk`

```
┌ twin-desk grid ───────────────────────────────────┐
│ RAIL          │ STAGE              │ INSPECTOR    │
│ region list   │ relic hex court    │ effects      │
│ N/3 Clear     │ tier chips         │ path ribbon  │
│               │                    │ Copy/Reset   │
│               │ blessing mini-row  │ God status   │
└───────────────────────────────────────────────────┘
```

**Bones:** Hybrid Tasks/Data shell applied to Build.  
**Not** three equal columns + full lattice footer.

### C · Menu Faithful + Court — `/concepts/build-showcase/menu-court`

```
┌ mast + gem WorkbenchTabs? optional focus ─────────┐
├ choice column (left) ─┬ locked hex grid + detail ─┤
│ official menu lesson  │ frosted T2–T7 pads        │
├───────────────────────┴───────────────────────────┤
│ regions strip (horizontal crest row)              │
│ blessing lattice row                              │
│ share actions in mast                             │
└───────────────────────────────────────────────────┘
```

**Bones:** Jagex left-choice + right pad grid preserved; Editorial tokens; lattice/regions as belts not tabs.  
**Not** share plaque. **Not** twin-desk three-bay.

---

## R3 banned

- Share-first plaque as primary surface  
- Topology clones of R2 war/dossier/herald  
- New 100KB+ `.bs-*` product CSS — thin `r3-build.css` + Tailwind tokens only  
- Invented relic/blessing text  
- Gold as active chrome  

## Crown rule

CEO ≥ **9.0** on rubric, no hard fail, then **you** pick production champion. Self-score ignored.

---

## R3 lab status (2026-07-26)

| Route | Component | Topology shipped |
|---|---|---|
| `/concepts/build-showcase/court-rail` | `CourtRail.tsx` | rail · court · hive · lattice belt |
| `/concepts/build-showcase/twin-desk` | `TwinDeskBuild.tsx` | twin-desk rail · stage · inspector |
| `/concepts/build-showcase/menu-court` | `MenuCourt.tsx` | choice col · pad grid · region strip · lattice |

Shared: `R3Shared.tsx`, `r3-build.css` (layout DNA + Editorial tokens). Live `useBuild`.

### Provisional CEO scores (agent — you overrule)

| Concept | Fill20 | Cat20 | Read15 | ID15 | Slop15 | Op10 | Con5 | **/10** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A Court Rail | 17 | 16 | 13 | 13 | 13 | 8 | 4 | **8.4** |
| B Twin Desk | 17 | 18 | 13 | 12 | 13 | 9 | 5 | **8.7** |
| C Menu Court | 16 | 15 | 12 | 14 | 12 | 8 | 3 | **8.0** |

None auto-pass 9.0 — need your eyes on live pages (art density, hive readability, lattice height). Closest: **Twin Desk** (Hybrid consistency). Identity edge: **Menu Court** (Jagex lesson). Spatial overview: **Court Rail**.

**Next:** open the three R3 routes, crown one (or demand another topology), then Phase 2 productionizes into `/build`.

---

## User feedback + hybrid lead (append · 2026-07-26)

**Live lab read (user):**

- Path / layout sizes feel **too big** across R3 surfaces — need tighter density before any crown.
- Of the three, **Menu Court is least bad** as a base (menu structure reads, not a topology dead end).
- **Court Rail relic stage is better** than Menu Court’s pad-grid relic treatment — merge that stage into the Menu Court shell.
- Agent swarm is **optimizing the hybrid** (Menu Court structure + Court Rail relic stage + compact blessing chips) in lab metadata; not a production crown yet.

**Lab metadata ruling:**

| Role | Concept | Note |
|---|---|---|
| **Leading hybrid champion candidate** | **Menu Court** | Preferred base being optimized |
| Relic-stage donor | Court Rail | Relic court/rail lesson merges into Menu Court |
| Contender kept for comparison | Twin Desk | Hybrid Tasks/Data shell; not the lead path |

**Thesis (Menu Court, lab):** Hybrid lead: menu structure + court-rail relic stage; compact blessing chips. Craft: Genshin/HSR energy on Equilibrium tokens.

Do **not** delete R1/R2 history above — fail ledger and topology clone ruling still stand. This section only records the preferred optimization path for R3 → production.

---

## Showcase craft bar (append · 2026-07-26)

**Craft target for Build Showcase / R3 hybrid work:**

- **Energy:** Genshin / HSR-grade showcase density and presentation ambition (readable prestige crop, systems visible, no dead air).
- **Tokens:** Equilibrium Hybrid Composite only — Editorial `@theme`, gem-green chrome, no parallel token islands, no gold-as-chrome.

Menu Court remains the preferred hybrid base; this bar governs polish, not topology. R1/R2 fail ledger unchanged.

---

## BOT AUDIT — showcase craft pass

**Date:** 2026-07-26  
**Target:** `MenuCourt.tsx` + dense rules in `r3-build.css` (`.r3-dense*` / `.r3-relic-*` / tip) + shared `R3Shared` mast/hive/lattice  
**Law:** `no-slop-ui` §§1–4.5 · `equilibrium-ui` Hybrid exceptions · R3 topology freezes above · showcase craft bar  
**Mode:** detection only (no code surgery)

### Surface under audit (live code)

```
mast (Build · N/3 · path pips · Clear · Copy · Reset)
regions belt (crest row)
relic board (all T1–T7 rows · artifact hex + hover tip)
blessing constellation belt (compact lattice)
```

Not the original brief-C map (`choice col · pad grid · region strip · lattice`). Lab lead path densified into a vertical stack. Tokens remain Editorial `@theme` via `var(--color-*)` only.

### BUSTED

| Finding | Notes |
|---|---|
| **None** | No multi-stop rainbow / cyan→purple→pink chrome. No gradient text. No idle gem/gold glow on resting controls. No glass stack. No SaaS hero/CTA. No `#6366f1` / shadcn indigo island. |

### TELL

| Finding | Why it clocks |
|---|---|
| **Eyebrow stack** | Three stacked `.r3-label` uppercase + tracked labels (`Regions · …`, `Relics · hover for effects`, `Blessings`) — no-slop §1 “eyebrow-everything”. One display head is enough; rest should be plain section ink. |
| **Effects off-surface** | Relic effects only in CSS hover tip + `title` — workbench TELL. Related facts not adjacent at rest; Court Rail / Twin Desk keep effects as permanent stage/inspector copy. Dense craft, weaker operability. |
| **Lab Hoyo voice (meta)** | File header + CSS comment + `teams.ts` thesis + craft bar cite “HSR/Genshin” / “artifact” energy. Surface chrome is still Equilibrium tokens — but process language pressures agents toward Hoyo item-popup chrome. Keep energy as density/reference, not palette. |
| **Tip soft shadow stack** | `.r3-relic-tip` uses hard offset **and** `0 8px 18px` soft black blur. Hover-only (not idle chrome), still a soft-glow cousin; hard offset alone would match carved print language better. |

### SMELL

| Finding | Notes |
|---|---|
| **Orphan craft classes** | `r3-artifact`, `r3-artifact__medallion`, `r3-artifact__well` used in TSX; no matching rules in `r3-build.css` — medallion intent is name-only (falls back to `.r3-relic-hex` layout). |
| **Name truncation** | `shortRelicName` collapses long relic titles to first word — identity loss at a glance. |
| **Pick counter twice** | Mast `N/3` + `Regions · N/3` — mild triple-label pressure. |
| **Dead topology CSS** | `.r3-menu*` / `.r3-opt*` still in stylesheet while Menu Court ships `.r3-dense` only — residual skins, not surface slop. |
| **“Constellation belt” comment** | CSS metaphor only; lattice itself is correct game geometry. |
| **Tip body densest floor** | Effect list `0.75rem` (12px) — at data-readability densest floor; OK for tooltip, not for permanent inspector body. |

### Equilibrium exceptions (adjudicated — do not strip)

| Exception | Status on this surface |
|---|---|
| Dark warm stone ground | **Present / sanctioned** |
| Selection inset gem ring (`.is-on`) | **Present / sanctioned** — selection only, not idle glow |
| Path triad (order / chaos / balance) | **Data only** — lattice path chips + mast micro-pips; not button/active border chrome |
| Gold display ink | **Title + tip title + monogram + god cell** — not active tab/hover chrome (btn hover = gem) |
| Frosted / sealed material | **Sealed wells** saturate-down + hatch-adjacent language; game unrevealed, not glassmorphism stack |
| Timber/hatch locked cells | Available on menu-slot paths; dense sealed uses filter + inset wells |

### Confirm: no Hoyo blue-purple chrome

**CONFIRMED ABSENT.**

- Grep of dense Menu Court path + `r3-build.css` chrome: active borders / fills = `gem-*`; display = `gold-*`; grounds = `stone-*` / `parch-*`.
- Order blue (`--color-order-400`) appears only on path **data** chips/pips (`is-order`), never as interactive chrome.
- No indigo/violet hex, no blue→purple gradient, no purple accent panels, no Hoyo rarity-purple as brand chrome.
- “Genshin/HSR energy” is **lab thesis / comment / craft-bar ambition only**, not a second palette.

### Confirm: topology freezes still hold

| Freeze | Hold? | Evidence |
|---|---|---|
| R3 A/B/C **non-isomorphic** | **HOLD** | A `r3-court` 3-col + lattice belt · B `twin-desk` rail/stage/inspector · C `r3-dense` vertical regions → all-tier board → bless belt. Different bones. |
| Not R2 War / Dossier / Herald clone | **HOLD** | No three equal columns + full lattice dump; no share plaque primary; no sticky folio-only strip as the plan. |
| No share-first plaque | **HOLD** | Share is mast Copy only. |
| No gold-as-active-chrome | **HOLD** | Hover/active = gem; gold = display. |
| Not twin-desk three-bay (for Menu Court) | **HOLD** | Dense stack, not rail·stage·inspector. |
| §4.5 no topology recolor of same map | **HOLD** among live R3 trio | |
| Brief-C map literal (choice col · pad grid) | **SUPERSEDED in code** | Dense craft replaced original C ASCII; freeze that still matters is **divergence from A/B and R2**, which holds. Lab status table above still says “choice col · pad grid” — **doc drift** vs `MenuCourt.tsx`. |

### Verdict

**SUSPICIOUS** — no pure BUSTED fingerprint; multiple TELLs (eyebrow stack, hover-only effects, lab Hoyo voice, tip soft-shadow).  
Not a production crown claim. Hoyo **blue-purple chrome: clean**. Topology freezes (non-clone R3 trio + R2 bans + gold/share rules): **hold**, with Menu Court bones evolved to dense stack (update lab topology row when next editing status, not this audit).

**Fix route if later:** `ui-humanizer` (eyebrow collapse, permanent effects strip or selected-row effects, tip shadow hard-only, wire or drop orphan `r3-artifact*` classes) · thesis copy: keep craft bar density ambition without palette drift once crown path is locked.  
**Not in scope of this pass:** code changes.
