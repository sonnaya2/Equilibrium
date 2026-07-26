# Issue 08a — Upgrade clone fence scout

**Scope:** how `data/research/catalog.json` → `regions[].upgrades` gets same-name copies (within a region or across hosts), which scripts write that array, why cleanups regress, and a minimal dedupe fence.

**Constraint honored:** catalog was not edited. Scripts read only.

**Snapshot (live catalog, 2026-07-26 scout):**

| Metric | Count |
|---|---|
| Total upgrade rows (sum over 11 regions) | 1715 |
| Multi-host names (same `name` on ≥2 regions) | **266** |
| Multi-host with `requiredRegions.length ≤ 1` | **204** (foreign / support clones) |
| Multi-host with multi `requiredRegions` | 62 (intentional combo copies, or still over-fanned) |
| Within-region same-name pairs | **14** (byte-identical fingerprints) |

---

## 1. Writers that touch `regions[].upgrades`

### Always-on product pipeline (`npm run normalize:data`)

Order from `package.json`:

```text
normalize-scraped-data.mjs
  → sync-reference-data.mjs          (no upgrades)
  → sync-regional-skilling-unlocks.mjs   ★ main re-emitter
  → sync-training-gaps.mjs               (skills.methods only)
  → sync-regional-combat-unlocks.mjs     ★ additive fan-out
  → sync-planner-* / permanent / combat-records  (no catalog upgrades)
```

| Script | Path | Write style |
|---|---|---|
| `scripts/normalize-scraped-data.mjs` | rebuilds whole catalog | **Replace** each region's `upgrades` from `scraped-data/major-upgrades-by-region.json` (`normalizeUpgrade`). Wipes prior catalog-only / patch state for upgrades. |
| `scripts/sync-regional-skilling-unlocks.mjs` | catalog + `data/research/regional-skilling-unlocks.json` | **Strip-then-republish:** drop any upgrade whose `name` is in current skilling `records`, then `push` every record with `regionHints.includes(region.id)`. Per-region name skip only. |
| `scripts/sync-regional-combat-unlocks.mjs` | catalog + regional-combat product | **Additive:** for each combat record × each hinted region, `push` if name not already on that region. No strip of prior combat rows that left the enrichment set. |

### Offline / ad-hoc writers (not in `normalize:data`)

| Script | Role |
|---|---|
| `scripts/sync-ironman-unlocks.mjs` | Additive fan-out of ironman audit rows onto `regionHints` (case-insensitive name skip). Also patches skilling product + `region-combos.json`. |
| `scripts/apply-region-patches.mjs` | Ops: `upsertUpgrade`, `editUpgrade`, `removeUpgrade` (+ `removeAllDuplicates`), `removeUpgradeByNameAllHosts`, `dedupeUpgradeName`, `renameUpgrade`, `ensureUpgradeOnHome` (**copy** via `copyFromRegion`), `moveUpgrade`. |
| `scripts/apply-clear-single-home.mjs` | One-shot anti-clone: for `foreign-upgrades-remaining` clear-single bucket, keep row only on home. **Not re-run by normalize.** |
| `scripts/apply-user-foreign-rulings.mjs` | Intentional multi-host policy: `keepOn` / `singleHome` **clone template** onto each allowed host; can also `push` new rows (herb network, GOTE, component pieces). |
| `scripts/apply-region-wiki-audits.mjs` | Mostly renames / content hygiene; some upgrade field edits; not a fan-out source. |
| `scripts/fix-catalog-quality.mjs` | Dedupes **training methods** and rebuilds `trainingMethodIds`. **Does not fence upgrades.** |

`sync-training-gaps.mjs` / `fix-catalog-quality.mjs` write catalog but only methods / method-id linkage.

---

## 2. How clones reappear

Two different clone species; both reappear for different mechanical reasons.

### A. Cross-region multi-host clones (the big regressor: 266 names)

**Primary machine:** `sync-regional-skilling-unlocks.mjs` fan-out (combat/ironman same idea).

