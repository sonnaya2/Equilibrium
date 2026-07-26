/**
 * Fence catalog.region[].upgrades against:
 *  1) within-region name duplicates
 *  2) foreign hosts for single-home upgrades (requiredRegions.length === 1)
 *
 * Mutates catalog in place. Does not invent multi-region homes — only length===1
 * requiredRegions is authoritative. Multi-req and empty-req multi-hosts are left alone.
 *
 * @param {object} catalog  data/research/catalog.json shape ({ regions: [...] })
 * @returns {{ withinRegionDupesRemoved: number, foreignSingleHomeDropped: number, movedToHome: number, singleHomeNames: number, ambiguousHomes: number, missingHomeRegion: number }}
 */
export function dedupeRegionUpgrades(catalog) {
  const regions = catalog?.regions || [];
  const byId = new Map(regions.map((r) => [r.id, r]));

  const stats = {
    withinRegionDupesRemoved: 0,
    foreignSingleHomeDropped: 0,
    movedToHome: 0,
    singleHomeNames: 0,
    ambiguousHomes: 0,
    missingHomeRegion: 0,
  };

  /** @type {Map<string, Array<{ regionId: string, upgrade: object }>>} */
  const byName = new Map();
  for (const r of regions) {
    r.upgrades ||= [];
    for (const u of r.upgrades) {
      const name = u?.name;
      if (!name) continue;
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push({ regionId: r.id, upgrade: u });
    }
  }

  /** regionId → Set of upgrade names to drop */
  const drop = new Map();
  /** regionId → upgrade object to ensure (moved home) */
  const ensure = new Map();

  function markDrop(regionId, name) {
    if (!drop.has(regionId)) drop.set(regionId, new Set());
    drop.get(regionId).add(name);
  }

  for (const [name, copies] of byName) {
    const homes = new Set();
    for (const { upgrade: u } of copies) {
      const req = Array.isArray(u.requiredRegions) ? u.requiredRegions.filter(Boolean) : [];
      if (req.length === 1) homes.add(req[0]);
    }
    if (homes.size === 0) continue;
    if (homes.size > 1) {
      stats.ambiguousHomes += 1;
      continue;
    }

    const home = [...homes][0];
    if (!byId.has(home)) {
      stats.missingHomeRegion += 1;
      continue;
    }

    stats.singleHomeNames += 1;

    const onHome = copies.find((c) => c.regionId === home);
    const best = pickBest(copies, home).upgrade;

    for (const c of copies) {
      if (c.regionId !== home) {
        markDrop(c.regionId, name);
        stats.foreignSingleHomeDropped += 1;
      }
    }

    if (!onHome) {
      // Move: keep best foreign body on the home region.
      const moved = {
        ...structuredClone(best),
        regionId: home,
        requiredRegions: Array.isArray(best.requiredRegions) && best.requiredRegions.length === 1
          ? [...best.requiredRegions]
          : [home],
      };
      if (!ensure.has(home)) ensure.set(home, []);
      ensure.get(home).push(moved);
      stats.movedToHome += 1;
    } else if (onHome.upgrade.regionId !== home) {
      onHome.upgrade.regionId = home;
    }
  }

  for (const r of regions) {
    const dropNames = drop.get(r.id);
    if (dropNames?.size) {
      r.upgrades = r.upgrades.filter((u) => !dropNames.has(u.name));
    }
    const toAdd = ensure.get(r.id);
    if (toAdd?.length) {
      const have = new Set(r.upgrades.map((u) => u.name));
      for (const u of toAdd) {
        if (have.has(u.name)) continue;
        r.upgrades.push(u);
        have.add(u.name);
      }
    }
  }

  // Per-region unique by name (first wins after single-home pass).
  for (const r of regions) {
    const seen = new Set();
    const next = [];
    for (const u of r.upgrades || []) {
      const name = u?.name;
      if (!name) continue;
      if (seen.has(name)) {
        stats.withinRegionDupesRemoved += 1;
        continue;
      }
      seen.add(name);
      next.push(u);
    }
    r.upgrades = next;
  }

  return stats;
}

/**
 * Prefer the copy already on home; else longest detail; else first.
 * @param {Array<{ regionId: string, upgrade: object }>} copies
 * @param {string} home
 */
function pickBest(copies, home) {
  const onHome = copies.find((c) => c.regionId === home);
  if (onHome) return onHome;
  let best = copies[0];
  let bestScore = scoreUpgrade(best.upgrade);
  for (let i = 1; i < copies.length; i++) {
    const s = scoreUpgrade(copies[i].upgrade);
    if (s > bestScore) {
      best = copies[i];
      bestScore = s;
    }
  }
  return best;
}

function scoreUpgrade(u) {
  let s = 0;
  if (u?.source?.url) s += 3;
  if (typeof u?.detail === "string") s += Math.min(4, Math.floor(u.detail.length / 40));
  if (Array.isArray(u?.requirements) && u.requirements.length) s += 1;
  if (u?.comboLabel) s += 1;
  if (Array.isArray(u?.requiredRegions) && u.requiredRegions.length === 1) s += 2;
  return s;
}
