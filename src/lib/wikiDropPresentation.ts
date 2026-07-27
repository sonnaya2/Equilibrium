/**
 * Presentation-only drop grouping + rarity display for the wiki article modal.
 * Pure (no React). Never invents items or rates — only buckets, cleans labels,
 * and merges mechanic-scaled duplicates so long tables stay usable.
 */

import type { WikiDropRow } from "./wikiArticle";
import { cleanWikiFootnotes, hasNotedMark, parseDropQuantity } from "./wikiArticle";
import { resolveLocalAsset } from "./wikiLocalAssets";

export type DropRarityTier =
  "always" | "common" | "uncommon" | "rare" | "very-rare" | "varies" | "unknown";

export type DropGroupId = "unique" | "valuable" | "common";

export type PresentedDrop = {
  item: string;
  quantity: string;
  /** Footnote-clean rate string for the UI. */
  rate: string;
  rarityTier: DropRarityTier;
  iconUrl?: string | null;
  /** Original wiki section heading when known. */
  groupSource?: string | null;
  /** Drop is noted — show note badge, never "(noted)" text. */
  noted?: boolean;
};

export type PresentedDropGroup = {
  id: DropGroupId;
  label: string;
  rows: PresentedDrop[];
  /** Low-value / long filler — collapsed until the user expands. */
  collapsedByDefault: boolean;
  /**
   * When expanded, show this many rows before a "Show more" control.
   * 0 = no preview cap (unique chase lists).
   */
  previewLimit: number;
};

/** Default rows shown before "Show more" on long common/main tables. */
export const DROP_GROUP_PREVIEW_LIMIT = 12;

/**
 * Live wiki inventory glyph used as the noted-drop badge.
 * Magic notepaper is the familiar RS3 "this is a note" mark.
 */
export const NOTED_BADGE_ICON_URL = "https://runescape.wiki/images/Magic_notepaper.png";

const GROUP_LABEL: Record<DropGroupId, string> = {
  unique: "Unique drops",
  valuable: "Charms & secondary",
  common: "Main & materials",
};

// Note: bare "Rare drops" is ambiguous (Sanctum mixes chase + mats) — use chase names.
const UNIQUE_HEADING =
  /(?:^|\b)(?:unique|100\s*%|always(?:\s+drops?)?|rare\s+drop\s+table|chase)(?:\b|$)/i;
/** Charms / secondary only — Main is high-volume filler and belongs under common. */
const VALUABLE_HEADING = /(?:^|\b)(?:charms?|secondary|valuable)(?:\b|$)/i;
const COMMON_HEADING =
  /(?:^|\b)(?:main(?:\s+drops?)?|tertiary|seed|herb|suppl(?:y|ies)|common|miscellaneous|misc|material|salvage|alchem)(?:\b|$)/i;

const CHARM_ITEM = /\bcharm\b/i;
/** Common mats only — avoid bare "shard/essence" matching chase uniques. */
const SEED_HERB_ITEM =
  /\b(?:seed|grimy|herb|leaf|tar|ashes|bones?|feather|hide|logs?|ore|bar|rune tip|javelin heads?|salvage|nest|talisman|battlestaff|stone spirit|wood spirit)\b/i;
/** Chase / set uniques that must never fall into common via weak heuristics. */
const CHASE_ITEM =
  /\b(?:scripture|artefact|artifact|trove|core of|frozen core|remnants?|nilas|staff of|orb of|codex|pet|title|spore sack|sporehammer|foultorch|cryptbloom|roar of|ode to|shard of genesis|genesis essence|magma tempest|igneous|praesul|drygore|noxious|serrated|leng |dark ice|omni guard|soulbound|first necromancer|robes of the first|crown of the first|tzkal-zuk|magma core)\b/i;

/** Infer a rarity tier from cleaned rate text (wiki words or 1/N). */
export function rarityTierFromRate(rate: string): DropRarityTier {
  const t = rate.replace(/\s+/g, " ").trim().toLowerCase();
  if (!t) return "unknown";
  if (/\balways\b/.test(t)) return "always";
  if (/\bvaries\b/.test(t)) return "varies";
  if (/\bvery\s*rare\b/.test(t)) return "very-rare";
  if (/\buncommon\b/.test(t)) return "uncommon";
  if (/\bcommon\b/.test(t)) return "common";
  if (/\brare\b/.test(t)) return "rare";

  // Numeric rates: smaller denominator → more common (rough UI cue only).
  const frac = t.match(/1\s*\/\s*([\d,]+)/);
  if (frac) {
    const n = Number(frac[1].replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) return "unknown";
    if (n <= 25) return "common";
    if (n <= 100) return "uncommon";
    if (n <= 500) return "rare";
    return "very-rare";
  }
  // n/m style (e.g. 87/1000)
  const nm = t.match(/([\d,]+)\s*\/\s*([\d,]+)/);
  if (nm) {
    const a = Number(nm[1].replace(/,/g, ""));
    const b = Number(nm[2].replace(/,/g, ""));
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return "unknown";
    const p = a / b;
    if (p >= 0.2) return "common";
    if (p >= 0.05) return "uncommon";
    if (p >= 0.01) return "rare";
    return "very-rare";
  }
  return "unknown";
}

