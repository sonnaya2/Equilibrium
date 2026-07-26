# Handoff: 3D Gielinor Map

> **Superseded — read `docs/wartable-plan.md` instead.** Kept for its settled
> decisions and its WebGPU/TSL constraints, which still hold. Everything this
> file says about the *current state* is stale: the pages are no longer stubs,
> `data/league/` is populated, the 3D libraries are installed, and the map has
> shipped through P3 (rings, flat SVG board, extruded slabs, camera framings).
> Decision #2 has also been corrected — wiki and game art are usable.

**For:** Kimi V3
**Repo:** https://github.com/sonnaya2/Equilibrium — public, default branch `main`
**Live:** https://equilibrium-ruddy.vercel.app

---

## Context

RS3 Equilibrium is a companion tool for RuneScape 3's **Leagues II: Equilibrium** (launches 10 Aug 2026). Read `AGENTS.md` first — it is the project brief and it is binding.

The repo is a working Next.js scaffold with a real combat engine underway, but **every page is a stub**. `app/map/page.tsx` renders `<Stub title="Map" note="Region unlock map. Not built yet." />`. This handoff builds that map: a WebGPU-rendered 3D Gielinor themed around the League's region-unlock system, at maximum RS3/Dragonwilds fidelity, that doubles as the actual region planner.

**Settled decisions — do not reopen:**

1. **WebGPU + TSL nodes, no WebGL fallback.** Maximum ceiling. Consequences spelled out below.
2. **Terrain is original stylized geometry, and wiki/game art is fair game to build it from.** Trace heightmaps, sample the world map, and use extracted game assets — the RuneScape Wiki is CC BY-NC-SA 3.0 and this is a free fan tool, so attribute it and keep it non-commercial. What stays banned is copying another *tool's* design: pvme.io, rs-analysis.xyz and leagues.build are for facts and lessons, never their layout, components or markup.
3. **Planner first, cinematic second.** The map *is* the region-unlock planner; spectacle serves navigation.
4. **You have full authority.** Deploy, install, use Context7, Playwright, the Vercel MCP, whatever you need. Use the latest version of everything.

---

## Current state — verified, not assumed

| Thing | State |
|---|---|
| Git | Initialized, on `main`, remote set |
| Playwright | Test runner installed (`test:e2e`, port 3100); MCP server **not** configured |
| Vercel project | `equilibrium` already exists, scope `ever-sense`, git-connected |
| `app/map/page.tsx` | `<Stub />` |
| `data/league/regions.json` | `{"lastSynced": null, "verified": false, "records": []}` — **empty** |
| `src/league/index.ts` | `export {}` — TODO only |
| `scripts/sync-league-data.ts` | **Disabled** (intentionally exits 1) — incompatible blessings/relics envelope; use `npm run normalize:data` |
| `public/` | Empty |
| 3D libraries | **None installed** |
| `src/combat/` | Real code, 18 tests passing |
| `.mcp.json` | **Missing** — Playwright not wired up here (see Tooling) |

Stack: Next `16.2.11`, React `19.2.8`, Tailwind v4 (`@theme` in `app/globals.css`), TypeScript 5.9, Vitest 4. Next and React are already current.

Latest published at time of writing: `three` **0.185.1**, `@react-three/fiber` **9.6.1**, `@react-three/drei` **10.7.7**.

---

## Deploys are live — there is no staging gate

The Vercel project is git-connected. **Any push to `main` ships straight to production.** Verify locally before every push:

```bash
npm run typecheck && npm test && npm run build
```

The repo is **public** — never commit secrets. Git identity is set repo-locally to the noreply address (`299354192+sonnaya2@users.noreply.github.com`) because GitHub blocks pushes that would publish the private one. Do not override it.

After a push, confirm the deploy actually succeeded using the Vercel MCP rather than assuming: check build logs, then runtime errors. A green push is not a green deploy.

---

## What WebGPU-only actually costs you

Accept these up front rather than discovering them in week two.

