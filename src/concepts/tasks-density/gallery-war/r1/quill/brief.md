# Quill Index · Gallery War R1

**Codename:** Quill Index  
**Id:** `quill`  
**Skin:** `.td-gw-quill` in `quill.css`  
**Preview:** `QuillPreview.tsx`  
**Scope:** concepts lab only — no production `/tasks` edits.

---

## Thesis (3-second read)

**Facet bar is one dense scroll track.** Every filter — counts, search, My build, tiers, region crests — lives on a single `nowrap` horizontal track with `overflow-x: auto`. Nothing wraps. Nothing stacks a second toolbar line under the first.

That thin track (~2.15rem) **maximizes board height**. Shell claims `calc(100vh - 5.5rem)`. The gallery board is `flex: 1` and takes everything left. Expand stays **in-tile**. No side inspector.

```
┌─ track (scroll-x · never wrap) ──────────────────────────────────────►
│ Index · 42/180 · 120/400 pts · Filter · My build · All Easy… │ Σ 11  …│
├──────────────────────────────────────────────────────────────────────┤
│  tile    tile    tile    tile                                        │
│  tile    tile    tile    tile     ← majority height                  │
│  (expand opens inside the tile)                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Why this topology

| Competitor risk | Quill answer |
|---|---|
| Wrapped multi-line facet bar steals board rows | `flex-wrap: nowrap` + horizontal scroll |
| Tall crest rail eats width | Crests are track chips, not a left rail |
| Permanent inspector column | Expand in-tile only |
| Essay “My build · starters only…” line | Inline note in the track when needed |
| Marketing chrome / card garden void | Editorial carved tiles, dense auto-fill grid |

---

## Feature parity (must work)

| Feature | Where |
|---|---|
| My build | Track chip (`aria-pressed`) |
| Region filter | Crest chips in the same track (+ All Σ) |
| Tier filter | Track chips |
| Search | Debounced via `useTasksDesk` |
| Progress | Tile checkbox → `onToggle` / `saveProgress` |
| Comp% | Mono cell; wiki deep-link when `wikiTaskId` present |
| Detail | In-tile expand: name, description, requirements, Wiki CTA |
| Crest preload | `RegionCrestPreload` for league ids |

No invented tasks. Cap first paint at 120 tiles (filters still apply).

---

## Interaction law

1. **Default:** `selectedId === null` → no tile expanded.
2. **Click / Enter / Space on tile body:** toggle expand for that id.
3. **Checkbox:** `stopPropagation` — complete ≠ expand.
4. **Filter change:** desk hook clears `selectedId`.
5. **Close** button and re-select toggle both collapse.

---

## Visual law

- Scope everything under `.td-gw-quill` (Editorial `--color-*`).
- Gem = pressed chips / selected tile / wiki / pts. Gold = “Index” mark only.
- Names **15px** (`0.9375rem`). Mono tabular for Comp%/pts/counts.
- Track min-height ~2.15rem; shell `calc(100vh - 5.5rem)`.
- No glass, no SaaS cards, no gold buttons, no marketing strip, no decorative glow at rest.

---

## Honest self-score (pre-CEO)

| Axis | Wt | Score /10 | Note |
|---|---|---|---|
| Scan / readability | 25 | **8.8** | 15px names, crest + meta + mono pts; track denser than a multi-line bar, still scannable |
| Viewport fill | 20 | **9.4** | Single-line track + tall shell is the thesis; board is majority height |
| Operability | 20 | **9.0** | Full desk hook; region crests on track; checkbox ≠ expand; wiki + progress |
| Human craft | 15 | **8.6** | Carved medallions, crystal chips, restrained tile surface — not flashy |
| Anti-slop | 10 | **9.2** | No glass/hero/card garden; gold display only; plain empty copy |
| Signature | 10 | **9.3** | “One scroll track, max board” is obvious in 3s vs wrapped bars / rails |
| **Weighted** | | **~9.0** | Pass bar 9.2 — strong thesis, slight cost if track scroll is less discoverable than a wrap |

Hard-fail check: no permanent inspector; no invented data; expand ≠ checkbox; Editorial only; gallery tiles with in-tile expand.

---

## Files

| Path | Role |
|---|---|
| `src/concepts/tasks-density/gallery-war/r1/quill/QuillPreview.tsx` | Preview (`export function QuillPreview`) |
| `src/concepts/tasks-density/gallery-war/r1/quill/quill.css` | Scoped skin `.td-gw-quill` |
| `src/concepts/tasks-density/gallery-war/r1/quill/brief.md` | This brief |
