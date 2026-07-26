# BOT AUDIT — RS3 Equilibrium production UI (R5 · post-R4 color ship)

**Scope (read-only):**  
`app/globals.css`, `app/page.tsx`, `app/data/page.tsx`, `app/layout.tsx`,  
`src/components/Nav.tsx`, `Page.tsx`, `BuildPlanner.tsx`, `ResearchBrowser.tsx`,  
`WorkbenchTabs.tsx`, `src/components/combat/CombatTabs.tsx`

**Product class:** game-world surface + tool workbench  
**Binding law:** `equilibrium-ui` (product) → `no-slop-ui` §§1–4.5 fingerprint bans → `data-readability` floors  
**Adjudication (do not strip):** frosted unrevealed cells · timber + top-light cell gradients · dark warm ground · path triad as data only · selection inset only (not idle glow)

Sweep date: 2026-07-26 · detection only · no production edits

---

## Adjudicated OK (sanctioned — not findings)

| Signal | Where | Why OK |
|---|---|---|
| Top-light `linear-gradient` on `.cell::after` | `globals.css` | Game hex material, not brand chrome |
| Timber `repeating-linear-gradient` on `.cell-locked` | `globals.css` | In-game barrier language |
| Dark warm void ground `stone-950` / stage `stone-800` | tokens + shell | League panel / Wiki dark register |
| Path triad (`chaos` / `order` / `balance`) | `BuildPlanner` path labels only | Data semantics, never button/border chrome |
| Frosted unrevealed (overlay + clip) | `.cell-unrevealed` | Game blurs unrevealed relics/blessings — not glassmorphism stack |
| Gem selection inset on `.cell-selected::before` | `globals.css` | Selected state only; nothing glows at rest |
| Gold on brand + `PageHeading` only | `Nav`, `Heading` | Display ink law |
| Gem active nav / tabs | `Nav`, `WorkbenchTabs`, `CombatTabs` | Single chrome accent |
| Inline timber hexes in locked cell CSS | `globals.css` | Documented material exception |

---

## BUSTED (0)

_None._

No multi-stop rainbow / blue→purple chrome. No gradient text. No idle glow shadows. No glassmorphism-as-default. No shadcn indigo+slate theme. No marketing hero + CTA. No SaaS skeleton (features / testimonials / pricing). No builder residue. No invented KPI-0 gardens. No pink/Print. No gold-as-active. No order-blue interactive chrome.

---

## TELL (2)

1. **`src/components/ResearchBrowser.tsx:419-421` — redundant “Browse” panel title under an already-active Browse tab**  
   Data route stack is: nav **Data** → gold h1 **Data** → workbench tab **Browse** → inner `h2` **Browse**. That is the triple-label fingerprint (nav + page title + panel header repeating the same job). The count line next to it is fine; the second “Browse” is not.

2. **`src/components/combat/CombatTabs.tsx:16-38` — hand-rolled tab chrome without the shared contract**  
   Build/Data use `WorkbenchTabs` (`role="tablist"`, `role="tab"`, `aria-selected`). Combat reimplements the same gem-underline look with plain buttons and no tab roles/panels. Not a rainbow tell, but it is the “same screen class, different scaffolding” fingerprint plus an operability gap. Cynical read: generated once per route, never unified.

---

## SMELL (8)

1. **`ResearchBrowser.tsx:424-431` — six-up catalog count strip**  
   Real numbers (not `0` / `—`), so not BUSTED KPI theatre. Still reads as a dashboard tile band on a tool that already states the same counts in the list header. Prefer one place.

2. **`ResearchBrowser.tsx` MethodTable / content tables — fork of `.data-table`**  
   Hand-rolled `text-[15px]` tables match the R4 size ladder but skip sticky opaque thead + shared stage fill from `globals.css .data-table`. Long training tables lose the header on scroll; two table skins = mild template drift.

