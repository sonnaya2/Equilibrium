/**
 * Free-text game names → local public/game icon paths for wiki article UI.
 * Prefer null over wrong art. No network. No React.
 */

import {
  activityIconPath,
  bossIconPath,
  dataEntityIconPath,
  equipmentIconPath,
  skillIconPath,
  slugifyIconLabel,
  upgradeIconPath,
} from "@/lib/gameArt";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { resolveRewardIconLabel } from "@/lib/rewardIconAliases";

export type LocalAsset = {
  src: string;
  label: string;
  kind: "item" | "boss" | "activity" | "upgrade" | "skill" | "other";
};

const DEFAULT_CAP = 24;

/** Trailing list noise stripped before resolve (display label stays original). */
const TRAILING_NOISE =
  /\s+(?:components?|equipment|upgrades?|armour sets?|armor sets?|armours?|armors?|weapons?|sets?|materials?|path|ladder|residual|drops?|table|uniques?)$/i;

/** Labels that must never become icons. */
const LABEL_NOISE =
  /^(?:including|plus|source|see|also|etc|unlocks|effects|level|t\d+|none|yes|no|n\/a|varies|unknown|aggressive|passive|always|common|uncommon|rare|very rare|always drops?|rarity|quantity|examine|release|update)$/i;

function cleanLabel(label: string): string {
  return decodeHtmlEntities(String(label ?? ""))
    .replace(/\s+/g, " ")
    .trim();
}

function isNoiseLabel(label: string): boolean {
  if (!label || label.length < 2) return true;
  if (label.length > 80) return true;
  // Pure numbers / percents / quantities.
  if (/^\d+([,.]\d+)?%?$/.test(label)) return true;
  if (/^(?:x?\d+|[\d,]+(?:\s*[-–]\s*[\d,]+)?)$/i.test(label)) return true;
  if (LABEL_NOISE.test(label.toLowerCase())) return true;
  // Multi-item prose lists belong to the caller as separate tokens.
  if ((label.match(/,/g) ?? []).length >= 2 && label.length > 48) return true;
  return false;
}

function kindFromPath(src: string): LocalAsset["kind"] {
  if (src.startsWith("/game/bosses/")) return "boss";
  if (src.startsWith("/game/activities/")) return "activity";
  if (src.startsWith("/game/skills/")) return "skill";
  if (src.startsWith("/game/upgrades/")) return "upgrade";
  if (src.startsWith("/game/combat/equipment/")) return "item";
  if (src.startsWith("/game/combat/")) return "item";
  return "other";
}

/** Accept only published local /game/ paths — never external URLs. */
function acceptLocalPath(src: string | null | undefined): string | null {
  if (!src) return null;
  if (!src.startsWith("/game/")) return null;
  if (src.includes("://") || src.startsWith("//")) return null;
  return src;
}

function toAsset(src: string, label: string): LocalAsset {
  return { src, label, kind: kindFromPath(src) };
}

/** Resolve variants of one free-text label (original kept as display label). */
function attemptLabels(raw: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (s: string) => {
    const t = cleanLabel(s);
    if (!t) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };

  push(raw);
  const stripped = raw.replace(TRAILING_NOISE, "").trim();
  push(stripped);
  // "Bonecrusher (charged)" / "Kerapac (EGWD)" / drop "noted"
  const noParen = raw
    .replace(/\s*\([^)]*\)/g, " ")
    .replace(/\s+noted\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  push(noParen);
  // First clause only for epithets / slash compounds when full string misses.
  const firstComma = raw.split(",")[0]?.trim() ?? "";
  push(firstComma);
  const firstSlash = raw.split(/\s*\/\s*/)[0]?.trim() ?? "";
  if (firstSlash.split(/\s+/).length <= 6) push(firstSlash);
  // Drop-table “Item seed” / “Item shard” keep full; try without leading “The ”.
  push(raw.replace(/^the\s+/i, ""));
  // “Fractured Staff of Armadyl piece” → stem before piece/token/page.
  const stem = raw
    .replace(/\s+(?:piece|page|token|tip|hilt|shard|seed|ornament\s+kit)s?\s*$/i, "")
    .trim();
  if (stem.length >= 3 && stem.toLowerCase() !== raw.toLowerCase()) push(stem);

  return out;
}

