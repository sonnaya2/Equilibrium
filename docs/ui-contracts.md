# UI contracts

Frozen presentation and accessibility contracts for RS3 Equilibrium. Browser e2e
under `e2e/` treats these as API. CI does not run Playwright, so local e2e is
what keeps the contracts honest — change product behaviour and tests in the same
change when you intentionally break a pin.

Map rendering stack, geometry pipeline, and WebGPU fences:
[`map-rendering.md`](./map-rendering.md).

## Product character

Premium public RuneScape 3 companion — a player tool, not a developer console,
marketing site, SaaS dashboard, or generic fantasy template.

| Token role | Direction |
| --- | --- |
| Grounds | Warm near-black Editorial stone, layered dark surfaces |
| Display | Restrained gold for headings and rare structure |
| Interactive / progress | Teal or emerald (gem) for active, focus, progression |
| Text | Cream primary, muted metadata |
| Decoration | Real game icons, crests, and art — strongest decoration |
| Shape | Square or nearly square corners, thin borders, restrained depth |

Avoid SaaS card chrome, raw unstyled controls, brown spreadsheet matrices,
glassmorphism, giant gradients, glowing blobs, fake-material texture spam,
gen-AI imagery, and layouts recognisable as third-party tools (pvme.io,
rs-analysis, leagues.build, etc.). Facts and lessons from those tools are fine;
their structure, class names, and wording are not.

**Tokens live in Tailwind v4 CSS-first `@theme` in `app/globals.css`.** There is
no `tailwind.config`. Prefer theme utilities over inline hex in JSX. Display
type via `--font-display` (Cinzel) selectively; system sans for reading; mono or
tabular numerals only when comparison benefits.

**Art vs design ban:** Game, wiki, and crest art are fair game under the project
license split (`NOTICE`). Only gen-AI imagery is banned for art. Design cloning
of other companion tools is banned.

## Information architecture

Top-level navigation (exact labels):

```text
EQUILIBRIUM     Overview  Map  Tasks  Build  Combat  Data
```

| Route | Role |
| --- | --- |
| `/` | Plan overview and current plan status — no marketing hero |
| `/map` | Interactive board above ledger and detail — no side inspector |
| `/tasks` | Spacious League task browser (not a dense table checklist) |
| `/build` | Regions, relics, and blessings (no Gear tab) |
| `/combat` | Calculator with clear calculation hierarchy |
| `/data` | Regional research browser with full sources inspector |
| `/sources` | Quiet provenance and credits |

Do not force one route’s composition onto another. `Build` holds Regions, Relics,
and Blessings only. `Combat` holds Quick, Setup, Analysis, and Rotation surfaces
as implemented.

### Visual direction by area

| Area | Direction |
| --- | --- |
| Overview | Plan overview / keyart aperture |
| Map | Board on top; detail under board; no side inspector |
| Tasks | Summary cards · planner filters · spacious task cards · progress rail |
| Build | Region / relic / blessing planner (monogram frames until official icons land) |
| Combat | Clear calculation hierarchy; honest support labels |
| Data | Regional research with complete sources |

Gem marks interactive and progression state; gold marks display headings; path
colours (chaos / order / balance) carry data meaning only. Keep route-specific
spacing and depth without reviving retired layouts.

## Frozen global contracts

Pinned by `e2e/smoke.spec.ts` and related suites. Treat as public API:

1. **Brand** — accessible name exactly `EQUILIBRIUM` (primary brand link).
2. **Nav** — a navigation landmark containing links named exactly  
   `Overview`, `Map`, `Tasks`, `Build`, `Combat`, `Data`.
3. **Footer** — includes the string  
   `RuneScape is a trademark of Jagex Ltd.`  
   and Fan Content / license disclosures exercised in smoke tests (CC BY-NC-SA
   3.0 / 4.0, “not for sale”, original-code scope).
4. **Routes respond** — `/`, `/map`, `/tasks`, `/build`, `/combat`, `/data`,
   `/sources` return HTTP 200.

Do not pin mutable scraped dates or changing wiki rule prose in e2e. Match
patterns such as `sources · verified YYYY-MM-DD`.

## Map route contracts

Layout and planner behaviour (see also `map-rendering.md`):

- Board above; ledger (`RegionPicker`) and place list; **region detail under the
  stack**, never a side inspector.
- All **11** regions exposed as buttons whose accessible names **start with** the
  display name (crest/icon inside a button needs `alt=""` or the name breaks).
- Elective pick counter literals **`0/3`** and **`3/3`** (cap is three electives).
- When cap is full, a further elective control is **`aria-disabled="true"`** and
  remains **focusable** (not a native `disabled` that drops it from the tab order).
- **`Clear picks`** is always present; disabled when there are no electives (or
  before build state has hydrated from storage).
- Region detail is `section[aria-label="Region detail"]` and participates in
  **`section[aria-live]`**, with source verification text matching  
  `/sources? · verified <date>/` (pattern, not a fixed date).
- WebGPU-absent / forced-flat path shows visible copy containing **`no WebGPU`**.
- Board or place selection **focuses** and may write shareable hash state; it must
  **not** spend an elective pick. Build mutations go through explicit picker
  controls.
- Deep links of the form `/map#region=…&place=…` open the matching region and
  place selection.

Keyboard and SR surface for regions lives in `RegionPicker`. Canvas content is
not focusable and must not duplicate region accessible names.

## Tasks route contracts

