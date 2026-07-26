# Bastion Stack — Gallery War R1

**Codename:** Bastion Stack  
**Id:** `bastion`  
**Thesis:** 2-col until xl; fewer wider cards; premium readable.

## Signature

Gallery Board topology with **deliberately few columns**. Cards stay wide so
name, crest, Comp%, and a two-line teaser all read at a glance — not a
minmax garden that packs six skinny tiles across 1440.

| Breakpoint | Columns |
|---|---|
| < 40rem | 1 |
| ≥ 40rem | **2** (signature) |
| ≥ 80rem (xl) | **3** max — only when the board is truly wide |

Until xl the board is a **two-stack** of bastion plates. At xl a third column
is allowed; cards never drop below a readable min width.

## Topology (Gallery Board)

1. Facet bar — count · search · My build · region · tiers
2. Full-height board (scroll)
3. Wide cards in a fixed low column count
4. **Expand in-tile** — detail mounts inside the selected card only
5. **Checkbox decoupled** — check never toggles expand; expand never checks

No permanent right inspector. No invented rows. Spike selection law: detail
only when `selectedId` is set (no first-row auto-open).

## Craft

- Editorial / Echo tokens under `.td-gw-bastion` only
- Real crests via `RegionCrest`; global uses monogram `G`
- Name ≥15px; body teaser on the face so scan does not require expand
- Comp% wiki deep-links; progress via `useTasksDesk`
- Cap 120 painted tiles (filters still apply) — virt is Crucible's fight

## Hard fails to avoid

Invented data · gen-AI art · expand toggles checkbox · permanent right
inspector · new palette · card-garden void · marketing copy
