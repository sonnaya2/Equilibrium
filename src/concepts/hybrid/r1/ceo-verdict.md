# CEO Verdict — Hybrid Composition · Round 1

**Judge:** Hardass lead web dev  
**Pass bar:** **9.0 / 10**  
**Recipe (FIXED — not negotiable):**

| Slot | DNA |
|---|---|
| Colors | Editorial |
| Overview | Daylight |
| Map | Editorial 3D-top · **NO inspector** |
| Tasks | Crystal × Data |
| Build | Editorial + relic presentation |
| Combat | Crystal main · Editorial accents |
| Data | Lattice + Editorial + Daylight browse + **FULL source inspector** |

**Axes (weights → /10):** Recipe fidelity 25 · Public craft 20 · Data readability 20 · Operability 15 · Anti-slop 10 · Signature 10.

**Winner:** **NONE.** `winnerId: null`. Highest score is **8.9** (Prism). Nobody ships to production from R1.

Every team shipped a full six-route interactive preview. That is the bare minimum for sitting at this table — and still not enough to clear 9.0.

---

## Ranked table

| Rank | Team | Codename | Score | Status |
|---|---|---|---:|---|
| 1 | **Prism** | Facet Desk | **8.9** | contender |
| 2 | Orbit | Board Sky | **8.7** | contender |
| 3 | Nova | Courtyard First | **8.6** | contender |
| 4 | Forge | Calc Crystal | **8.3** | contender |
| 5 | Ridge | Relic Court | **8.0** | contender |

**`winnerId`: null** — pass bar not cleared. R2 mandatory for all five. Prefer honest 8s over fake 10s.

---

## Axis breakdown

| Team | Recipe | Craft | Read | Ops | Anti | Sig | **Total** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Prism | 8.8 | 8.5 | 9.3 | 9.1 | 8.6 | 9.4 | **8.9** |
| Orbit | 8.3 | 9.0 | 8.6 | 8.5 | 9.0 | 9.5 | **8.7** |
| Nova | 8.0 | 9.1 | 8.6 | 8.3 | 9.0 | 9.2 | **8.6** |
| Forge | 7.4 | 8.4 | 8.5 | 8.0 | 9.4 | 9.4 | **8.3** |
| Ridge | 7.2 | 8.6 | 7.8 | 7.8 | 8.2 | 9.3 | **8.0** |

---

## Recipe fidelity audit (SCREAM sheet)

| Hard rule | Prism | Orbit | Nova | Forge | Ridge |
|---|---|---|---|---|---|
| Editorial colors | OK | OK | OK | OK | OK |
| Overview Daylight courtyard | OK | OK | **best** | weak band | OK |
| Map **no** side inspector | OK | **best** | OK | OK | OK |
| Tasks Crystal×Data density | **best twin** | OK | OK | OK | OK |
| Build Editorial + real relic present. | **FAIL gear cosplay** | FAIL all-empty | FAIL all-empty | FAIL all-empty | **best T1 court** |
| Combat Crystal + honest math | thin | thin | thin | **best** | adren nums |
| Data **FULL** sources | **best** | multi, no URL | single block | **FAIL caption** | **FAIL thin** |

**RECIPE SCREAMS:**

1. **FORGE + RIDGE — Data is not a full source inspector.** Recipe says *full SourceReference*. A provenance caption (`wiki-demo`, `source: "wiki"`, one `sources? · verified <date>` line) is **not** the desk. Multi-source cards with title · url/path · verifiedAt · type · notes are the bar. Prism cleared it. Orbit almost did (missing URL). Nova has a structured single source. Forge and Ridge **failed the recipe hard requirement**.
2. **NOVA + ORBIT + FORGE — Build pretends T1 is unrevealed.** `data/league/relics.json` already carries Survivalist / Endless Harvest / Golden Touch (Jagex countdown, verified envelope). Empty “seven tiers unrevealed” is **stale honesty**. Empty is correct for blessings and T2–T7 — not for published T1. Ridge got this right.
3. **PRISM — Relics tab is a weapon rack.** Crystal hatchet / Drygore / Seren godbow labeled “art only” is **not** relic presentation. It is inventory cosplay on the wrong route. Monogram frames + real T1 names (Ridge) beat gear PNGs every day of the week until Equilibrium relic icons land under `public/game/`.
4. **Map inspectors:** nobody shipped a right-rail RegionInspector. Good. Folio / ledger / focus caption under the board is allowed. Do not “fix operability” by growing a third column in R2.