- **`@react-three/postprocessing` and `postprocessing` are WebGL-only. Do not install them.** The whole effect chain is TSL nodes instead.
- **`PostProcessing` was renamed to `RenderPipeline` in r183.** You are on r185. Any example using `new THREE.PostProcessing(renderer)` is stale.
- **You render with `renderPipeline.render()`, not `renderer.render()`.** Under R3F this means taking over the render loop — `useFrame` with priority ≥ 1 disables R3F's automatic render. Verify exact semantics against current R3F docs via Context7 before building on it.
- **Much of drei assumes WebGL materials.** Test each component you reach for; expect some to be unusable, and write the 30 lines yourself rather than fight it.
- **Import from `three/webgpu`, not `three`.** Node materials are `meshStandardNodeMaterial` and friends.
- **Safari/iOS coverage is incomplete and there is no fallback by choice.** Ship an honest unsupported state — detect missing WebGPU, render a clear explanation plus a static region list so the planner still works. A blank canvas is a bug, not a fallback.

Canvas wiring, verified shape:

```tsx
import * as THREE from 'three/webgpu'
import { Canvas, extend } from '@react-three/fiber'

extend(THREE as any)

<Canvas gl={async (props) => {
  const renderer = new THREE.WebGPURenderer(props as any)
  await renderer.init()
  return renderer
}} />
```

Effect chain, verified shape (r183+ API):

```js
import { pass, mrt, output, emissive } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

const renderPipeline = new THREE.RenderPipeline(renderer)
const scenePass = pass(scene, camera)
scenePass.setMRT(mrt({ output, emissive }))

const bloomPass = bloom(scenePass.getTextureNode('emissive'))
renderPipeline.outputNode = scenePass.getTextureNode('output').add(bloomPass)
```

---

## The architectural rule that matters most

`AGENTS.md` forbids presenting unverified numbers, and `data/league/regions.json` is deliberately empty until Wiki-verified. **The map must not wait for that, and must not violate it.**

Split the two cleanly:

- **Region *shape* is our own art asset.** Landmass geometry, biome identity, colour, position, camera anchor. Lives in `src/map/data/regionShapes.ts`. Authored by us, no `SourceReference` obligation, ships today.
- **Region *gameplay data* stays in the verified pipeline.** Unlock cost, task point thresholds, what a region gates. Stays in `data/league/regions.json`, stays empty until verified, **joined at render time** by region id.

The map renders fully with zero gameplay data. Where a region has no verified numbers, show an explicit "not yet verified" state — never a plausible-looking zero. This is the whole reason the map can ship before launch without breaking a hard invariant.

Eleven region ids, from `AGENTS.md`: `misthalin`, `havenhythe`, `karamja`, `asgarnia`, `kandarin`, `fremennik`, `forinthry`, `desert`, `morytania`, `tirannwn`, `anachronia`. Misthalin and Havenhythe are the starting pair; Karamja is the first milestone unlock.

Official reveal UI confirms the cap: **six regions are ever unlockable** — "You have unlocked 2/6 regions" (the two fixed starts, Karamja, then three of the remaining eight). In-game display names differ from ids and live in `regionShapes.ts`: `desert` = Kharidian Desert, `forinthry` = Wilderness, `fremennik` = Fremennik Province.

---

## What the map plugs into

The map is the planner's hub — region unlocks gate everything downstream. Four systems consume unlock state. **None of them exist yet; all are stubs, and every `data/league/*.json` and `data/combat/*.json` file is an empty envelope.** Define the seams now or the map ships as an island.

### Region unlock state — one source of truth

Model in `src/league/index.ts`, persistence in `src/lib/storage.ts`. Both are TODO stubs today.

The map **renders and mutates** unlock state. It does **not own** it. Tasks, Build, and Combat all read the same store. If the map keeps a private copy you have created a second source of truth, which `rs3-ponytail` explicitly forbids.

Shape: the selected region set plus derived unlock order. Misthalin and Havenhythe are fixed, Karamja is the first milestone, then three more from the remaining eight — you cannot unlock everything, and that tradeoff is the entire point of the planner. Persist to localStorage. Everything downstream derives from this; never duplicate it.

**In scope for this handoff:** the store, and the map's read/write of it. **Not in scope:** the consumers below.

### Task system

