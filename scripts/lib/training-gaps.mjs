/**
 * Shared training-gap coerce + expand for sync-training-gaps (sole post-step)
 * and any other scripts that need the same fidelity.
 *
 * Does not invent XP/h. Skips slug-only method titles (item_family / supply: ids).
 */

export const GAP_PATTERN = /^training-gap-.*\.json$/i;

export const REGION_IDS = new Set([
  "misthalin",
  "havenhythe",
  "karamja",
  "asgarnia",
  "kandarin",
  "fremennik",
  "forinthry",
  "desert",
  "morytania",
  "tirannwn",
  "anachronia",
]);

export const REGION_ALIASES = {
  wilderness: "forinthry",
  wildy: "forinthry",
  "kharidian desert": "desert",
  "fremennik province": "fremennik",
  "city of um": "misthalin",
  underworld: "misthalin",
  "fort forinthry": "misthalin",
};

/** Skill → [title, wiki url] for source fallback when a gap row has no URL. */
export const WIKI_TRAINING_SOURCES = {
  Agility: ["Agility training", "https://runescape.wiki/w/Agility_training"],
  Archaeology: ["Archaeology training", "https://runescape.wiki/w/Archaeology_training"],
  Attack: ["Pay-to-play melee training", "https://runescape.wiki/w/Pay-to-play_melee_training"],
  Constitution: ["Pay-to-play melee training", "https://runescape.wiki/w/Pay-to-play_melee_training"],
  Construction: ["Construction training", "https://runescape.wiki/w/Construction_training"],
  Cooking: ["Pay-to-play Cooking training", "https://runescape.wiki/w/Pay-to-play_Cooking_training"],
  Crafting: ["Pay-to-play Crafting training", "https://runescape.wiki/w/Pay-to-play_Crafting_training"],
  Defence: ["Pay-to-play melee training", "https://runescape.wiki/w/Pay-to-play_melee_training"],
  Divination: ["Divination training", "https://runescape.wiki/w/Divination_training"],
  Dungeoneering: [
    "Pay-to-play Dungeoneering training",
    "https://runescape.wiki/w/Pay-to-play_Dungeoneering_training",
  ],
  Farming: ["Farming training", "https://runescape.wiki/w/Farming_training"],
  Firemaking: [
    "Pay-to-play Firemaking training",
    "https://runescape.wiki/w/Pay-to-play_Firemaking_training",
  ],
  Fishing: ["Pay-to-play Fishing training", "https://runescape.wiki/w/Pay-to-play_Fishing_training"],
  Fletching: ["Fletching training", "https://runescape.wiki/w/Fletching_training"],
  Herblore: ["Herblore training", "https://runescape.wiki/w/Herblore_training"],
  Hunter: ["Hunter training", "https://runescape.wiki/w/Hunter_training"],
  Invention: ["Invention training", "https://runescape.wiki/w/Invention_training"],
  Magic: ["Pay-to-play Magic training", "https://runescape.wiki/w/Pay-to-play_Magic_training"],
  Mining: ["Pay-to-play Mining training", "https://runescape.wiki/w/Pay-to-play_Mining_training"],
  Necromancy: ["Necromancy training", "https://runescape.wiki/w/Necromancy_training"],
  Prayer: ["Pay-to-play Prayer training", "https://runescape.wiki/w/Pay-to-play_Prayer_training"],
  Ranged: ["Pay-to-play Ranged training", "https://runescape.wiki/w/Pay-to-play_Ranged_training"],
  Runecrafting: [
    "Pay-to-play Runecrafting training",
    "https://runescape.wiki/w/Pay-to-play_Runecrafting_training",
  ],
  Slayer: ["Slayer training", "https://runescape.wiki/w/Slayer_training"],
  Smithing: ["Pay-to-play Smithing training", "https://runescape.wiki/w/Pay-to-play_Smithing_training"],
  Strength: ["Pay-to-play melee training", "https://runescape.wiki/w/Pay-to-play_melee_training"],
  Summoning: ["Summoning training", "https://runescape.wiki/w/Summoning_training"],
  Thieving: ["Thieving training", "https://runescape.wiki/w/Thieving_training"],
  Woodcutting: [
    "Pay-to-play Woodcutting training",
    "https://runescape.wiki/w/Pay-to-play_Woodcutting_training",
  ],
};

