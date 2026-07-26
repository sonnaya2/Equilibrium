# Team Aperture · Select + Stage — Tasks density R1

**Agents:** aperture-design + aperture-build  
**Codename:** Select + Stage  
**Preview:** `AperturePreview.tsx` · skin `.td-aperture` in `aperture.css`  
**Scope:** concepts lab only — **no** production `TaskRecords` / `globals.css` edits.

---

## Thesis

**No side rail.** Region filter is a `<select>` in the facet bar beside My build (QuestBrowser density). Every horizontal pixel feeds the list. Detail is a **compact inline stage under the selected row** — head stays on the scan line, not a third column.

```
┌─ FACETS: title · count · search · [My build] · <region select> · tier chips ─┐
├─ colhead: □  Task · Region · Tier · Comp% · Pts ────────────────────────────┤
│  □ Kill a goblin…          Global    easy    42%    10                       │
│  ▶ ▣ Burthorpe tasks…      Asgarnia  med     11%    25                       │
│    ┌─ stage ─────────────────────────────────────────────────────────────┐ │
│    │  [crest] name · tier · region · pts · Comp% · desc · Wiki           │ │
│    └─────────────────────────────────────────────────────────────────────┘ │
│  □ …                                                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

Vs rivals:

| Team | Topology |
|---|---|
| Ledger | Full table + crest strip + **bottom drawer** |
| Quarry | Compressed **three-bay** (crest rail + narrow inspector) |
| Spike | Board-first; inspector mounts only when selected |
| **Aperture** | **Zero rail / zero column** — select + inline stage |

---

## Fixed recipe (non-negotiable)

- Editorial Echo tokens only under `.td-aperture` (gem interactive, gold display)
- Crystal facet chips for My build + tiers
- Feature parity: My build, region, tier, search, checkbox progress, Comp% wiki deep-links, virtualization
- Real Catalyst data via `useTasksDesk` / `TasksDensityPreviewProps` — no invented rows
- Names ≥14px (`0.875rem`); mono tabular Comp%/pts
- No gen-AI art; no pvme / leagues.build clones; no new palette

---

## Layout law

1. **One column shell** — facets + optional hint + scroll list. No `aside` rail. No permanent inspector column.
2. **Facet bar is the filter surface** — region lives in `<select>` with counts in option labels; My build is a pressed gem chip; tiers sit right-aligned.
3. **Dense single-line rows** — grid: check · name · region · tier · Comp% · pts. Crest icons stay **out of the list** (scan ink only); crest appears in the inline stage when the region is a League id.
4. **Inline stage** — only on the selected row (`selectedKey === id`). Compact: crest + meta strip + ≤3-line description + requirements/tags + Wiki. Virtualizer remasures via `measureElement` + `virtualizer.measure()` on selection change.
5. **Head-still scan** — Comp%, pts, tier right-aligned mono; region column keeps locality without a left rail hop.
6. **Viewport fill** — shell height `calc(100vh - 9.5rem)`; list flexes to remaining space. No empty third bay.

---

## Hook contract

```ts
useTasksDesk(raw, tiers, { rowEstimatePx: 30 })
formatCompRate / wikiTaskUrl from same module
```

Export: `AperturePreview` · props: `TasksDensityPreviewProps` · CSS import `./aperture.css`.

---

## Hard fails to avoid

- Reintroducing a crest side rail or permanent inspector wider than the list
- Inventing task data or provisional copy presented as official
- Names under 13px
- Gold interactive buttons / SaaS glass cards
- Breaking My build / progress / wiki deep-links / virtualization

---

## Self-score (author)

| Axis | Wt | Score | Note |
|---|---|---|---|
| Viewport fill | 25 | 9.0 | Full-width list; no rail/inspector void; shell fills viewport |
| Scan ergonomics | 20 | 8.8 | 14px names; mono Comp%/pts; region column head-still; stage drops under row |
| Operability | 20 | 9.0 | Full filter set + progress + wiki + virtualization via shared desk |
| Crystal × Data | 15 | 8.5 | Facet chips + carved stage; select replaces crest rail (justified twin-desk evolution) |
| Anti-slop | 10 | 9.0 | Editorial only; no glass/marketing/gold CTAs |
| Signature | 10 | 9.2 | Select-in-facets + inline stage reads in &lt;3s |
| **Weighted** | | **~8.9** | |

Pass bar 9.0 — **borderline pass / honest high-8**. Strength is horizontal reclaim + head-still detail. Risk: default `selected` falls through to first visible row (shared desk behavior), so one stage is almost always open — compact stage keeps the cost low; CEO may still ding permanent detail height vs pure collapsed list.