`data/league/tasks.json` may still be empty until launch data exists. `npm run sync:league` / `scripts/sync-league-data.ts` is **disabled** (exits 1; would write an incompatible schema). League planner JSON is owned by `npm run normalize:data`. Tasks are region-gated, tiered Easy→Master at 10–400 points, and points drive both the League Trophy tier and Relic tier unlocks.

The map's surface is a per-region summary — task count and points available — joined at render time. Until verified data exists, show the explicit unverified state. **The map must not reimplement task tracking**; `/tasks` owns that interface.

### DPS calculator and rotations

`AGENTS.md` already specifies the boundary:

```ts
calculateCombat(baseState, { ruleset: "equilibrium", relics, blessings, regions })
```

Regions are already an input. Region unlocks gate gear, abilities, and therefore which rotations are even viable. `src/combat/league/ruleset.ts` is where regions, relics, and blessings become `CombatModifier[]` — stub today, and it must stay layered on top of base combat, never merged in.

**The map's only job here is handing the selected region set to that call.** It does not compute damage. Do not touch `src/combat/` in this handoff.

### BiS per region combination

This is the feature that makes the map a planner rather than a picture: *which regions should I unlock for maximum DPS*.

The search space is tiny — three chosen from eight after the fixed starts is 56 combinations. When it lands, brute-force it. **Do not build a solver framework**, and do not add one now: it is blocked on verified equipment and task data, and faking those violates a hard invariant.

Mark the seam when you reach it:

```ts
// ponytail: brute-force 56 region combos; revisit only if the region count
// or constraint model grows beyond a trivial search.
```

### Scope boundary

| Build now | Leave alone |
|---|---|
| Unlock store + persistence | Task tracking UI (`/tasks`) |
| Map UI over that store | Damage engine (`src/combat/`) |
| Render-time join to verified data | BiS search, rotation sim |
| Explicit unverified states | Relic/blessing progression UI |

Those are their own handoffs. Building them here would blow the scope and duplicate work that belongs elsewhere.

---

## Two constraints that will bite you

**1. React version float.** `@react-three/fiber@9` declares peer `react: ">=19 <19.3"`. `package.json` has `^19.2.8`, which lets npm resolve 19.3+ and break the peer range. Pin React and React DOM to exact `19.2.8`, or add an `overrides` block, in the same commit as the 3D install.

**2. The root layout constrains width.** `app/layout.tsx` wraps children in `<main className="mx-auto max-w-6xl px-4 py-8">`. A full-bleed map cannot live inside that. Do **not** hack around it with `w-screen left-1/2 -translate-x-1/2`.

Instead: strip the container from the root `<main>`, add `src/components/Page.tsx` carrying `mx-auto max-w-6xl px-4 py-8`, wrap the six existing stub pages in it. Small honest refactor, one commit, before any 3D work.

---

## Tooling available to you

**Skills** — all in the generic location `~/.agents/skills/`:

| Skill | Use for |
|---|---|
| `rs3-ponytail` | Lean-code policy for this repo. Map/UI work is **Full** intensity; the combat core is **Lite** — do not touch it here. |
| `no-slop-ui` | Law for any UI work. Load before styling anything. |
| `ui-humanizer` | Surgery on generic-AI-looking UI. |
| `text-humanizer` | All user-facing copy, labels, empty states. |
| `bot-audit` | Pre-ship pass. `AGENTS.md` requires this before a screen is shippable. |
| `data-readability` | Dense numeric panels — region stats, costs, thresholds. |
| `human-grade` | Router for substantial UI creation and final review. |
| `find-docs` | Current library APIs. Do not write 3D APIs from memory. |

**Install this before starting** — purpose-built for this exact task, carries the full TSL / compute / post-processing reference:

```text
https://github.com/dgreenheck/webgpu-claude-skill  →  skills/webgpu-threejs-tsl/
```

**Context7 MCP** — `resolve-library-id` then `query-docs`. Use it for every three.js, R3F, drei, and Next.js API question. The `RenderPipeline` rename above was caught this way; training data is stale on r185. One concept per query.

**Playwright — two different things, both useful. Do not confuse them.**

*The test runner* is already installed: `@playwright/test`, `playwright.config.ts`, `npm run test:e2e`, tests in `e2e/`, chromium, dev server on **port 3100** (3000 is permanently taken by EverSense on this machine — do not change it back). Use this for committed regression tests.

