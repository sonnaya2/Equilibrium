---
name: equilibrium-ui
description: Binding visual and interaction guidance for RS3 Equilibrium. Use before changing UI, CSS, layout, components, or copy in this repo. Covers the reference-led Tasks browser, route-specific visual identity, shared tokens and assets, accessibility contracts, the map-only Three.js fence, responsive behavior, and mandatory rendered visual QA.
---

# Equilibrium UI

Build a premium public RuneScape 3 League companion. It is a player tool, not a developer console, admin dashboard, marketing site, or generic fantasy template.

## Precedence

1. Follow the user's supplied visual reference and explicit requirements first.
2. Preserve real data, state, accessibility, and provenance while replacing weak presentation.
3. Use this repo skill for product identity. Use global anti-slop skills only as fingerprint detectors; they do not dictate this product's layout, palette, density, or depth.
4. Treat existing components and CSS as reusable code, not immutable design. Replace a limiting shell or selector when the requested screen needs it.
5. Let `rs3-ponytail` constrain dependencies, abstractions, and file count—not visual ambition or the number of rendered comparison passes.
6. When a supplied reference conflicts with a historical tournament decision, the reference wins. Remove the obsolete rule instead of layering overrides around it.

## Product character

Combine:

- the existing warm, near-black Editorial stone ladder for shared grounds;
- layered dark stone surfaces with restrained depth;
- warm gold for display headings and rare structure;
- teal/emerald only for active, focus, and progression state;
- cream primary text and muted desaturated metadata;
- real RuneScape icons, crests, and art as the strongest decoration;
- square or almost-square corners and thin, low-contrast borders.

Avoid SaaS cards, raw form controls, brown spreadsheet matrices, glassmorphism, giant gradients, glowing blobs, literal fake-material textures, generic AI fantasy art, and cloned third-party tool layouts.

Depth may come from spacing, surface changes, dividers, inset highlights, restrained shadows, and faint CSS illumination. A carved 1px border is one option, never the only permitted depth method. Do not outline every surface in gold or muddy olive.

## Anti-clanker floor

Catch recognizable generated shortcuts without flattening the product into a wireframe:

- No colored left-edge callout rails, decorative status dots, rotated diamonds, or alert styling around ordinary provenance copy.
- No route-wide accent wash. Accent color belongs to interaction and data state, not every ground and panel.
- No generic dashboard charts where a compact game-tool readout is clearer; use a distribution track for task tiers.
- No eyebrow label repeated above every heading, badge repeated on every card, idle glow, marketing hero, or filler copy that narrates the interface.
- Badges, dividers, gradients, shadows, and display type are allowed when they communicate real hierarchy or game material. Judge the repeated pattern, not the CSS feature in isolation.
- Treat global anti-slop lists as a review lens. This project skill and the user's reference decide the remedy; do not delete useful depth merely to satisfy a checklist.

## Route identity

| Route | Production direction |
|---|---|
| `/` | plan overview and working plan status; no marketing hero |
| `/map` | interactive map board; 3D board above ledger and detail; no side inspector |
| `/tasks` | Modern League task browser described below |
| `/build` | region, relic, and blessing planner with real art or honest monograms |
| `/combat` | combat calculator with clear calculation hierarchy |
| `/data` | regional research browser with a complete sources inspector |
| `/sources` | Quiet provenance and credits |

Do not force one route's composition onto another. In particular, Data's twin-desk/table language does not constrain Tasks.

## Tasks browser contract

Treat a supplied Tasks redesign reference as the primary visual specification. Match its proportions, hierarchy, spacing, and component scale with live data; do not copy placeholder values.

### Desktop frame

- Use most of the viewport with a `1500-1650px` content cap and responsive outer gutters.
- Lay out header, five summary cards, filter workspace, then task grid plus a `300-340px` progress rail.
- Fit five cards only when they remain readable; fall to four, three, two, then one.
- Keep `8-12px` real gutters between cards. Never merge cards into a bordered matrix.

### Hierarchy

- Page title: `28-34px` display face.
- Section titles: `14-18px`.
- Task titles: `13-15px`, two visible lines.
- Primary figures: `18-24px`.
- Body: `12-14px`; metadata: `10-12px` only where genuinely secondary.
- Do not compress nearly every element to the same 10-12px scale.

### Header and provenance

- Make `TASKS` a strong page title with a short planner description.
- Keep Catalyst visibly labelled as temporary test data, including live/snapshot completion state and verified date.
- Keep the temporary-data label compact and neutral. Put the explanation in plain metadata text with no accent rail, dot, diamond, or alert treatment.
- Never imply Catalyst tasks are Equilibrium tasks.

### Summary cards

- Render five separate cards with an emblem, uppercase label, dominant value, and supporting line.
- Use a CSS or SVG ring for completion where useful; add no chart dependency.
- Derive tasks, points, percentages, build counts, and filter counts from current state.

### Filter workspace