export function list(value) {
  return Array.isArray(value) ? value : [];
}

export function text(value, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((v) => text(v)).filter(Boolean).join(" · ");
  return fallback;
}

export function compact(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(compact).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value)
      .map(([key, entry]) => `${key.replaceAll("_", " ")}: ${compact(entry)}`)
      .join(" · ");
  }
  return "";
}

export function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

/**
 * Human-facing method titles only. Rejects snake_case item families, supply:/combo: ids,
 * and bare machine slugs — those must not become catalog method names.
 */
export function isHumanMethodName(name) {
  if (typeof name !== "string") return false;
  const t = name.trim();
  if (!t) return false;
  if (t === "Unnamed method" || t === "Supply route") return false;
  // id prefixes from gap files
  if (/^(supply|combo|note|unlock|gap):/i.test(t)) return false;
  // snake_case item_family style: high_tier_grimy_herbs
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(t)) return false;
  // pure kebab machine slug with no spaces / capitals (high-tier-herbs)
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(t) && !/[A-Z\s]/.test(t)) return false;
  // must contain a letter
  if (!/[A-Za-z]/.test(t)) return false;
  return true;
}

export function normalizeRegionId(raw) {
  if (!raw) return null;
  const key = String(raw).toLowerCase().trim();
  if (REGION_IDS.has(key)) return key;
  if (REGION_ALIASES[key]) return REGION_ALIASES[key];
  return null;
}

export function sourceKind(url) {
  if (!url) return "derived";
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "runescape.wiki" || host.endsWith(".runescape.wiki")) return "runescape-wiki";
    if (host === "secure.runescape.com" || host.endsWith(".runescape.com")) return "jagex";
    if (host === "pvme.io" || host.endsWith(".pvme.io")) return "pvme";
    if (host === "rs-analysis.xyz" || host.endsWith(".rs-analysis.xyz")) return "rs-analysis";
  } catch {
    return "derived";
  }
  return "derived";
}

export function sourceReference(url, title, verifiedAt) {
  if (!url || typeof url !== "string" || !url.startsWith("http")) return null;
  return {
    source: sourceKind(url),
    url,
    title,
    verifiedAt,
  };
}

/** Collect http(s) URLs from source / source_urls / sources (string or {url}). */
export function collectSourceUrls(raw) {
  const out = [];
  const push = (value) => {
    if (!value) return;
    if (typeof value === "string" && value.startsWith("http")) {
      out.push(value);
      return;
    }
    if (typeof value === "object") {
      const url = text(value.url || value.href || value.source_url);
      if (url.startsWith("http")) out.push(url);
    }
  };
  push(raw.source);
  for (const entry of list(raw.source_urls)) push(entry);
  for (const entry of list(raw.sources)) push(entry);
  // Nested region source tables (herblore supply routes)
  for (const row of list(raw.sources_by_region)) {
    push(row?.source_url || row?.url || row?.source);
  }
  for (const route of list(raw.routes)) {
    push(route?.source_url || route?.url);
    for (const src of list(route?.sources)) push(src?.source_url || src?.url);
  }
  return out;
}

export function pickSourceUrl(raw) {
  return collectSourceUrls(raw)[0] || "";
}

export function wikiTrainingSource(skill, verifiedAt) {
  const pair = WIKI_TRAINING_SOURCES[skill];
  if (!pair) return null;
  return sourceReference(pair[1], pair[0], verifiedAt);
}

export function collectRegionHints(raw) {
  const hints = new Set();
  const add = (value) => {
    const id = normalizeRegionId(value);
    if (id) hints.add(id);
  };

  for (const key of ["region", "method_region", "resource_region", "required_unlock_region"]) {
    add(raw[key]);
  }
  for (const key of [
    "regions",
    "region_hints",
    "resource_region_options",
    "required_regions",
    "multi_region_combo",
  ]) {
    for (const value of list(raw[key])) {
      if (typeof value === "string" || typeof value === "number") add(value);
      else if (value && typeof value === "object") {
        add(value.region || value.method_region || value.id || value.name);
      }
    }
  }
  for (const opt of list(raw.region_options)) {
    add(opt?.region);
  }
  for (const site of list(raw.sites || raw.locations || raw.routes)) {
    if (site && typeof site === "object") add(site.region);
  }
  for (const row of list(raw.sources_by_region)) {
    add(row?.region);
  }
  // Nested boss/source tables under supply routes
  for (const route of list(raw.routes)) {
    add(route?.region);
    for (const src of list(route?.sources)) add(src?.region);
  }
  return [...hints];
}