```text
enrichment row
  → collectRegions() unions:
       region_hint, region_hints, required_regions,
       artifact_regions, collector_regions, additional_item_regions,
       optional_pressure_regions, region_pressure
  → regionHints = wide set (often home + pressure regions)
  → for each catalog region R:
       if R.id ∈ regionHints → push full upgrade object onto R.upgrades
```

Consequences:

1. **Support pressure is stored as a full clone**, not a pointer. A single-home unlock with `requiredRegions: ["asgarnia"]` still lands on every region in inflated `regionHints` (example: Ancient components discovery → 9 hosts; Wicked hood → 9 hosts; Dragon mattock → 4 hosts).
2. **Strip-then-republish undoes single-home cleanups.** `apply-clear-single-home` / foreign-ruling single-home edits remove foreign copies, but the next `npm run normalize:data` rebuilds major-upgrades then skilling **re-fans** from enrichment hints. Cleanup is not durable unless the **placement rule** changes in the sync script (or enrichment hints shrink).
3. **`normalize-scraped-data` resets the board.** Catalog upgrades become only major-upgrades lists; skilling/combat re-layer clones. Any manual catalog surgery that is not reflected in enrichment/major-upgrades is lost or re-cloned.
4. **Hint inflation is structural.** `collectRegions` treats optional pressure the same as hard home for placement. ~240 / 743 skilling records have multi-hints (~129 `support`, ~98 `all_required`, ~13 mis-typed `single`).
5. **Combat is additive only.** Dropping a combat enrichment row does not remove its prior catalog copies. Re-adding under a new id/name can stack near-dups; exact same name is skipped per region.

Intentional multi-host paths (do not call these bugs; fence must allow them):

- `regionRequirementType === "all_required"` with multi `requiredRegions` (true combos).
- User rulings via `apply-user-foreign-rulings.mjs` `keepOn([...hosts])` (diaries network, GOTE dual-home, etc.).
- Networks that are *meant* to appear on every diary region (Area Tasks overview).

### B. Within-region same-name dups (14 pairs, identical)

Live pairs are **byte-identical** (same `regionId`, empty req, same category/detail/confidence/source). Names like:

- Fishing Guild membership and DSF access (kandarin ×2)
- Hall of Memories / Memorial to Guthix / Piscatoris (kandarin)
- Anachronia base camp / Dream of Iaia / Orthen / Time altar / Agility codex (anachronia)
- Moonrise dig-site hub, Herblore Habitat, Wilderness Agility Course, Kharid-et, Everlight

**None of these names currently appear** in:

- `scraped-data/major-upgrades-by-region.json`
- `data/research/regional-skilling-unlocks.json`
- `data/research/regional-combat-unlocks.json`

So they are **orphan catalog rows**: once emitted by an older enrichment/patch path, then left behind when product records moved or were DROP_ID'd. Skilling only strips names still present in current `records`, so orphans never get the strip pass. A second writer (or a second push before `existing` was checked, or `renameUpgrade` colliding, or a copy op) left a twin; subsequent skilling runs do not see the name and do not collapse them.

`apply-region-patches.mjs` already has a **reactive** op `dedupeUpgradeName` (keep longest detail) and `removeUpgrade` + `removeAllDuplicates`, but nothing runs that fence automatically at end of normalize.

### C. Near-dup names (not same string)

Separate from exact clones: enrichment id/name drift (e.g. diary ladder restated thrice). Handled today by `DROP_IDS` + `NAME_CANONICAL` inside skilling merge (`audit-final-dedupe-patch-2026-07-26.json` style). That is **record-level** hygiene, not a catalog placement fence. Without NAME_CANONICAL, two ids with different display names both fan out → soft clones on the UI.

---

## 3. Why “we already cleaned foreign upgrades” fails

```text
apply-clear-single-home / user singleHome
        │
        ▼
  catalog: one host only
        │
  npm run normalize:data
        │
        ├─ normalize: upgrades := major-upgrades only
        ├─ skilling: strip known names, re-push onto every regionHints host
        └─ combat: push missing names onto every combat regionHints host
        │
        ▼
  foreign copies back (204 single-req multi-host names)
```

Ironman sync, if run after a cleanup, **adds** more multi-hint rows without re-homing.

---

## 4. Minimal dedupe fence (proposal)