---

## 1 · PRISM · Facet Desk · 8.9 · CONTENDER

**Closest to the fixed recipe on the routes that usually die: Data and Tasks.** Twin desks (lattice tabs · Daylight crest rail · facet chips · full multi-source inspector with title / url / verifiedAt / sourceType) are real product DNA, not a brief slide. Map correctly refuses a right inspector. Overview courtyard exists. Editorial ladder is clean.

Still **0.1 under ship** because Build is a costume party and Map/Combat atmosphere are average.

### Axis notes

| Axis | Score | Note |
|---|---:|---|
| Recipe fidelity | 8.8 | Data/Tasks nail DNA. Build relic slot is wrong art. Combat OK not great. |
| Public craft | 8.5 | Magazine mast + desk craft; less fort atmosphere than Nova/Orbit. |
| Data readability | **9.3** | Best in field — 15px tables, full field dump, multi-source cards. |
| Operability | 9.1 | Live picks, twin filters, row select, linkable sources. |
| Anti-slop | 8.6 | Fixtures provisional — but gear-as-relic is a semantic lie. |
| Signature | 9.4 | Twin Facet Desk unmistakable in three seconds. |

### Brutal roast

1. **YOUR RELICS TAB IS A GEAR SHOWROOM.** Drygore and godswords are not Equilibrium T1 choices. Labeling them “art only” does not absolve the route name **Relics**.
2. **You won Data by doing the homework everyone else half-assed** — then left Build to a sprite dump. That is not hybrid execution; that is signature tunnel vision with a side of inventory.
3. Map is a **crest spreadsheet with a bottom ledger**, not Editorial 3D-top sky. Orbit owns the sky; you own the desk. Steal board height without stealing inspector bloat.
4. Combat is empty-copy panels. Fine honesty, **zero Crystal density**. Forge embarrassed you on ability scan without inventing a single DPL percent.
5. Twin-desk thesis copy still peeks into player-facing chrome. Thesis belongs in the brief, not the lintel.

### Must-fix (R2)

- Wire real T1 relic court (names + effects from data; monogram placeholders; no Catalyst PNGs).
- Raise Map board craft to Board Sky height without a third column.
- Densify Combat ability scan under vacancy law.
- Keep full SourceList — do not regress to a count column + caption.

---

## 2 · ORBIT · Board Sky · 8.7 · CONTENDER

**Map is the only R1 surface that feels like a product sky.** Tall board zone, terrain plate, crest markers, ledger owns a11y, focus card stays in the ledger — **zero RegionInspector**. Frozen pick strings (`N/3`, Clear picks, name-first buttons, crests `alt=""`) are treated like law. That is signature execution of the hard Map rule.

### Axis notes

| Axis | Score | Note |
|---|---:|---|
| Recipe fidelity | 8.3 | Map perfect DNA. Data multi-source incomplete (no URL). Build empty vs live T1. |
| Public craft | **9.0** | Atmosphere + Editorial stone without console cosplay. |
| Data readability | 8.6 | 15px tables; sources cards readable but not complete references. |
| Operability | 8.5 | Map/Build picks excellent; Data interactive; Tasks thinner. |
| Anti-slop | 9.0 | Fixture labels, empty combat bay, no funnel. |
| Signature | **9.5** | Board Sky is the round’s cleanest signature hit. |

### Brutal roast

1. **FULL SOURCE INSPECTOR WITHOUT A URL IS A PRESS RELEASE.** Label · kind · verifiedAt · note is a nice card. Recipe wants **locators**. Prism ships `href`. You ship vibes.
2. **T1 RELICS EXIST.** Empty Relics/Blessings twins is lazy parity. Blessings empty: correct. T1 empty: wrong.
3. Tasks Crystal×Data is a **facet rail + wiki table + slim note** — competent, not twin-desk. If Map is the masterpiece, say so; don’t claim Data density you didn’t build.
4. Source cards repeat the live `sources?` line under a list — good pattern — then forget the only field a player clicks.
5. Do not “win R2” by bolting an inspector onto Map. That is a recipe foul, not craft.

