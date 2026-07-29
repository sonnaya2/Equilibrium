/**
 * Maps freeform catalog kinds and categories into exclusive UI buckets.
 * Original values remain on each row; tests reject unclassified synced values.
 */

import type { RegionId } from "@/league";
import { SKILL_ICON_SLUGS } from "@/lib/dataIconIndex";
import type { ResearchRegion } from "@/research/catalog";

export type ContentBucket = "boss" | "skilling" | "area";
export type UpgradeBucket = "gear" | "skillItem";

export interface DetailRow {
  name: string;
  /** The catalog's own wording, kept verbatim for the table. */
  kind: string;
  detail: string;
  confidence: string;
  sourceUrl: string | null;
}

export interface TrainingRow {
  id: string;
  skill: string;
  method: string;
  levelRange: string;
  /** Raw xp/hr as authored; may be "" when the source gives no number. */
  xpRate: string;
  intensity: string;
  location: string;
  requirements: string[];
  /** True when the method only works with this region unlocked. */
  regionLocked: boolean;
  note: string;
  warning: string;
  confidence: string;
  sourceUrl: string | null;
}

export interface RegionDetail {
  id: RegionId;
  bosses: DetailRow[];
  skilling: DetailRow[];
  otherContent: DetailRow[];
  gear: DetailRow[];
  skillItems: DetailRow[];
  training: TrainingRow[];
  areas: string[];
  skills: string[];
  hardRules: string[];
  warnings: string[];
  sourceCount: number;
  verifiedAt: string | null;
}

/** Names that mark a row as combat content wherever they appear in its kind. */
const BOSS_WORDS = [
  "boss",
  "dungeon",
  "god wars",
  "gwd",
  "barrows",
  "sanctum",
  "ascension",
  "heart of gielinor",
  "raid",
  "slayer",
  "combat",
  "wilderness",
];

function classifyContent(kind: string): ContentBucket {
  const k = kind.toLowerCase();
  // Boss terms take precedence in mixed labels such as "skilling boss".
  if (BOSS_WORDS.some((word) => k.includes(word))) return "boss";
  if (k.includes("skilling") || SKILL_ICON_SLUGS.has(k)) return "skilling";
  if (SKILL_ICON_SLUGS.has(k.split(/[/ ]/)[0])) return "skilling";
  return "area";
}

/** Words that make an upgrade a skilling item rather than combat gear. */
const SKILL_ITEM_WORDS = [
  "skilling",
  "tool",
  "off-hand",
  "woodcutting",
  "mining",
  "fishing",
  "hunter",
  "farming",
  "archaeology",
  "crafting",
  "construction",
  "divination",
  "runecrafting",
  "invention",
  "herblore",
  "thieving",
  "gathering",
  "production",
];

function classifyUpgrade(category: string): UpgradeBucket {
  const c = category.toLowerCase();
  // Combat wording wins: "combat Archaeology relic" is a combat unlock that
  // happens to come from Archaeology, and a player reads it as gear.
  if (/\b(combat|weapon|armour|armor|cape|prayer|ability|scripture|invocation|tank)\b/.test(c)) {
    return "gear";
  }
  if (SKILL_ITEM_WORDS.some((word) => c.includes(word))) return "skillItem";
  return "gear";
}

function row(entry: {
  name: string;
  kind?: string;
  category?: string;
  detail?: string;
  confidence?: string;
  source?: { url?: string } | null;
}): DetailRow {
  return {
    name: entry.name,
    kind: entry.kind ?? entry.category ?? "",
    detail: entry.detail ?? "",
    confidence: entry.confidence ?? "",
    sourceUrl: entry.source?.url ?? null,
  };
}

export function makeRegionDetail(region: ResearchRegion): RegionDetail {
  const skillNames = new Set(region.skills.map((skill) => skill.toLowerCase()));
  const content = region.content.map(row);
  const buckets = region.content.map((entry) => {
    const kind = entry.kind ?? "";
    const bucket = classifyContent(kind);
    if (bucket !== "area") return bucket;
    const normalized = kind.toLowerCase();
    return skillNames.has(normalized) || skillNames.has(normalized.split(/[/ ]/)[0])
      ? "skilling"
      : "area";
  });
  const upgrades = region.upgrades.map(row);
  const upgradeBuckets = region.upgrades.map((entry) => classifyUpgrade(entry.category ?? ""));
  const training: TrainingRow[] = region.training.map((method) => ({
    id: method.id,
    skill: method.skill,
    method: method.method,
    levelRange: method.levelRange ?? "",
    xpRate: method.xpRate ?? "",
    intensity: method.intensity ?? "",
    location: method.location ?? "",
    requirements: method.requirements ?? [],
    regionLocked: Boolean(method.hardRegionRequirement),
    note: method.note ?? "",
    warning: method.warning ?? "",
    confidence: method.confidence ?? "",
    sourceUrl: method.source?.url ?? null,
  }));

  return {
    id: region.id as RegionId,
    bosses: content.filter((_, index) => buckets[index] === "boss"),
    skilling: content.filter((_, index) => buckets[index] === "skilling"),
    otherContent: content.filter((_, index) => buckets[index] === "area"),
    gear: upgrades.filter((_, index) => upgradeBuckets[index] === "gear"),
    skillItems: upgrades.filter((_, index) => upgradeBuckets[index] === "skillItem"),
    training,
    areas: region.areas,
    skills: region.skills,
    hardRules: region.hardRules,
    warnings: region.warnings,
    sourceCount: (region.source ? 1 : 0) + region.content.filter((entry) => entry.source).length,
    verifiedAt: region.source?.verifiedAt ?? null,
  };
}

/** Exposed for the test, which checks the rules cover every kind in the store. */
export const _classify = { classifyContent, classifyUpgrade };