Do **not** invent a second catalog store. Add one small shared helper and call it at the end of every upgrade writer (and optionally once at the end of `normalize:data`).

### 4.1 Shared helper (new file, ~40 lines)

Suggested: `scripts/lib/catalog-upgrade-fence.mjs`

```js
/**
 * In-place fence for catalog.regions[].upgrades.
 * 1) Within-region: collapse exact name (casefold) → keep richest row.
 * 2) Cross-region: collapse foreign hosts for single-home rows.
 */
export function fenceRegionUpgrades(catalog, opts = {}) {
  const allowMulti = opts.allowMultiHosts; // optional Set of names explicitly multi-ok

  // Pass 1 — within region
  for (const region of catalog.regions || []) {
    const best = new Map(); // lowerName -> row
    for (const u of region.upgrades || []) {
      const key = String(u.name || "").toLowerCase().trim();
      if (!key) continue;
      const prev = best.get(key);
      if (!prev || richness(u) > richness(prev)) best.set(key, u);
    }
    region.upgrades = [...best.values()];
  }

  // Pass 2 — cross-region single-home
  const byName = new Map(); // lowerName -> [{region, u}]
  for (const region of catalog.regions || []) {
    for (const u of region.upgrades || []) {
      const key = String(u.name || "").toLowerCase().trim();
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key).push({ region, u });
    }
  }

  for (const [, hosts] of byName) {
    if (hosts.length <= 1) continue;
    const name = hosts[0].u.name;
    if (allowMulti?.has(name)) continue;

    const req = [...new Set(hosts.flatMap(({ u }) => u.requiredRegions || []))];
    const type = hosts[0].u.regionRequirementType || "";
    const hints = hosts[0].u.regionHints || [];

    // True combos: keep only hosts that are in requiredRegions (if multi)
    if (req.length > 1 || type === "all_required") {
      const allow = new Set(req.length ? req : hints);
      for (const { region, u } of hosts) {
        if (!allow.has(region.id)) {
          region.upgrades = region.upgrades.filter((x) => x !== u);
        }
      }
      continue;
    }

    // Single-home / support / empty req: one primary host only
    const home =
      req[0] ||
      hosts.find(({ u }) => u.regionId && u.regionId === /* owning */ u.regionId)?.u.regionId ||
      (hints[0]) ||
      hosts[0].region.id;

    for (const { region, u } of hosts) {
      if (region.id !== home) {
        region.upgrades = region.upgrades.filter((x) => x !== u);
      } else {
        u.regionId = home;
        if (!u.requiredRegions?.length && req[0]) u.requiredRegions = [home];
      }
    }
  }
}

function richness(u) {
  return (
    String(u.detail || "").length +
    (u.source?.url ? 50 : 0) +
    (u.requiredRegions?.length || 0) * 10 +
    (u.regionHints?.length || 0)
  );
}
```

**Placement policy (minimal, explicit):**

| `regionRequirementType` / req | Hosts after fence |
|---|---|
| `all_required` + `requiredRegions.length ≥ 2` | keep only regions ∈ `requiredRegions` |
| `requiredRegions.length === 1` (any type) | keep **only that home** (kills 204 foreign clones) |
| empty req + multi hints (`support` / network) | keep **hints[0]** or first present host **unless** name is on an allowlist (Area Tasks, herb network, …) |
| within-region exact name | always collapse to richest |

Allowlist seed (from existing foreign-ruling multi-ok intent): diary overview, herb patch network, a few true multi-source tools user already marked multi-ok. Prefer loading from a tiny JSON later; hardcode 5–15 names for v1 is fine.

### 4.2 Call sites (minimal)

1. **End of** `sync-regional-skilling-unlocks.mjs` (before `write(CATALOG_PATH)`) — mandatory; this is the reappearance engine.
2. **End of** `sync-regional-combat-unlocks.mjs` — same.
3. **End of** `sync-ironman-unlocks.mjs` catalog section — same.
4. **Optional but cheap:** end of `apply-region-patches.mjs` / `apply-user-foreign-rulings.mjs` so one-shot patches cannot leave within-region twins.
5. **Do not** put the fence only in a standalone script: it will be skipped the next normalize.

