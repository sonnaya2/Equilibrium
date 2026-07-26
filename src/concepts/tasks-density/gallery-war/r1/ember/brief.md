# Team Ember · Ember Plate — Gallery War R1

**Codename:** Ember Plate  
**Preview:** `EmberPreview.tsx` · skin `.td-gw-ember` in `ember.css`  
**Scope:** concepts lab only — **no** production `/tasks` edits.

---

## Thesis

**Stronger gem facet edge; selected tile is a lit plate.**

Gallery tiles (Herald topology) but denser packing and a material signature: every card carries a crystal facet lip (top + lead edge). Selection does not merely tint the border — it **lights the plate** (raised stage wash, full-bevel gem inset, foot strip brightens). Checkbox stays decoupled from expand.

```
┌─ FACETS: title · count · search · [My build] · <region> · tiers ─────────────┐
├─ board (auto-fill minmax denser than Herald) ────────────────────────────────┤
│  ┌ facet plate ┐  ┌ facet plate ┐  ┌ LIT PLATE ──┐                           │
│  │ crest □ name│  │ …           │  │ crest □ name│  expand in-tile           │
│  │ pts · Comp% │  │             │  │ detail body │                           │
│  └─────────────┘  └─────────────┘  └─────────────┘                           │
└──────────────────────────────────────────────────────────────────────────────┘
```

Vs Herald: tighter `minmax`, shorter tile chrome, crest 28 vs 36, facet lip at rest, lit-plate on select (not thin gem ring alone).

---

## Fixed recipe (non-negotiable)

- `useTasksDesk` + `TasksDensityPreviewProps` — real Catalyst rows only
- Gallery tiles · expand **in-tile** · checkbox **decoupled** (stopPropagation)
- Editorial tokens under `.td-gw-ember` (gem interactive, gold display only)
- My build · region select · tier chips · search · Comp% wiki · progress
- Names ≥14px; mono tabular pts/Comp%
- No permanent right inspector · no invented data · no gen-AI · denser than Herald

---

## Layout law

1. One shell: facet bar + optional My-build hint + scroll board. No side rail.
2. Grid `auto-fill` with **smaller minmax** than Herald so 1440 fills more columns.
3. Tile anatomy: crest medallion · checkbox · name/meta · pts/Comp% · foot strip.
4. Expand mounts inside the card only; Close + Wiki in detail.
5. Cap first paint at 120 tiles (filters still apply) — same operability band as Herald.
6. Shell height fills viewport chrome; board flexes.

---

## Signature (score this)

| Rest | Selected (`is-on`) |
|---|---|
| Stone plate + gem **facet lip** (top + lead inset) | **Lit plate** — full bevel gem inset, raised wash, foot gem line |
| Carved crest well | Crest well picks up gem carve |

Do not idle-glow the board. Light is selection-only.

---

## Hook contract

```ts
useTasksDesk(raw, tiers, { rowEstimatePx: 140 })
formatCompRate / wikiTaskUrl from same module
```

Export: `EmberPreview` · props: `TasksDensityPreviewProps` · CSS `./ember.css`.

---

## Hard fails to avoid

- Expand toggles checkbox (or checkbox expands)
- Permanent inspector column
- New palette / gold chrome / SaaS glass garden
- Names under 13px · card-garden void · marketing copy
- Invented tasks or provisional-as-official

---

## Self-score (author)

| Axis | Wt | Score | Note |
|---|---|---|---|
| Scan / readability | 25 | 8.8 | Crest + name + mono pts; denser meta still ≥14px names |
| Viewport fill | 20 | 9.0 | Tighter minmax vs Herald; shell fill; 120-cap board |
| Operability | 20 | 9.0 | Full desk filters, progress, wiki, in-tile expand |
| Human craft | 15 | 8.9 | Facet lip + lit plate material; carved crest well |
| Anti-slop | 10 | 9.0 | Editorial only; no idle glow; no gold active |
| Signature | 10 | 9.1 | Lit plate is the read from across the board |
| **Weighted** | | **8.95** | Contender; needs live CEO eye on lit-plate vs noise |

Pass bar 9.2 — honest under; density + signature are the climb path, not paint.