- Style search, region, build toggle, difficulty, skills/categories, status, clear, results, and sort as one deliberate planner workspace.
- Use accessible native controls with custom surfaces and clear focus states.
- Give controls comfortable height and click targets. Do not compress all controls into a single 28px strip.
- Use teal for active state; keep inactive controls quiet and gold sparse.

### Task cards

- Give every card a larger icon well, two-line title, prominent teal points, difficulty, completion rate, and a separated bottom status strip.
- Keep height consistent with real breathing room.
- Use restrained hover: surface and border change only; no lift, neon, or blanket shadow.
- Preserve exact source qualifiers such as `<0.1%`.
- Paginate approximately `30-50` records. Do not mount the full corpus without evidence.

### Progress rail

- Build distinct Overall progress, Milestone rewards, Recommended next, and Difficulty breakdown modules.
- Use a visible CSS/SVG progress indicator and a compact horizontal tier-distribution track. A generic dashboard donut is not the default.
- Show three or four deterministic unfinished recommendations with icons and points.
- Render an intentional empty state for unpublished Equilibrium rewards. Never import Catalyst reward rules or invent milestones.

### Responsive behavior

- Move the rail beneath the grid on tablet.
- Use two cards on small tablet and one on phone.
- Collapse or stack filters on phone and use a two-column or horizontal stats treatment.
- Prevent page-level horizontal overflow. Desktop remains the primary composition.

## Tokens and stack

Use Next.js App Router, React `19.2.8`, and Tailwind v4 CSS-first tokens in `app/globals.css`. There is no `tailwind.config`.

Use Cinzel through `--font-display` for selective display hierarchy, system sans for reading, and mono/tabular numerals only where comparison benefits. Do not make the entire interface monospace.

Existing Editorial tokens are the starting palette:

```text
parch: readable cream and muted text
stone: dark grounds, panels, inset and structural lines
gold: display headings and rare structure
gem: active, focus and progression state
path: Order, Chaos and Balance data semantics only
```

Prefer token-based `color-mix()` and route-scoped CSS. New route tokens are allowed when a supplied reference genuinely needs a different material; define them centrally, document their role, and keep JSX free of inline hex.
Do not mix `gem` into all route surfaces. A route-specific palette needs an explicit visual reference or user request, not novelty for its own sake.

## Shared code and art

Reuse behavior and data helpers before creating replacements:

- `Page`, `Nav`, `GameIcon`, `RegionCrest`, `@/lib/gameArt`;
- task normalization, progress storage, build state, filters, sorting, aggregation, recommendations, and pagination;
- canonical JSON under `data/` and existing `SourceReference` provenance.

Shared visual components are optional when their proportions fight the target. Do not fork task models or state just to restyle the route.

Use extracted game art and credited Wiki imagery where licensed. Art is available under `assets/rs3/` and published through `public/game/`. Do not generate AI art or copy pvme, rs-analysis, or leagues.build layouts, components, class names, or wording.

## Three.js fence

Keep `three`, `@react-three/fiber`, and `drei` inside the client-only map implementation, loaded with `next/dynamic` and `ssr: false`. Tasks and shared layout code must not import the Three bundle.

## Frozen accessibility and e2e contracts

Update tests in the same change when intentionally changing structure. Preserve:

- brand link accessible name `EQUILIBRIUM`;
- primary nav links Overview, Map, Tasks, Build, Combat, Data;
- footer text `RuneScape is a trademark of Jagex Ltd.`;
- all 11 map regions as buttons whose names start with the display name;
- `0/3`, `3/3`, focusable disabled fourth pick, and `Clear picks`;
- map region detail as `section[aria-live]` under the board/ledger;
- `no WebGPU` in the honest fallback.

Do not pin scraped dates or changing Wiki copy.

## Rendered QA loop

Do not call a visual change complete from source inspection or a successful build.

1. Render the real route at a desktop viewport comparable to the reference.
2. Capture and inspect it.
3. Write down the five largest visible mismatches.
4. Fix all five.
5. Render and inspect again, including phone width.
6. Repeat until proportions, hierarchy, spacing, surfaces, and state treatments are genuinely close.

Run a fingerprint audit after the visual match. The audit catches SaaS, AI-slop, fake texture, uncontrolled glow, and marketing copy; it must not flatten deliberate game-UI depth or overrule the supplied reference.

## Verification

- Run `npm run typecheck` and `npm test`.
- Run route-specific Playwright stories for changed interactions.
- Run `npm run test:e2e` before merge and report unrelated failures honestly.
- Run `npm run build`.
- Confirm desktop and phone screenshots have no overflow or unreadable controls.

## Do not

- Preserve ugly legacy CSS merely because it exists.
- Reintroduce `app/concepts/` or `src/concepts/`.
- Add component, chart, animation, or state libraries for Tasks.
- Put a marketing hero on a working route.
- Use Three.js outside the map.
- Fabricate unrevealed League data.
- Let historical tournament names substitute for a current visual specification.
