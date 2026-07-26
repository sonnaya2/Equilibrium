# Cipher Strip · Gallery War R1

**Codename:** Cipher Strip  
**Id:** `cipher`  
**Preview:** `CipherPreview.tsx` · skin `.td-gw-cipher` in `cipher.css`  
**Scope:** concepts lab only — no production `/tasks` edits.

---

## Thesis

**Compact mono meta ribbon for Comp%/pts; scan-first card.**

Gallery topology (no side inspector). Each tile is a short scan card: name + crest + checkbox on the head, then a **cipher ribbon** — one mono tabular strip that owns Comp%, pts, tier, and region. Detail expands **inside the tile**. Checkbox never toggles expand.

```
┌─ FACETS: Cipher · count · search · [My build] · region · tiers ───────────┐
│  ┌─────────────────────────┐  ┌─────────────────────────┐
│  │ □  [crest] Task name    │  │ □  [crest] Task name    │
│  │ ┌─ cipher ribbon ─────┐ │  │ ┌─ cipher ribbon ─────┐ │
│  │ │ easy · Global  42% 10│ │  │ │ hard · Asgarnia 3% 25│ │
│  │ └─────────────────────┘ │  │ └─────────────────────┘ │
│  │ (expand in-tile…)       │  │                         │
│  └─────────────────────────┘  └─────────────────────────┘
└───────────────────────────────────────────────────────────────────────────┘
```

Vs Herald baseline: less crest theater, denser board, **data strip first** after the name — Comp%/pts sit on one fixed mono baseline so the eye columns them across the grid.

---

## Fixed recipe

- `useTasksDesk` + real Catalyst props — no invented rows
- Gallery grid; expand **in-tile** only
- Checkbox `stopPropagation` — complete ≠ expand
- Editorial Echo tokens under `.td-gw-cipher` only
- Crystal facet chips; gem interactive / gold display
- Names ≥14px; mono + tabular-nums on the ribbon
- Comp% wiki deep-links; My build / region / tier / search / progress
- Humanizer: no marketing copy, no glass garden, no gold CTAs

---

## Signature bet

The **cipher ribbon** is the product. Everything else stays quiet stone so the mono strip can carry scan load. If the ribbon does not read as a distinct instrument in &lt;3s, the fighter fails Signature.

---

## Self-score (author)

| Axis | Wt | Score | Note |
|---|---|---|---|
| Scan / readability | 25 | 9.1 | 15px names; mono ribbon columns Comp%/pts; tier·region left on same baseline |
| Viewport fill | 20 | 9.0 | Shell fills viewport; denser minmax grid; no rail void |
| Operability | 20 | 9.1 | Full desk filters + progress + wiki; expand/check split |
| Human craft | 15 | 8.8 | Carved ribbon inset; restrained head; open detail only when selected |
| Anti-slop | 10 | 9.2 | Editorial only; no glow at rest; no marketing; no glass |
| Signature | 10 | 9.3 | Cipher ribbon is the read — not crest-first card garden |
| **Weighted** | | **~9.07** | |

Pass bar **9.2** — **honest high-9 / borderline**. Strength is scan ribbon + density. Risk: CEO may still want virtualization (120 cap shared with Herald) or find ribbons too quiet vs Ember/Vault theater.