### Must-fix (R2)

- Add url/path + type to every SourceReference card.
- Seat published T1 relics; keep T2–T7 sealed.
- Either twin Tasks toward Prism density or explicitly keep Tasks secondary without overselling.
- Preserve board majority height; ledger instrument only.

---

## 3 · NOVA · Courtyard First · 8.6 · CONTENDER

**Overview is the best Daylight gate in the tournament.** Lintel · west standing picks · keyart aperture · east milestones · courtyard desk. Editorial `--echo-*` ladder is disciplined. Map has no inspector (folio under board). Data has a real right inspector — structured single source, not multi.

### Axis notes

| Axis | Score | Note |
|---|---:|---|
| Recipe fidelity | 8.0 | Gate + Map OK. Data single-source. Build all-empty T1 miss. |
| Public craft | **9.1** | Courtyard reads public companion, not console. |
| Data readability | 8.6 | 15px lattice; inspector complete for one source. |
| Operability | 8.3 | Shared picks Map/Build/Overview; filters work. |
| Anti-slop | 9.0 | Fixture tags, empty blessings, no invented DPL. |
| Signature | 9.2 | Courtyard First is unmistakable on Overview. |

### Brutal roast

1. **YOU EMPTIED THE RELIC COURT WHILE RIDGE SERVED THE REAL MENU.** “Never invent” does not mean “ignore published T1.” Read the data envelope.
2. Data inspector is a **single SourceReference dressed as full**. One label/path/verified/note block beats Forge’s caption — it does **not** beat Prism’s multi-source dump when a row has two wiki refs.
3. Map crest tiles on a slab are fine mock DNA; they are **not** Board Sky. Folio under board is correct; atmosphere is thin.
4. Combat lists real ability names with CD strings — denser than Ridge/Prism prose bays — still nowhere near Forge’s vacancy wells + facet bar.
5. Courtyard First is a front door strategy. If R2 Overview becomes a status strip, you lose the only axis you own.

### Must-fix (R2)

- Multi-source SourceReference list on Data.
- Real T1 relic court (Ridge DNA, Editorial skin).
- Taller Editorial 3D-top Map without inspector.
- Crystal combat density without fake math.

---

## 4 · FORGE · Calc Crystal · 8.3 · CONTENDER

**Combat is the only math room that respects the calculator’s soul.** Style chips with real combat icons, facet ability bar slots, wiki-dense ability table with **structured `—` vacancies** for Adren and DPL, VacancyWell captions, Analysis A/B both unbound. Anti-slop on Combat is elite. Signature clear.

Then you **walked into Data and filed a memo.**

### Axis notes

| Axis | Score | Note |
|---|---:|---|
| Recipe fidelity | **7.4** | Combat DNA 10/10; Data FULL sources **hard fail**; Map/Overview weaker. |
| Public craft | 8.4 | Crystal desk premium; Overview/Map more utility than fort. |
| Data readability | 8.5 | Tables 15px; Combat scan dense; Data inspector thin. |
| Operability | 8.0 | Combat rich; Map **no Clear picks**; Data browse works. |
| Anti-slop | **9.4** | Vacancy law is the gold standard for the field. |
| Signature | 9.4 | Calc Crystal unmistakable on open. |

### Brutal roast

1. **`source: "wiki-demo"` IS NOT A SOURCE INSPECTOR.** It is a spreadsheet cell. Recipe: Lattice + Daylight browse + **FULL** sources. You shipped browse + a caption. **RECIPE FOUL. LOUD.**
2. Map has **no Clear picks**. Frozen contract string is not optional flavor text. Add/Remove on focus does not replace Clear.
3. Overview is a **keyart banner with milestones**, not a three-bay Daylight courtyard. Daylight DNA is gate architecture, not “photo on top of panels.”
4. Build relics empty — same T1 blindness as Nova/Orbit.
5. You will be tempted to invent demo DPL to “look complete.” **Don’t.** Your vacancy wells are the craft. Extend that honesty to Data sources instead of faking math.