*The MCP server* is agent-driven browser control — screenshots, console, network, live interaction. It is **not configured**. Add `.mcp.json` at the repo root before UI verification:

```json
{
  "mcpServers": {
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--browser", "msedge", "--viewport-size", "1440,900"],
      "env": {}
    }
  }
}
```

Edge is the right choice here — Chromium-based, so WebGPU works. Use it for screenshots, console errors, network, and interaction testing.

**Vercel MCP** — team `ever-sense` (`team_kaAQ03A21I4qeDJE1GrAfzbP`), project `equilibrium`. Useful calls: `list_deployments`, `get_deployment_build_logs` (with `errorsOnly`), `get_runtime_errors`, `get_runtime_logs`, `get_web_analytics`, `search_vercel_documentation`, `web_fetch_vercel_url`.

---

## Dependencies

```bash
npm i three @react-three/fiber @react-three/drei
npm i -D @types/three
```

Nothing else. No postprocessing packages. No state library — R3F ships zustand internally if component state genuinely fails. No animation library until something measurably needs one.

---

## Proposed structure

Keep it flat until a folder earns splitting.

```
src/map/
  MapScene.tsx           Canvas host, WebGPU init, support gate
  pipeline/              RenderPipeline + TSL effect chain
  terrain/               region mesh generation, shared node material
  regions/               region meshes, hover/pick handling
  camera/                rig, focus transitions, intro flythrough
  fx/                    water, atmosphere, motes, god rays
  state/                 unlock + selection state, localStorage
  data/regionShapes.ts   OUR authored geometry + biome metadata
```

`app/map/page.tsx` stays a thin server component that dynamically imports `MapScene` with `ssr: false` and renders a loading state. The three.js bundle is large; do not let it block LCP on other routes.

---

## Visual direction — Guthixian, not fire

The league's brand is **earthy nature under the tension of three gods**: Zamorak (Chaos), Saradomin (Order), Guthix (Balance). Official reveal material sets the language: a swirling green vortex wrapped in autumn roots, hexagonal emerald relic icons, gem-pip progress bars, glowing leaves and butterflies, dark stone/wood panels with carved brass-gold serif lettering, and locked regions walled off by dark root-and-crystal overgrowth. **Fire is not the theme** — never render league chrome as flame, lava, or ember.

Target the *feel* of RS3 and Dragonwilds through material, light, and silhouette — never by copying assets.

- **Motifs:** the hexagon (region markers, relic/tier icons, pip progress bars), root/thorn overgrowth (locked states), leaves/butterflies/motes (idle life), the green vortex (unlock moments, hero accents).
- **Palette:** extend the existing `@theme` in `app/globals.css`. Brass `#c9a227`, stone, and parchment are the chrome — they already match the in-game league panel. Add an emerald/gem ramp (relic-hex teal-green down to deep Guthix forest) and the god-path triad: Chaos deep red, Order ceremonial blue, Balance verdant green — used anywhere blessings or paths surface.
- **Type:** carved serif display (Trajan-adjacent, Cinzel via `next/font`) for headings, system sans for body, mono for numbers.
- **Per-region biome identity** (geography, not league chrome): Misthalin green lowland, Karamja jungle over black volcanic rock, Kharidian Desert dune light, Morytania purple swamp gloom, Fremennik snow and grey sea, Tirannwn elven canopy, Anachronia prehistoric overgrowth, Forinthry dead wilderness, Asgarnia mountains, Kandarin coast, Havenhythe port.
- **Locked vs unlocked is the core visual language.** Locked is dormant nature: desaturated landmass wrapped in dark root-and-crystal growth, gem dim. Unlocked is the growth receding: verdant colour returns, emerald gem-light swells, leaves and butterflies rise. Legible at a glance with no legend.
- **Lighting:** soft verdant key with strong rim separation, canopy god rays, volumetric mist. Stylized painterly, not photoreal.

**Use MRT selective bloom for the unlock glow** (shape shown above). Bloom only the emissive target, and the emissive is emerald — unlocked regions get genuine gem-light without the scene washing out. This is the right technique for the core visual mechanic, not a nice-to-have.

**Animations**