### 4.3 Placement fix at emit time (even smaller than post-pass)

In skilling/combat/ironman push loops, replace:

```js
const additions = records.filter((row) => row.regionHints.includes(region.id));
```

with:

```js
function hostRegions(row) {
  const req = row.requiredRegions || [];
  if (req.length > 1) return req;                    // true combo
  if (req.length === 1) return req;                  // single home only
  if (row.regionRequirementType === "all_required" && (row.regionHints || []).length > 1)
    return row.regionHints;
  // support / empty: home = first hint (or region_hint from enrich)
  return (row.regionHints || []).slice(0, 1);
}
// ...
const additions = records.filter((row) => hostRegions(row).includes(region.id));
```

This stops clones at the source. Keep the **post-pass fence** anyway for:

- within-region twins,
- orphans from deleted enrichment names,
- patch scripts that still copy.

Emit-time host shrink + end fence = durable under `normalize:data`.

### 4.4 What not to do

- Do not re-encode multi-host as “delete from enrichment hints” only — pressure notes belong in `detail` / `comboLabel`, not as extra catalog hosts.
- Do not use `fix-catalog-quality` method dedupe as a substitute (different array).
- Do not rely on `apply-clear-single-home` in the product pipeline (one-shot, not wired).
- Do not collapse true `all_required` multi-req rows to one host without an explicit product decision.
- Do not edit catalog by hand without changing emit rules — next normalize reverts/re-clones.

---

## 5. Verification sketch (after implement)

```text
node -e "/* same multi-host / within-dup counters as this scout */"
# expect: withinRegionDupNames === 0
# expect: singleReqButMultiHost === 0 (or only allowlisted names)
npm run normalize:data
# re-count — fence must hold after full pipeline
```

Optional: add a tiny assert at end of skilling sync:

```js
// throw if any region has duplicate upgrade names
// warn if single-req name appears on >1 region (unless allowlisted)
```

---

## 6. File index (absolute)

| Role | Path |
|---|---|
| Catalog (do not edit in this issue) | `C:\Users\Sonnaya\Rs3Equilibrium\data\research\catalog.json` |
| Major-upgrades seed | `C:\Users\Sonnaya\Rs3Equilibrium\scraped-data\major-upgrades-by-region.json` |
| Normalize rebuild | `C:\Users\Sonnaya\Rs3Equilibrium\scripts\normalize-scraped-data.mjs` |
| Skilling strip+fan-out | `C:\Users\Sonnaya\Rs3Equilibrium\scripts\sync-regional-skilling-unlocks.mjs` |
| Combat fan-out | `C:\Users\Sonnaya\Rs3Equilibrium\scripts\sync-regional-combat-unlocks.mjs` |
| Ironman fan-out | `C:\Users\Sonnaya\Rs3Equilibrium\scripts\sync-ironman-unlocks.mjs` |
| Patch ops incl. dedupeUpgradeName | `C:\Users\Sonnaya\Rs3Equilibrium\scripts\apply-region-patches.mjs` |
| One-shot single-home cleanup | `C:\Users\Sonnaya\Rs3Equilibrium\scripts\apply-clear-single-home.mjs` |
| Intentional multi-host rulings | `C:\Users\Sonnaya\Rs3Equilibrium\scripts\apply-user-foreign-rulings.mjs` |
| Near-dup record hygiene notes | `C:\Users\Sonnaya\Rs3Equilibrium\scraped-data\audit-final-dedupe-patch-2026-07-26.json` |
| Pipeline entry | `C:\Users\Sonnaya\Rs3Equilibrium\package.json` → `normalize:data` |

---

## 7. Bottom line

Clones reappear because **placement is “every region in regionHints gets a full row”**, and skilling **re-emits that fan-out on every normalize**, after wiping upgrades back to major-upgrades. One-shot foreign cleanups are not part of the pipeline. Within-region twins are orphan identical pushes that no current strip list touches.

**Minimal fence:** (1) emit only onto home / required set, not full pressure hints; (2) shared end-of-write collapse for exact-name within-region + single-req multi-host; (3) small multi-ok allowlist for networks already ruled multi-host.