function headingBucket(heading: string | null | undefined): DropGroupId | null {
  if (!heading) return null;
  if (UNIQUE_HEADING.test(heading)) return "unique";
  if (COMMON_HEADING.test(heading)) return "common";
  if (VALUABLE_HEADING.test(heading)) return "valuable";
  return null;
}

function itemBucket(item: string, tier: DropRarityTier): DropGroupId | null {
  // Chase names win over seed/herb heuristics (Shard of Genesis, spore sack, …).
  if (CHASE_ITEM.test(item)) return "unique";
  if (CHARM_ITEM.test(item)) return "valuable";
  if (SEED_HERB_ITEM.test(item)) return "common";
  if (tier === "always" || tier === "very-rare" || tier === "rare") return "unique";
  if (tier === "uncommon") return "valuable";
  if (tier === "common") return "common";
  return null;
}

/** Map one structured drop row into a presentation bucket. */
export function classifyDropGroup(row: WikiDropRow): DropGroupId {
  const rate = cleanWikiFootnotes(row.rarity ?? "");
  const tier = rarityTierFromRate(rate);
  // Item chase before heading: "Rare drops" tables still mis-tag some rows as
  // main/common on multi-boss pages; chase names are authoritative.
  if (CHASE_ITEM.test(row.item)) return "unique";
  return (
    headingBucket(row.group) ??
    itemBucket(row.item, tier) ??
    (tier === "varies" ? "unique" : "common")
  );
}

export function presentDrop(row: WikiDropRow): PresentedDrop {
  const rate = cleanWikiFootnotes(row.rarity ?? "");
  const parsed = parseDropQuantity(row.quantity ?? "");
  const noted =
    row.noted === true ||
    parsed.noted ||
    hasNotedMark(row.item) ||
    hasNotedMark(row.quantity ?? "");
  // Prefer live wiki glyph; when the table cell had no img, try local inventory art.
  const wikiIcon = row.iconUrl?.trim() || null;
  const iconUrl = wikiIcon ?? resolveLocalAsset(row.item)?.src ?? null;
  return {
    item: row.item,
    quantity: parsed.quantity,
    rate,
    rarityTier: rarityTierFromRate(rate),
    iconUrl,
    groupSource: row.group ?? null,
    ...(noted ? { noted: true } : {}),
  };
}