- Intro: orbital descent onto the world, once, skippable.
- Region focus: cinematic camera arc with depth-of-field settle.
- Unlock: root-and-crystal growth recedes into the ground, light returns, emerald bloom swells, butterflies scatter.
- Idle: cloud drift, water flow, falling leaves, butterfly motes. WebGPU compute is the right tool for particle motion.

**`prefers-reduced-motion` is not optional.** Flythrough becomes a hard cut, camera arcs become instant, idle motion stops. Accessibility is on the never-simplify list.

---

## Performance budget

Acceptance criteria, not aspirations.

- 60fps at 1440p on a mid-range discrete GPU.
- Instance and merge region geometry; no per-region draw call explosion.
- LOD on terrain meshes; frustum culling on.
- Adaptive resolution — degrade DPR before dropping frames.
- Lazy-load the entire 3D bundle. Other routes must not pay for it.
- Dispose geometries, node materials, and render targets on unmount. Verify no GPU memory climb across repeated route navigation.

Measure and report real numbers. "Feels smooth" is not a measurement.

---

## Build order

Ship each step working, verified, and pushed. Do not build all eleven then integrate. Remember every push is a production deploy.

1. `.mcp.json` for Playwright. Layout de-containerization + `Page` wrapper, stub pages rewrapped.
2. Dependencies installed, React pinned.
3. WebGPU support gate + honest unsupported state, before any scene work.
4. `regionShapes.ts` — eleven regions, geometry, biome metadata, camera anchors.
5. **Unlock store** in `src/league/` + `src/lib/storage.ts`, with the unlock rules (fixed starts, Karamja milestone, three-of-eight cap) and localStorage persistence. Headless and unit-tested before any visual depends on it.
6. `MapScene` rendering static terrain with node materials and lighting, no interaction.
7. `RenderPipeline` + base TSL effect chain.
8. Locked/unlocked visual states driven by the store, MRT selective bloom.
9. Hover, pick, region focus camera.
10. Atmospherics, water, compute-driven idle motion.
11. Intro flythrough + reduced-motion paths.
12. Region detail panel joined to `data/league/regions.json` with explicit unverified states.

Step 5 is the one people skip. Do not — the unlock rules are real logic with real constraints, and `rs3-ponytail` requires non-trivial logic to leave a runnable check behind. Vitest is already configured.

---

## Verification

Local, before every push:

```bash
npm run typecheck && npm test && npm run build
```

Add `npm run test:e2e` once there are `e2e/` specs worth running.

Browser verification is required for every UI step, per `AGENTS.md`:

- Render `/map`; check console for errors and WebGPU adapter warnings.
- Screenshot desktop and mobile viewports.
- Confirm the frame budget with a real frame capture and real numbers.
- Verify the unsupported-browser path renders the explanation and static region list, not a blank canvas.
- Toggle `prefers-reduced-motion` and confirm motion actually stops.
- Navigate away and back repeatedly; confirm GPU memory does not climb.
- Confirm other routes did not regress bundle size.
- Run `bot-audit`; verdict must be `PASSES` or carry only documented `SMELL` findings.

After every push, against production:

- `get_deployment_build_logs` with `errorsOnly` — confirm the build actually succeeded.
- `get_runtime_errors` — confirm nothing is erroring live.
- Playwright against https://equilibrium-ruddy.vercel.app — confirm the deployed map renders, not just the local one.

Return **BLOCKED** rather than claiming visual verification you did not perform.

---

## Do not

- Copy geometry, textures, markup, or copy from Jagex, the wiki, rs-analysis, or pvme.
- Install `postprocessing` or `@react-three/postprocessing` — WebGL-only.
- Use `THREE.PostProcessing` — renamed to `RenderPipeline` in r183.
- Put map geometry into `data/league/regions.json`, or unverified gameplay numbers anywhere.
- Keep unlock state private to the map — one store, shared with Tasks, Build, and Combat.
- Build task tracking, BiS search, rotation sim, or the damage engine here. Separate handoffs.
- Touch `src/combat/` — out of scope, Lite intensity.
- Add top-level nav items beyond the existing six.
- Commit secrets — the repo is public.
- Push without a local green `typecheck`, `test`, and `build`. There is no staging gate.