export function locationFrom(raw) {
  if (text(raw.location)) return text(raw.location);
  const opts = list(raw.region_options);
  if (opts.length > 0) {
    return opts
      .map((opt) => {
        const region = normalizeRegionId(opt.region) || text(opt.region);
        const place = text(opt.location);
        return place ? `${region}: ${place}` : region;
      })
      .filter(Boolean)
      .join(" · ");
  }
  // sources_by_region (herblore supply)
  const byRegion = list(raw.sources_by_region);
  if (byRegion.length > 0) {
    return byRegion
      .map((row) => {
        const region = normalizeRegionId(row.region) || text(row.region);
        const place = text(row.source || row.location);
        return place ? `${region}: ${place}` : region;
      })
      .filter(Boolean)
      .join(" · ");
  }
  // routes with source place names
  const routes = list(raw.routes);
  if (routes.length > 0) {
    return routes
      .map((route) => {
        const region = normalizeRegionId(route.region) || text(route.region);
        const place = text(route.source || route.location || route.name);
        if (place && region) return `${region}: ${place}`;
        return place || region;
      })
      .filter(Boolean)
      .join(" · ");
  }
  return "";
}

export function requirementsFrom(raw) {
  const out = new Set(list(raw.requirements).map(String));
  for (const opt of list(raw.region_options)) {
    for (const req of list(opt.requirements)) out.add(String(req));
  }
  return [...out];
}

function notePartsFrom(raw, sourceFile) {
  const parts = [];
  const push = (value) => {
    if (value === null || value === undefined || value === "") return;
    if (typeof value === "string") {
      parts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) push(entry);
      return;
    }
    const compacted = compact(value);
    if (compacted) parts.push(compacted);
  };

  push(raw.notes);
  push(raw.note);
  push(raw.summary);
  push(raw.ironman_notes);
  push(raw.league_note);
  push(raw.importance);
  push(raw.validity_note);
  push(raw.usage_notes);
  push(raw.path_notes);
  push(raw.region_note);
  push(raw.multi_region_combo_note);
  push(raw.detail);
  push(raw.effect);
  if (Array.isArray(raw.effects)) push(raw.effects.join("; "));
  if (raw.gap) push(`Gap: ${raw.gap}`);
  if (raw.xp_rate_note) push(String(raw.xp_rate_note));
  if (raw.planner_coverage) push(`Planner coverage: ${raw.planner_coverage}`);

  const multi = list(raw.multi_region_combo).map(normalizeRegionId).filter(Boolean);
  if (multi.length > 1) push(`Region options: ${multi.join(" / ")}`);

  if (sourceFile) push(`gap_file: ${sourceFile}`);

  // Dedupe while preserving order
  const seen = new Set();
  const unique = [];
  for (const part of parts) {
    const key = String(part).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unique.push(key);
  }
  return unique;
}

export function notesFrom(raw, sourceFile) {
  return notePartsFrom(raw, sourceFile).join(" · ");
}

export function methodId(skill, method) {
  return `${slug(skill)}:${slug(method)}`;
}

/**
 * Prefer real human titles. Never fall back to item_family or bare id slugs.
 */
export function pickMethodName(raw) {
  const candidates = [
    raw.method,
    raw.name,
    raw.title,
    raw.item,
    raw.topic,
    raw.summary,
  ];
  for (const candidate of candidates) {
    const value = text(candidate);
    if (isHumanMethodName(value)) return value;
  }
  return "";
}

/**
 * Expand one gap file into coerced intermediate rows (still scrape-shaped).
 * Handles methods, nested variants/masters, supply_routes (human name only),
 * unlock_notes/unlocks with skill.
 */