### Must-fix (R2)

- Full multi-source inspector (match Prism contract).
- Clear picks on Map; keep no inspector column.
- Daylight courtyard gate on Overview.
- Seat T1 relics; keep combat vacancy law sacred.

---

## 5 · RIDGE · Relic Court · 8.0 · CONTENDER

**Build is the only R1 Relics surface that tells the truth about Equilibrium T1.** Survivalist · Endless Harvest · Golden Touch with monogram frames, skill chips, full effects folio, provenance line, sealed T2–T7, empty blessing lattice with path colors as **data labels only**. That is Editorial + relic presentation done correctly under the art ban (no Catalyst PNGs).

Everything else is a capable shell that **fails the Data recipe** and softens Combat honesty.

### Axis notes

| Axis | Score | Note |
|---|---:|---|
| Recipe fidelity | **7.2** | Build masterpiece; Data sources hard fail; Map thin; lattice leaf noop. |
| Public craft | 8.6 | Court stage premium; global ArtStage keyart on every route is heavy. |
| Data readability | 7.8 | 15px table OK; inspector is thin single-string provenance. |
| Operability | 7.8 | Relic select + picks work; Data leaf does not filter; non-Browse stubs. |
| Anti-slop | 8.2 | T1 honesty excellent; adren integers undercut empty result bay. |
| Signature | 9.3 | Relic Court unmistakable. |

### Brutal roast

1. **DATA FULL SOURCES — YOU FAILED.** `source: "wiki"` plus `lab://fixture/...` is a costume inspector. Lattice leaf buttons **do not filter**. Progression/Unlocks/Systems are empty apology panels. Prism would fire this desk.
2. **You print adrenaline 50 / 100 in the ability table while the result bay says unbound.** Ability catalog costs are not DPL — but the juxtaposition reads as “we invent numbers sometimes.” Forge leaves Adren as `—` until bind. Match that discipline or label the column **catalog cost** with DPL still vacant.
3. **Keyart ArtStage on every route** is one plate away from a marketing hero. Court energy belongs on Build. Other routes need Editorial chrome, not a permanent poster.
4. Map is crest tiles + “3D wartable” text. That is a **label**, not a board.
5. Relic Court is so good it exposes the rest of your hybrid as unfinished homework. Signature without recipe coverage is a **specialist demo**, not a composition win.

### Must-fix (R2)

- Real multi-source Data inspector; lattice leaf filters; Browse stays Daylight.
- Combat adren/DPL vacancy consistency (Forge wells).
- Map board craft without inspector; keep `no WebGPU` cue if you keep the fallback string.
- Thin global ArtStage; keep monogram T1 law; never Catalyst icons.

---

## Cross-cutting R2 law (all teams)

1. **Data inspector contract (non-negotiable):** gold title · crest · every scalar field · **sources list** where each entry has title, url/path, verifiedAt, sourceType (and optional note). Multi when multi. Empty list when empty. Never invent refs.
2. **Map:** no third-column inspector. Ever. Board + ledger/folio only.
3. **Build T1:** published relics are not “unrevealed.” Blessings stay empty. T2–T7 sealed.
4. **Combat:** structured vacancy > demo math. Ability **names/icons** dense; DPL/hit/expected empty until core binds.
5. **Gem = interactive. Gold = engraved display. Path triad = data only.** No SaaS funnel. No gen-AI. Fixture rows labeled fixture/provisional.
6. **Pass bar remains 9.0.** Steal the best DNA from each other without cloning markup: Prism Data, Orbit Map, Nova Overview, Ridge Build, Forge Combat. That mash is the hybrid recipe — **execution is still the contest.**

---

## Steal matrix (legal — lesson not clone)

| DNA | Steal from |
|---|---|
| Daylight courtyard gate | Nova |
| Editorial 3D-top board (no inspector) | Orbit |
| Twin Tasks/Data desk + full sources | Prism |
| T1 Relic Court (honest art law) | Ridge |
| Crystal combat vacancy + ability density | Forge |

R2 winner is whoever **composites** those five without recipe fouls. Specialists who only polish their signature stay under 9.0.

---

*Hardass out. No trophies. Fix the SCREAMs.*
