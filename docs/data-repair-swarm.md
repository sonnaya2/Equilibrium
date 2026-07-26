# Data repair swarm — remaining risks

**Date:** 2026-07-26  
**Scope:** post wall-slam / foreign-upgrade / catalog hygiene swarm  
**Status:** hard gate (`audit-still-fucked`) reports **0 hard issues**; residual risk is policy drift and multi-host ambiguity, not broken schema.

Canonical catalog: `data/research/catalog.json`  
Observation inputs: `wall-slam/I-contradictions.json`, `wall-slam/G-wiki-verify.json`, `scraped-data/audit-still-fucked-2026-07-26.txt`, applied user-ruling scrapes under `scraped-data/`.

---

## Gate snapshot (2026-07-26)

| Metric | Value | Risk |
|--------|------:|------|
| Hard issues | 0 | Clean for ship on structure |
| Total upgrades | 1024 | Size is fine; density agents still fight completeness agents |
| Multi-host rows | 42 | Legitimate multi + residual mega-packages |
| Empty-req multi | 2 | Sirenic craft ladder (see below) |
| Single-req pollution | 1 | Area Tasks overview hosts many, req only tirannwn |
| Multi-req outside hosts | 4 | Masterwork stack rows (hosts superset of req) |
| Unobtainable families | 4 | Expect under 3-elective cap; must stay tagged |
| Intra/near dups / orphan anchors | 0 | Hygiene pass held |

---

## Open contradictions (agents still disagree)

Source of truth for disagreements: [`wall-slam/I-contradictions.json`](../wall-slam/I-contradictions.json).

### Needs a user ruling (`askUser: true`)

1. **POH portal towns package**  
   Multi-region geography vs planner poison (`all_required` on seven regions).  
   Options: multi hosts with pressure-only (drop hard all-required), primary Asgarnia/Rimmington only, or remove as pure convenience.  
   **Risk if wrong:** region planner lights seven hard picks for a house instance that is not region-owned.

### Recommend already settled — watch for catalog drift

| Item | Recommend | Drift risk |
|------|-----------|------------|
| Artificer's measure | Single host `anachronia` + 4-region req + UNOBTAINABLE | Catalog still shows 4 hosts; primary-home agents re-expand |
| POH gilded altar | Restore multi powder/burner hosts per KEEP ruling | Catalog drifted to asgarnia + empty req |
| Tool progression checklists | Remove umbrella checklists; keep piece rows | Density vs completeness agents re-add checklists |
| Sirenic T90 / elite ladder | Multi-source wall; empty-req multi still listed | Hosts `kandarin,forinthry` without requiredRegions |

---

## Residual catalog smells (not hard fails)

### Empty-req multi-host

- `Sirenic armour (T90 ranged power craft)` @ kandarin, forinthry  
- `Sirenic → elite sirenic armour` @ kandarin, forinthry  

Planner can show both hosts as open without a hard chain. Either attach real reqs (scale + components) or demote one host to detail/pressure.

### Single-req pollution

- `Area Tasks (achievement diaries) skilling overview` — many diary hosts, `req = [tirannwn]` only.  
  Reads as “needs Tirannwn for any diary,” which is wrong. Prefer empty req + per-region detail, or split per-region rows.

### Multi hosts outside requiredRegions

Masterwork pressure stacks (plate/Orthen, spear, staff, bow) list a craft/home host that is not in `requiredRegions`.  
**Risk:** elective planner marks the home region as optional while the row still lights there. Align hosts ⊆ required ∪ explicit “display-only home” policy.

### Unobtainable families (intentional)

Four unobtainable families remain under the 3-elective cap. Keep UNOBTAINABLE tags; never silently promote to obtainable without a launch rebench.

---

## Typecheck / concept lab fence

| Path | In production typecheck? | Notes |
|------|--------------------------|-------|
| `src/combat`, `src/league`, `src/map`, `src/tasks`, `src/research`, `src/components`, `src/lib` | Yes | Production |
| `app/{page,map,tasks,build,combat,data,sources}` | Yes | Production routes |
| `src/concepts/tasks-density/useTasksDesk.ts` | Yes | Imported by production `TaskRecords` |
| `src/concepts/map-remaster/**` | **Excluded** | WIP WebGPU remaster skins |
| `app/concepts/map-remaster/**` | **Excluded** | Lab pages that re-import remaster (must exclude with source so TS does not re-enter via import) |
| Other `src/concepts/**` / `app/concepts/**` | Yes (lab) | Tournament mocks; not production UX but still typechecked |

`tsconfig.json` exclude:

```json
"exclude": [
  "node_modules",
  "src/concepts/map-remaster",
  "app/concepts/map-remaster"
]
```

Do **not** exclude `useTasksDesk` or other production-imported modules. Do **not** exclude production `src/map` (real wartable).

---

## Process risks (swarm ops)

1. **Ruling vs scrape order** — Prefer applied user rulings over `wall-slam-input` when they conflict (`I-contradictions` policy). Agents that only read the input file reintroduce deleted mega-chains.  
2. **Checklist vs piece rows** — `wall-slam-apply-high.mjs` already codes remove-checklist; completeness agents re-add umbrellas.  
3. **Host count semantics** — “Multi-ok so every pressure region lights” vs “single primary home + requiredRegions.” Repo style after rulings: single primary when user said KEEP single host; multi only for true multi-source obtain paths.  
4. **No GE / ironman** — Never invent trade paths to “fix” unobtainable under 3 electives.  
5. **Deploy is main** — Any push to `main` ships. Run `npx tsc --noEmit`, `npm test`, and preferably `npm run build` before merge.

---

## Recommended next actions

1. User answer on POH portals (only open askUser item).  
2. One surgical patch: Sirenic empty-req multi + Area Tasks single-req pollution.  
3. Re-apply gilded altar multi hosts if still asgarnia-only.  
4. Re-run `node scripts/report-still-fucked.mjs` after any catalog write.  
5. Keep map-remaster out of `tsc` until skins share production material factories (or remaster TSL graphs are typed clean under r185).

---

## Verify commands

```text
npx tsc --noEmit
npm test
npm run build
# or: pwsh tools/_run_gates.ps1
```

Optional data gates:

```text
npm run audit:data
node scripts/report-still-fucked.mjs
```

### Gate status for this agent pass

| Gate | Status | Notes |
|------|--------|-------|
| `tsconfig` exclude map-remaster (+ app routes) | Done | Production does not import remaster |
| Production ReactNode/CSSProperties imports | Done | explicit type imports in layout/Hex/Stat/VineFrame |
| `npx tsc --noEmit` | **Run locally** | This subagent session has no shell executor; use the commands above |
| `npm test` | **Run locally** | Same |