3. **`ResearchBrowser.tsx:186,307` + several research shells — `tracking-tight` on large `h2`s**  
   Not Inter/Geist identity, so not BUSTED. Still a default SaaS headline micro-tell on region/skill titles. Prefer normal tracking or display-face only where gold page titles already sit.

4. **`BuildPlanner.tsx:292,412` — em-dash name — effect lines**  
   Sparse, not paragraph density. Still a language micro-tell in prominent relic/blessing copy. Middot or colon reads more player-tool.

5. **`app/data/page.tsx:29` — Research notes body `text-parch-300`**  
   R4 lifted Data browse body to `parch-100` / `parch-50`. This note block stayed muddy secondary ink for multi-sentence prose.

6. **`app/layout.tsx:40-48` — footer `text-parch-500` / Concepts link `parch-400`**  
   Legal line can be quiet; after R4 demotion of `parch-500` off live surfaces this is the last global quiet-but-readable band. Lift to `parch-300` for the trademark string so it survives arm’s-length.

7. **`globals.css:317-321` — `.stat-strip .stat-label` still `parch-500`**  
   Agent L left this intentionally; inspector captions remain the darkest readable ink. Fine alone; in a cluster with footer + data notes it reintroduces the pre-R4 mud band.

8. **`BuildPlanner.tsx` relic tier label `text-gem-400` uppercase tracking (`:263`)**  
   Gem on a non-selected tier caption is a soft accent-edge habit. Prefer `parch-100` / `parch-300` for the “Tier N · pick one” caption; keep gem for selected cell + active tabs only.

### Sterility (Sweep 5) — not WASHED

- Game art present (region crests in Build hexes + inspector).  
- Material present (carve panel, timber lock, top-lit cells).  
- Overview opens on status + systems table, not empty-state polish.  
- Accent (gem) is full-force on active nav and tabs.  
- Density: Build lattice + Data tree+table are working surfaces, not bleach wireframes.

---

## Structure / language notes (in-scope pages)

| Surface | Open-on-tool? | Copy | Notes |
|---|---|---|---|
| Overview (`app/page.tsx`) | Yes — status + planner list + systems table | Plain, specific, admits provisional `*` | Passes hero ban |
| Data (`app/data/page.tsx` + browser) | Yes — tabs into catalog | Specific sources; no marketing adjectives | TELL #1 only |
| Shell (`layout` + `Nav` + `Page`) | Fluid `max-w-[1600px]` workbench | Trademark footer honest | SMELL #6 |
| Build (`BuildPlanner`) | Lattice + inspector | Honest empty blessing copy | SMELL #4, #8 |
| Combat tabs | Opens Quick | N/A in this file | TELL #2 |

No banned marketing lexicon (`seamless`, `reimagined`, `unlock your…`, emoji UI, “Oops!”).

---

## Code / markup artifacts

- No `<!-- Hero -->` / testimonials comments in audited files.  
- Class names functional (`panel`, `data-table`, `cell-*`, `WorkbenchTabs`) — no `hero-glow` / `kpi-card`.  
- `cleanText()` identity helper in ResearchBrowser is dead-weight but not a fingerprint.

---

## Verdict

```
BOT AUDIT — RS3 Equilibrium production UI (R5 post-R4)
BUSTED (0): —
TELL   (2): ResearchBrowser redundant Browse h2; CombatTabs forked tab chrome
SMELL  (8): catalog strip; table fork; tracking-tight h2s; em-dash effects;
            data notes parch-300; footer parch-500; stat-strip labels;
            gem tier captions
Verdict: SUSPICIOUS
  (TELLs present, no BUSTED; not 3+ TELLs on one screen → not BUSTED)
Fix route: ui-humanizer (visual/structure) · text-humanizer (em-dash lines)
Sanctioned exceptions: held — do not bleach frosted cells / timber / dark ground / path triad
```

**CEO bar read (not a score):** Anti-slop is near ship. Consistency + a couple of residual ink/label nits are what keep this from a clean **PASSES** and from free points on the rubric’s consistency/operability/readability axes. See `must-fix.md`.