export function expandGapFile(file) {
  const rows = [];
  const sourceFile = file.name;

  const pushCoerced = (raw) => {
    const coerced = coerceGapRecord(raw, sourceFile);
    if (coerced) rows.push(coerced);
  };

  for (const raw of list(file.data.methods)) {
    const nested = expandNestedGapRows(raw);
    if (nested.length) {
      for (const row of nested) pushCoerced(row);
      // Keep parent when it has a usable method name distinct from pure container
      if (raw.method || raw.name) pushCoerced(raw);
      continue;
    }
    pushCoerced(raw);
  }

  for (const raw of list(file.data.supply_routes)) {
    const methodName = pickMethodName(raw);
    if (!methodName) {
      // Skip slug-only / id-only supply rows — do not invent titles from item_family.
      continue;
    }
    const asMethod = {
      ...raw,
      skill: raw.skill || "Unknown",
      method: methodName,
      category: raw.category || "supply",
    };
    // Prefer first route region when top-level region missing
    if (!asMethod.region && list(raw.routes).length) {
      const regions = list(raw.routes)
        .map((route) => text(route.region))
        .filter(Boolean);
      asMethod.region_options = list(raw.region_options).length
        ? raw.region_options
        : regions.map((region) => ({ region }));
      asMethod.region =
        regions.length === 1 ? regions[0] : regions.length ? "multi-region" : undefined;
    }
    if (!asMethod.region && list(raw.sources_by_region).length) {
      const regions = list(raw.sources_by_region)
        .map((row) => text(row.region))
        .filter(Boolean);
      asMethod.region =
        regions.length === 1 ? regions[0] : regions.length ? "multi-region" : asMethod.region;
      if (!list(asMethod.multi_region_combo).length && regions.length > 1) {
        asMethod.multi_region_combo = regions;
      }
    }
    pushCoerced(asMethod);
  }

  for (const raw of list(file.data.unlock_notes || file.data.unlocks)) {
    if (!raw?.skill && !raw?.skills) continue;
    const skills = [];
    if (raw.skill) skills.push(text(raw.skill));
    for (const s of list(raw.skills)) skills.push(text(s));
    const uniqueSkills = [...new Set(skills.filter(Boolean))];
    if (uniqueSkills.length === 0) continue;

    const methodName = pickMethodName(raw);
    if (!methodName) continue;

    // One catalog row per skill tag so multi-skill unlock notes surface on each skill.
    for (const skill of uniqueSkills) {
      pushCoerced({
        ...raw,
        skill,
        method: methodName,
        region: raw.region || list(raw.regions)[0],
        regions: raw.regions || raw.region_hints,
        source: raw.source || list(raw.sources)[0],
        source_urls: raw.source_urls || raw.sources,
      });
    }
  }

  return rows;
}

function expandNestedGapRows(raw) {
  const out = [];
  for (const variant of list(raw.variants)) {
    const methodName = text(variant.item || variant.name || variant.method) || text(raw.method || raw.summary);
    if (!isHumanMethodName(methodName)) continue;
    out.push({
      ...raw,
      method: methodName,
      region: text(list(variant.region_hints)[0] || variant.region),
      region_hints: list(variant.region_hints).length
        ? list(variant.region_hints)
        : list(raw.region_hints),
      location: text(variant.catch_location || variant.location || raw.location),
      level_range: text(
        variant.ranged_level
          ? `Ranged ${variant.ranged_level}+; Hunter ${variant.hunter_level || "?"}`
          : raw.level_range,
      ),
      notes: [raw.summary, variant.stale_assumption_corrected, raw.notes].filter(Boolean).join(" · "),
      source: list(raw.source_urls)[0] || raw.source,
    });
  }
  for (const master of list(raw.masters)) {
    const methodName =
      text(master.name || master.master || master.method) || "Slayer master access";
    if (!isHumanMethodName(methodName)) continue;
    out.push({
      ...raw,
      method: methodName,
      region: text(master.region || master.method_region || list(master.region_hints)[0]),
      region_hints: list(master.region_hints).length
        ? list(master.region_hints)
        : [master.region].filter(Boolean),
      location: text(master.location),
      level_range: text(master.level_range || master.combat_level || raw.level_range),
      notes: [raw.summary, master.notes, master.access_notes, master.combo_note]
        .filter(Boolean)
        .join(" · "),
      warning: master.warning || raw.warning,
      source: list(raw.source_urls)[0] || master.source || raw.source,
    });
  }
  return out;
}

