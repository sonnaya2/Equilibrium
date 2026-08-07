# Majors look missing when data exists

Agents burned hours "fixing missing data" when majors were present. Check this list **before** inventing rows.

## 1. Next route cache / 500

- `app/data/regions/[id]/route.ts` and panels route: `dynamic = "force-dynamic"` must be a **static string** (NODE_ENV ternary → 500 → empty UI).
- Response: `Cache-Control: private, no-store`.
- Client `src/research/regionStore.ts`: `cache: "no-store"` on fetch.
- After rebuild, pipeline may clear stale `.next/**/app/data` bodies; restart `next dev` if needed.

## 2. SPA Map pin

- `regionStore` keeps an in-memory `Map` per region id for the **tab lifetime**.
- Hard reload or new tab after sqlite/patch changes. API-fixed ≠ UI-updated.

## 3. `majorContentRows` collapse

- UI majors = `majorContentRows(content, upgrades)`, not raw `region.content`.
- Collapses child when parent is multi-boss package, `parent.name === child.kind`, and reward strings match.
- Intentional: Sanctum children hide; Solak must not collapse under Lost Grove.
- Grep canonical for a name ≠ grep the Major unlocks table.

## 4. Soft-removed status

- `status = removed` hides from many surfaces; reactivate with `upsert` status active **and** `set-record`.
- Examples: Warforge dig site, Advanced Barbarian Outpost Agility, AoD hygiene.

## 5. Ordinal park at 100

- Ordered insert: park at `content[100]`, shift tail, seat final (`2026-08-07-aod-thalmund-content-ordinals.jsonl`).
- Incomplete cascade: row stuck at 100 (easy to miss at list end) or clobbers a neighbor.
- Live pins: AoD Asgarnia content[5] (Nex+1); Thalmund Kandarin content[8] (Warforge+1).
- Some upgrades use ordinal 100 as end-parking — not deleted.

## 6. CSS clip

- Nested data browser must not get a second full-viewport min-height inside Workbench overflow.
- Scroll the Major unlocks panel before claiming rows missing.

## Debug order

1. `GET /data/regions/<id>` — is the row in JSON `content`?
2. Hard reload (regionStore pin).
3. `majorContentRows` / presentation tests — collapsed vs raw.
4. `research_region_entries` ordinal/section + entity status.
5. Scroll the panel; count is post-collapse length.

**Bottom line:** missing major was usually cache, Map pin, collapse, ordinal 100, or CSS — not absent patch data.
