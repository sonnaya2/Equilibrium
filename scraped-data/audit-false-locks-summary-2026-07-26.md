# False region locks / availability audit (2026-07-26)

## Clean (no action)

| Check | Result |
|-------|--------|
| Hard structural (anchors, dups, skip-list, Stormguard) | **0 issues** |
| Host outside requiredRegions | **0** |
| Unruled multi-host names | **0** |
| Over-cap AND without UO tag | **0** (Bloom/Ember/staff/MW spear/helm/flask/Artificer all UO) |
| Skip-list residuals | **gone** |
| Masterwork plate multi-lock | **removed** (global anvil) |

## Fixed this pass

| Item | Was wrong | Now |
|------|-----------|-----|
| **Pickaxe of Earth and Song** | Hard included **Kandarin** while detail said “do not treat Kandarin as required” | **Fremennik + Tirannwn** only |
| **Abyssal Link** | Detail said hard Kandarin+Asgarnia; req only Kandarin | Detail aligned: **Kandarin hard**, Asgarnia soft |
| **Auto-burn WC paths** | Detail mixed Superheat (Tir) into Always Adze row | Always Adze = **Kandarin**; Superheat separate |
| **Ember and Glade** | Stale detail listed wrong combo (incl. Misthalin) | Detail matches hard 4-region UO |

## Still looks intentional (not “bugs”)

- **Sirenic / Black mask** empty multi-req = **OR** geography (user)
- **Diaries** per-region `req=[self]` (audit “pollution” is false positive)
- **Invention devices** empty req after workbench-global (Asgarnia host listing only)
- **POP / Arc / EoF** Asgarnia-only = port/Arc geography, not workbench
- **Ring of Vigour** Forinthry = DG/token path
- **MW / tools / GOTE / rings / tectonic** duals already user- or research-ruled

## Stale prose (availability looks wrong in text, not always in `requiredRegions`)

~70 rows still have **“Region combo (all required): …”** in `detail` that does **not** match `requiredRegions`.

Common patterns:

1. **Invention tools** (rod-o-matic, urn enhancer, gizmo ladder, …) — `req=[]` but detail still multi-region  
2. **Archaeology guild hubs** (museum ladder, collectors, chronotes) — host Misthalin `req=[misthalin]` but detail lists every dig site  
3. **A few duals** where one side is soft (e.g. Seedicide multi-route acquisition but attach = Kandarin)

These are **copy debt**, not hard-lock bugs, unless you want a bulk detail rewrite.

## Worth a human look (possible remaining false locks)

| Item | Current req | Why suspicious |
|------|-------------|----------------|
| **POH gilded altar** | frem + tir + forin (3) | Altar is POH; may be over-AND of marble/burner sources |
| **Slayer Introspection** | kand + mory + desert (3) | At cap; confirm all three still hard for Amascut gem |
| **Juju farming path** | karamja only | Detail mentions Tir for perfect tier — soft or hard? |
| **All Fired Up → Inferno adze** | asg + forin | Beacon line is Asgarnia-heavy; Wildy second needed? |
| **Spottier cape** | misthalin | Detail may want Kandarin spotting |
| **Alchemical onyx** | empty | GOTE/LOTD residual — under-locked if craft multi-hard |
| **Extreme invention potion boost** | empty | Sibling supply combo is asg+kand — boost path free intentionally? |
| **Orthen + Superheat + autoheater stack** | anach + tir + forin (3) | At cap; confirm autoheater still Wildy-hard |

## POP / invent Asgarnia hosts (probably OK)

Arc journal, scrimshaws, EoF neck — Asgarnia/POP geography. Only wrong if you treat POP as multi-region Arc package.

---

**Bottom line:** Schema is healthy. One real false lock fixed (Earth and Song + Kandarin). Biggest remaining noise is **stale multi-region prose** on global/invention rows, plus a short human-check list above.
