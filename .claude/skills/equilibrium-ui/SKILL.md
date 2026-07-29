---
name: equilibrium-ui
description: Binding UI and interaction guidance for RS3 Equilibrium. Use before changing UI, CSS, layout, components, copy, or route behavior. Covers product identity, Tasks, accessibility contracts, the map-only Three.js fence, responsive behavior, and rendered QA.
---

# Equilibrium UI

Build a premium public RuneScape 3 companion: a player tool, not a developer console, marketing site, SaaS dashboard, or generic fantasy template.

## Precedence

1. Follow the user's supplied reference and explicit requirements.
2. Preserve real data, state, accessibility, and provenance while replacing weak presentation.
3. This skill defines this product. Global anti-slop skills are detectors, not palette or layout authority.
4. `rs3-ponytail` limits dependencies, abstractions, and file count—not visual quality or rendered iteration.
5. Remove obsolete rules instead of stacking exceptions around them.

## Product character

- Warm near-black Editorial stone grounds and layered dark surfaces.
- Restrained gold for display headings and rare structure.
- Teal or emerald for active, focus, and progression state.
- Cream primary text and muted metadata.
- Real RuneScape icons, crests, and art as the strongest decoration.
- Square or nearly square corners, thin quiet borders, restrained depth.

Avoid SaaS cards, raw controls, brown spreadsheet matrices, glassmorphism, giant gradients, glowing blobs, fake-material texture spam, generated art, and cloned third-party layouts. Do not flatten hierarchy just to satisfy an anti-slop checklist.

Use Tailwind v4 CSS-first tokens in `app/globals.css`; there is no `tailwind.config`. Use Cinzel selectively through `--font-display`, system sans for reading, and mono or tabular numerals only when comparison benefits. Keep JSX free of inline hex.

## Route identity

| Route      | Direction                                                    |
| ---------- | ------------------------------------------------------------ |
| `/`        | plan overview and current plan status; no marketing hero     |
| `/map`     | interactive board above ledger and detail; no side inspector |
| `/tasks`   | spacious League task browser                                 |
| `/build`   | region, relic, and blessing planner                          |
| `/combat`  | calculator with clear calculation hierarchy                  |
| `/data`    | regional research browser with complete sources inspector    |
| `/sources` | quiet provenance and credits                                 |

Do not force one route's composition onto another.

## Tasks browser

- Target a `1500-1650px` desktop frame with readable gutters.
- Use five summary cards only while each remains readable; collapse responsively.
- Use a task grid plus `300-340px` progress rail on desktop, rail below on tablet, one column on phone.
- Keep controls accessible, comfortably sized, and deliberately styled.
- Give each task icon, two-line title, points, difficulty, completion rate, and separated status.
- Preserve exact source qualifiers such as `<0.1%`.
- Paginate roughly `30-50` records rather than mounting the corpus without evidence.
- Show Catalyst as temporary test data; never imply it is Equilibrium data.
- Never fabricate milestones or rewards for unpublished data.

## Reuse and boundaries

Reuse `Page`, `Nav`, `GameIcon`, `RegionCrest`, `@/lib/gameArt`, canonical `data/`, task normalization, progress storage, build state, filtering, sorting, recommendations, and pagination. Reuse behavior before inventing a visual abstraction; a shared visual component is optional when its proportions fight the target.

Keep `three`, `@react-three/fiber`, and `drei` inside the client-only map implementation loaded through `next/dynamic` with `ssr: false`. Shared layout and other routes must not import the Three bundle. Load `map-3d` for map work.

## Frozen accessibility and e2e contracts

Preserve unless the user explicitly changes them and tests change in the same commit:

- brand accessible name `EQUILIBRIUM`;
- nav links Overview, Map, Tasks, Build, Combat, Data;
- footer text `RuneScape is a trademark of Jagex Ltd.`;
- all 11 regions as buttons whose names begin with their display name;
- `0/3`, `3/3`, focusable disabled fourth pick, and `Clear picks`;
- map detail as `section[aria-live]` under the board and ledger;
- `no WebGPU` in the honest fallback.

Do not pin scraped dates or changing Wiki copy in tests.

## Rendered QA

For visual changes: render desktop, inspect and fix the five largest mismatches, render again, then verify phone width. Run a final anti-slop fingerprint audit after the reference match.

Before a direct `main` push, run typecheck, unit tests, affected Playwright stories, full e2e, and build. Confirm screenshots have no overflow or unreadable controls.

Do not reintroduce concept routes, add a UI library for an existing pattern, use Three outside Map, fabricate League data, or preserve weak legacy CSS merely because it exists.