/**
 * Coerce a gap row into scrape-shaped intermediate (skill/method/source/notes).
 * Returns null when skill or human method name is missing.
 */
export function coerceGapRecord(raw, sourceFile) {
  if (!raw || typeof raw !== "object") return null;
  const skill = text(raw.skill);
  if (!skill || skill.toLowerCase() === "multi" || skill.toLowerCase() === "unknown") return null;

  const method = pickMethodName(raw);
  if (!method) return null;

  const sourceUrl = pickSourceUrl(raw);

  const xp =
    raw.xp_rate ??
    raw.base_xp_per_hour ??
    raw.example_base_xp_per_hour ??
    raw.throughput ??
    raw.rates_wiki ??
    raw.known_high_end_rates;

  return {
    ...raw,
    skill,
    method,
    region: raw.region || raw.method_region,
    source: sourceUrl || raw.source,
    source_urls: list(raw.source_urls).length ? raw.source_urls : collectSourceUrls(raw),
    notes: notesFrom(raw, sourceFile),
    warning: raw.warning || raw.region_warning,
    xp_rate: xp,
    freshness: raw.freshness || "2026_gap_fill",
    confidence: raw.confidence || "confirmed_wiki",
    _gap_file: sourceFile,
  };
}

/**
 * Catalog method shape used by data/research/catalog.json.
 * Requires a source URL (row URL or skill wiki fallback).
 */
export function toCatalogMethod(raw, verifiedAt) {
  const skill = text(raw.skill, "Unknown");
  const method = pickMethodName(raw) || text(raw.method);
  if (!skill || skill === "Unknown" || !isHumanMethodName(method)) return null;

  const url = pickSourceUrl(raw);
  let source = sourceReference(url, method, verifiedAt);
  if (!source) source = wikiTrainingSource(skill, verifiedAt);
  if (!source?.url) return null;

  const regionHints = collectRegionHints(raw);
  const xpRate =
    text(raw.xp_rate) ||
    text(raw.base_xp_per_hour) ||
    text(raw.example_base_xp_per_hour) ||
    "not normalized yet";

  // notes may already be joined by coerceGapRecord
  const note =
    typeof raw.notes === "string" && raw.notes.includes("gap_file:")
      ? raw.notes
      : notesFrom(raw, raw._gap_file);

  return {
    id:
      raw.id && typeof raw.id === "string" && raw.id.includes(":") && !/^supply:|^combo:|^note:/.test(raw.id)
        ? raw.id
        : methodId(skill, method),
    skill,
    method,
    levelRange: text(raw.level_range || raw.level || ""),
    xpRate,
    intensity: text(raw.intensity || ""),
    location: locationFrom(raw),
    requirements: requirementsFrom(raw),
    requiredUnlock: text(raw.required_unlock || ""),
    resourceSource: text(raw.resource_source || raw.ore || raw.tree || ""),
    hardRegionRequirement: Boolean(raw.hard_region_requirement),
    regionHints,
    note,
    warning: text(raw.warning || raw.region_warning || ""),
    freshness: text(raw.freshness || "2026_gap_fill"),
    confidence: text(raw.confidence || "confirmed_wiki"),
    source,
  };
}

/** True when an existing catalog method title is a machine slug that should be pruned. */
export function isSlugCatalogMethod(method) {
  if (!method?.method) return true;
  return !isHumanMethodName(method.method);
}

export function dedupeNote(note) {
  if (!note) return "";
  const parts = String(note)
    .split(" · ")
    .map((p) => p.trim())
    .filter(Boolean);
  const seen = new Set();
  const unique = [];
  for (const part of parts) {
    if (seen.has(part)) continue;
    seen.add(part);
    unique.push(part);
  }
  return unique.join(" · ");
}

export function mergeNote(existingNote, incomingNote) {
  return dedupeNote([existingNote, incomingNote].filter(Boolean).join(" · "));
}