/** Parse a qty cell into numeric bounds for merge (`7–12`, `3-5`, `2`). */
export function parseQtyBounds(qty: string): { min: number; max: number } | null {
  const t = qty.replace(/,/g, "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  const range = t.match(/^(\d+(?:\.\d+)?)\s*[–\-—~to]+\s*(\d+(?:\.\d+)?)$/i);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }
  const single = t.match(/^(\d+(?:\.\d+)?)$/);
  if (single) {
    const n = Number(single[1]);
    if (!Number.isFinite(n)) return null;
    return { min: n, max: n };
  }
  return null;
}

function formatQtyBounds(min: number, max: number): string {
  const a = Number.isInteger(min) ? String(min) : String(min);
  const b = Number.isInteger(max) ? String(max) : String(max);
  // Prefer en-dash to match wiki tables.
  return min === max ? a : `${a}–${b}`;
}

/**
 * Collapse mechanic-scaled duplicates (same item + rate + noted, different qty)
 * into one row with a merged quantity span. Keeps Arch-Glacor-style tables short.
 *
 * Also collapses normal/hard mode copies of the same unique (Zuk Scripture ×2)
 * into one row with combined rates: `1/100 · 1/50`.
 */
export function mergeDropVariants(rows: PresentedDrop[]): PresentedDrop[] {
  if (rows.length <= 1) return rows;

  type Acc = {
    row: PresentedDrop;
    min: number | null;
    max: number | null;
    /** Non-numeric qtys seen — if any, don't invent a range. */
    opaque: string[];
    rates: string[];
  };
  const order: string[] = [];
  const map = new Map<string, Acc>();

  for (const row of rows) {
    // Item+noted only — mode variants share a row (rates joined below).
    const key = `${row.item.toLowerCase()}\0${row.noted ? 1 : 0}`;
    const bounds = parseQtyBounds(row.quantity);
    const existing = map.get(key);
    if (!existing) {
      order.push(key);
      map.set(key, {
        row,
        min: bounds?.min ?? null,
        max: bounds?.max ?? null,
        opaque: bounds ? [] : row.quantity ? [row.quantity] : [],
        rates: row.rate ? [row.rate] : [],
      });
      continue;
    }
    // Prefer an icon when the first row lacked one.
    if (!existing.row.iconUrl && row.iconUrl) {
      existing.row = { ...existing.row, iconUrl: row.iconUrl };
    }
    if (row.rate && !existing.rates.includes(row.rate)) {
      existing.rates.push(row.rate);
    }
    if (bounds) {
      existing.min = existing.min == null ? bounds.min : Math.min(existing.min, bounds.min);
      existing.max = existing.max == null ? bounds.max : Math.max(existing.max, bounds.max);
    } else if (row.quantity && !existing.opaque.includes(row.quantity)) {
      existing.opaque.push(row.quantity);
    }
  }

  return order.map((key) => {
    const acc = map.get(key)!;
    const rate = acc.rates.length > 1 ? acc.rates.join(" · ") : (acc.rates[0] ?? acc.row.rate);
    if (acc.min != null && acc.max != null && acc.opaque.length === 0) {
      return {
        ...acc.row,
        quantity: formatQtyBounds(acc.min, acc.max),
        rate,
        rarityTier: rarityTierFromRate(acc.rates[0] ?? acc.row.rate),
      };
    }
    if (acc.opaque.length && acc.min != null && acc.max != null) {
      return { ...acc.row, rate };
    }
    return { ...acc.row, rate };
  });
}

/**
 * Split structured drops into up to three dense columns.
 * Empty groups omitted. Long main/materials lists collapse + preview-cap.
 */
export function groupDropsForPresentation(rows: WikiDropRow[]): PresentedDropGroup[] {
  const buckets: Record<DropGroupId, PresentedDrop[]> = {
    unique: [],
    valuable: [],
    common: [],
  };

  for (const row of rows) {
    const presented = presentDrop(row);
    if (!presented.item) continue;
    buckets[classifyDropGroup(row)].push(presented);
  }

  const out: PresentedDropGroup[] = [];
  for (const id of ["unique", "valuable", "common"] as const) {
    const list = mergeDropVariants(buckets[id]);
    if (!list.length) continue;
    const long = list.length > DROP_GROUP_PREVIEW_LIMIT;
    out.push({
      id,
      label: GROUP_LABEL[id],
      rows: list,
      // Unique stays open. Valuable only collapses when oversized. Common always soft-hides.
      collapsedByDefault: id === "common" || (id === "valuable" && long),
      previewLimit: id === "unique" ? 0 : DROP_GROUP_PREVIEW_LIMIT,
    });
  }
  return out;
}

/**
 * Chase / unique strip for the hero modules — prefer unique bucket, then rare tiers.
 * Cap keeps the strip small.
 */
export function notableDropsForPresentation(rows: WikiDropRow[], cap = 8): PresentedDrop[] {
  if (!rows.length) return [];
  const presented = rows.map(presentDrop).filter((r) => r.item);
  const uniqueFirst = presented.filter((r) => {
    const src = r.groupSource ?? "";
    return UNIQUE_HEADING.test(src) || CHASE_ITEM.test(r.item);
  });
  const pool =
    uniqueFirst.length > 0
      ? uniqueFirst
      : presented.filter(
          (r) =>
            r.rarityTier === "very-rare" ||
            r.rarityTier === "rare" ||
            r.rarityTier === "always" ||
            r.rarityTier === "varies",
        );
  const seen = new Set<string>();
  const out: PresentedDrop[] = [];
  for (const row of pool.length ? pool : presented) {
    const key = row.item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
    if (out.length >= cap) break;
  }
  return out;
}

/** Compact fact labels preferred for the hero stat strip (real infobox only). */
const PREFERRED_FACT_LABELS = [
  /combat\s*level/i,
  /^level$/i,
  /life\s*points?|lp\b/i,
  /weakness/i,
  /style|attack\s*style|combat\s*style/i,
  /location|area|region/i,
  /release|released/i,
  /slayer/i,
  /aggressive|poisonous/i,
  /members/i,
];

export function pickHeroFacts(
  facts: { label: string; value: string }[],
  limit = 4,
): { label: string; value: string }[] {
  if (!facts.length) return [];
  const ranked = [...facts].sort((a, b) => {
    const ia = PREFERRED_FACT_LABELS.findIndex((re) => re.test(a.label));
    const ib = PREFERRED_FACT_LABELS.findIndex((re) => re.test(b.label));
    const sa = ia < 0 ? 99 : ia;
    const sb = ib < 0 ? 99 : ib;
    return sa - sb;
  });
  const out: { label: string; value: string }[] = [];
  const seen = new Set<string>();
  let hasCombatLevel = false;
  for (const f of ranked) {
    const key = f.label.toLowerCase();
    if (seen.has(key)) continue;
    if (!f.value.trim()) continue;
    // Skip giant JSON-looking or edit-placeholder junk.
    if (f.value.length > 80) continue;
    if (/\{\s*"/.test(f.value) || /^\?\s*\(edit\)/i.test(f.value)) continue;
    // Bare "Level" is usually Slayer level — skip once combat level is shown.
    if (hasCombatLevel && /^level$/i.test(f.label)) continue;
    seen.add(key);
    if (/combat\s*level/i.test(f.label)) hasCombatLevel = true;
    // Light cleanup of wiki region ticks / update links residue.
    const value = cleanWikiFootnotes(f.value)
      .replace(/\s*[✓✔]\s*$/u, "")
      .replace(/\s*\(\s*Update\s*\)\s*$/i, "")
      .trim();
    if (!value) continue;
    out.push({ label: f.label, value });
    if (out.length >= limit) break;
  }
  return out;
}