/**
 * Resolves one label to a published local path or null.
 */
export function resolveLocalAsset(label: string): LocalAsset | null {
  const raw = cleanLabel(label);
  if (isNoiseLabel(raw)) return null;

  for (const attempt of attemptLabels(raw)) {
    if (isNoiseLabel(attempt)) continue;

    // 1) Explicit reward alias map (verified inventory art only).
    const aliased = acceptLocalPath(resolveRewardIconLabel(attempt));
    if (aliased) return toAsset(aliased, raw);

    // 2) Upgrade / permanent-unlock inventory art (exact + alias only).
    const up = acceptLocalPath(upgradeIconPath(attempt));
    if (up) return toAsset(up, raw);

    // 3) Equipment closed set.
    const equip = acceptLocalPath(equipmentIconPath(slugifyIconLabel(attempt)));
    if (equip) return toAsset(equip, raw);

    // 4) Boss plates (exact / epithet / long-name containment).
    const boss = acceptLocalPath(bossIconPath(attempt));
    if (boss) return toAsset(boss, raw);

    // 5) Activities / hubs (exact + alias only).
    const act = acceptLocalPath(activityIconPath(attempt));
    if (act) return toAsset(act, raw);

    // 6) Exact skill title only (never first-clause of a package).
    const skill = acceptLocalPath(skillIconPath(attempt));
    if (skill) return toAsset(skill, raw);

    // 7) Broader data-entity resolver last — still prefers null over weak hits.
    const entity = acceptLocalPath(dataEntityIconPath({ name: attempt }));
    if (entity) return toAsset(entity, raw);
  }

  return null;
}

/**
 * Resolve many labels, dedupe by src, cap N (default 24).
 */
export function resolveLocalAssets(
  labels: readonly string[],
  cap: number = DEFAULT_CAP,
): LocalAsset[] {
  const out: LocalAsset[] = [];
  const seenSrc = new Set<string>();
  const limit = Math.max(0, cap);
  for (const label of labels) {
    if (out.length >= limit) break;
    const hit = resolveLocalAsset(label);
    if (!hit || seenSrc.has(hit.src)) continue;
    seenSrc.add(hit.src);
    out.push(hit);
  }
  return out;
}

/**
 * From wiki drop rows / facts / title, collect displayable local assets
 * (excludes primaryArtSrc if passed).
 */
export function collectArticleAssets(input: {
  title: string;
  dropItems: readonly string[];
  factValues?: readonly string[];
  primaryArtSrc?: string | null;
  extraLabels?: readonly string[];
}): LocalAsset[] {
  const labels: string[] = [];
  const title = cleanLabel(input.title);
  if (title) labels.push(title);
  for (const d of input.dropItems ?? []) {
    const t = cleanLabel(d);
    if (t) labels.push(t);
  }
  for (const f of input.factValues ?? []) {
    const t = cleanLabel(f);
    if (t) labels.push(t);
  }
  for (const e of input.extraLabels ?? []) {
    const t = cleanLabel(e);
    if (t) labels.push(t);
  }

  const primary = cleanLabel(input.primaryArtSrc ?? "") || null;
  // Resolve with slight headroom so excluding primary still fills the cap.
  const resolved = resolveLocalAssets(labels, DEFAULT_CAP + 8);
  const out: LocalAsset[] = [];
  const seen = new Set<string>();
  for (const asset of resolved) {
    if (primary && asset.src === primary) continue;
    if (seen.has(asset.src)) continue;
    seen.add(asset.src);
    out.push(asset);
    if (out.length >= DEFAULT_CAP) break;
  }
  return out;
}