- Desktop target frame about **1500–1650px** wide with real gutters.
- Summary strip: up to **five** readable cards; collapse responsively.
- Task grid plus a **300–340px** progress rail on desktop; rail below on tablet;
  single column on phone.
- Page hierarchy strong (display type roughly 28–34px scale where the layout
  uses it); controls accessible, comfortably sized, deliberately styled.
- Each task card: icon, two-line title, points, difficulty, completion rate, and
  separated status where data exists.
- Preserve exact source qualifiers (e.g. `<0.1%`).
- Paginate on the order of **30–50** records rather than mounting an entire
  unpublished corpus without evidence.
- **Catalyst** (or other stand-in) data must be unmistakably marked as temporary
  test data — never implied to be official Equilibrium content.
- Do not fabricate categories, milestones, rewards, or unlock rules for
  unrevealed data. Empty is correct until a source exists.

## Build route contracts

- Region elective counter and **`Clear picks`** remain consistent with map rules
  (`0/3`, cap behaviour).
- Regions, relics, and blessings only — no Gear tab.
- Blessings stay empty until official reveals; do not invent numbers to fill
  stubs.
- League planning is ironman / self-sufficient: no GE dual mode or trade-path
  splits.

## Combat route contracts

- `/combat` **presents** the engine; it never re-implements damage arithmetic,
  rounding, caps, tick conversion, or rotation legality in components or hooks.
- External API surface is `src/combat/index.ts`. UI may import modules it names.
  Paths under `@/combat/engine/cast/*`, `resolution/*`, `runtime/*`, and
  `schedulers/*` are engine internals and stay outside UI imports.
- Combat core has **zero React dependency** both ways: nothing under `src/combat/`
  imports React; UI does not mutate engine state directly.
- Label support honestly (`modeled`, `partially modeled`, `not modeled`,
  `mechanics unverified`). Name which metric a number is and over what window.
  Surface `SourceReference` behind displayed values.
- Prefer the term **Damage Potential** for that metric — not “hit chance”.
- Target settings stay generic (defence, accuracy-relevant values, DP override,
  size, HP%, vulnerability, poisonable, Slayer category, creature-type flags).
  Boss phase sims, kill-time, and enrage calculators are out of scope for the
  combat UI.

## Data and sources contracts

- `/data` is a regional research browser with a complete sources inspector path.
- Region rail owns downstream skill / content filtering (see `e2e/smoke.spec.ts`
  data assertions).
- Map deep links from data content use `/map#region=…&place=…`.
- `/sources` states wiki CC BY-NC-SA 3.0, PvME CC BY-NC-SA 4.0, and non-sale
  terms for Jagex art.
- Never strip footer attribution, `/sources`, or `SourceReference` fields.

## Shared component and data reuse

Prefer existing building blocks before new abstractions:

- Shell: `Page`, nav, footer
- Art: `GameIcon`, `RegionCrest`, `@/lib/gameArt`
- Data: canonical `data/` / research catalog — no second authoring tree
- Progress and build state: existing storage helpers
- Task pipeline: normalization, filtering, sorting, recommendations, pagination

A shared visual component is optional when its proportions fight a supplied
layout reference. Reuse behaviour first.

## Three.js fence (UI-facing)

`three`, `@react-three/fiber`, and `@react-three/drei` load only through the
client-only map implementation (`MapLoader` → dynamic `MapScene`, `ssr: false`).
Other routes and shared layout must not import the Three bundle. Region planning
must remain usable when WebGPU never loads. Details:
[`map-rendering.md`](./map-rendering.md).

## Art tree

One served art tree: **`public/`**.

- `public/game/` and `public/brand/` are the art — tracked, edited in place, URL
  equals path.
- Provenance metadata lives in `asset-catalog/` (metadata only, never binary
  images). Schema: `asset-catalog/schema.json`.
- Run `npm run art:check` rather than pinning image counts in documentation.
- Legitimate dual URLs use catalog `alsoAt`; `art:check` fails on unexplained
  byte-identical pairs.
- `npm run optimize:images` re-encodes in place and never renames (references stay
  valid).

## Local browser verification

| Command | Role |
| --- | --- |
| `npm run test:e2e` | Headless Playwright; default port **3100** (not 3000) |
| `npm run test:e2e:webgpu` | Headed Edge WebGPU pass for map board (port **3101**) |
| `npm run typecheck` / `npm test` / `npm run build` | Required before production push |

Notes:

- E2E is **not** in CI (`.github/workflows/validate.yml` stops at build). Local
  e2e is mandatory before a direct `main` push that can affect routes or a11y.
- Playwright should own server lifecycle for the run (reuse a verified
  Equilibrium server or start on 3100, then 3102–3110 as needed). Do not leave
  orphan dev servers.
- Headless Chromium has no WebGPU adapter; default suite skips real 3D board
  assertions. Use the WebGPU config for map rendering verification.
- Do not hardcode `verifiedAt` dates or mutable wiki strings in e2e.

For visual layout work: compare against a supplied reference when one exists;
fix the largest mismatches; re-check at phone width. Interface review checklists
are detectors after the reference match — they are not palette or layout authority
over an explicit design reference.

## Hard bans (UI)

- No Three.js outside the map fence.
- No fabricating League / blessing / task rewards for unrevealed content.
- No gen-AI game art.
- No cloning third-party companion layouts or component structure.
- No reintroducing concept/marketing routes that replace plan overview.
- No UI library introduced only to reimplement an existing pattern.
- No preserving weak legacy CSS merely because it exists when replacing a surface.
