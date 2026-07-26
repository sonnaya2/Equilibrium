# Vault Medallion — Gallery War R1

**ID:** `vault`  
**Thesis:** Oversized crest medallion; name hierarchy under crest; still dense enough for 1440p.

## Bet

Herald puts a modest crest beside the name. Vault **centers a large circular seal** and stacks type **under** it:

```
[ ✓ ]                    pts
         ╭────────╮
         │  CREST │   ← medallion owns identity
         ╰────────╯
        Task name     ← primary
     Tier · Region    ← secondary
     Comp% · open     ← mono strip
```

Region identity is structural (big crest), not a side badge. Name hierarchy is vertical scan, not a horizontal wiki strip.

## Density counterweight

Large crest would waste width if cards were fat. Cards stay **narrow** (`minmax(~12.75rem)`) so 1440p still yields ~5–6 columns. Height budget is medallion + 2-line name + meta + strip — no card-garden void.

## Fixed recipe

- `useTasksDesk` only — real Catalyst rows, My build, region select, tier chips, search, progress
- Gallery Board topology — no permanent right inspector
- Expand **in-tile**; re-click / Close nulls `selectedId` (no desk first-row fallback)
- Checkbox **decoupled** — no `label`/`htmlFor` on name; `stopPropagation` on check
- Editorial tokens under `.td-gw-vault` — gem interactive, gold display title only
- Cap 120 tiles first paint (same as Herald); search/filters still apply

## Hard fails to avoid

Invented data · gen-AI art · expand toggles checkbox · permanent inspector · new palette · marketing copy · idle glow garden

## Files

- `VaultPreview.tsx` — export `VaultPreview`
- `vault.css` — scoped `.td-gw-vault`
