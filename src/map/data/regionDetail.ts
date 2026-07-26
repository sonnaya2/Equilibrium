/**
 * Everything the catalog knows about one region, sorted into buckets you can
 * put behind tabs.
 *
 * The catalog's `kind` and `category` are freeform prose written by the sync
 * scripts — 44 distinct content kinds and over 100 upgrade categories across
 * eleven regions, things like "Elder God Wars Dungeon / skilling boss" and
 * "tier-90 augmentable Woodcutting tool cross-region chain". That is good
 * provenance and useless as a facet: a filter built straight off it gives you
 * twelve one-row options. So classify here, and keep the original string on the
 * row so the table can still show what the source actually said.
 *
 * Classification is deliberately keyword-order-sensitive and every rule is
 * listed rather than inferred. A row lands in exactly one bucket;
 * regionDetail.test.ts holds that, so a new kind from a future sync shows up as
 * a failing test rather than silently vanishing from a tab.
 */

import type { RegionId } from "@/league";
import { getResearchCatalog } from "@/research/catalog";

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

/** Skill names double as content kinds ("Hunter", "Fishing", "Agility", ...). */
const SKILL_NAMES = new Set(
  getResearchCatalog().skills.map((skill) => skill.name.toLowerCase()),
);

function classifyContent(kind: string): ContentBucket {
  const k = kind.toLowerCase();
  // Bossing wins over skilling: "Elder God Wars Dungeon / skilling boss" is a
  // boss you fight, not a skilling method, and the Slayer/combat hybrids read
  // the same way to a player planning a kill.
  if (BOSS_WORDS.some((word) => k.includes(word))) return "boss";
  if (k.includes("skilling") || SKILL_NAMES.has(k)) return "skilling";
  if (SKILL_NAMES.has(k.split(/[/ ]/)[0])) return "skilling";
  // Everything left is a place or a hub — Falador, Brimhaven area, City of Um.
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

const catalog = getResearchCatalog();

/** getResearchCatalog already resolves trainingMethodIds into region.training,
 *  but drops which skill each method belongs to; recover it from the skill tree. */
const SKILL_BY_METHOD_ID = new Map(
  catalog.skills.flatMap((skill) => (skill.methods ?? []).map((method) => [method.id, skill.name])),
);

export const REGION_DETAIL: ReadonlyMap<RegionId, RegionDetail> = new Map(
  catalog.regions.map((region) => {
    const content = region.content.map(row);
    const buckets = region.content.map((entry) => classifyContent(entry.kind ?? ""));
    const upgrades = region.upgrades.map(row);
    const upgradeBuckets = region.upgrades.map((entry) => classifyUpgrade(entry.category ?? ""));

    const training: TrainingRow[] = (region.training ?? []).map((m) => {
      return (
        {
          id: m.id,
          skill: SKILL_BY_METHOD_ID.get(m.id) ?? "",
          method: m.method,
          levelRange: m.levelRange ?? "",
          xpRate: m.xpRate ?? "",
          intensity: m.intensity ?? "",
          location: m.location ?? "",
          requirements: m.requirements ?? [],
          regionLocked: Boolean(m.hardRegionRequirement),
          note: m.note ?? "",
          warning: m.warning ?? "",
          confidence: m.confidence ?? "",
          sourceUrl: m.source?.url ?? null,
        }
      );
    });

    const detail: RegionDetail = {
      id: region.id as RegionId,
      bosses: content.filter((_, i) => buckets[i] === "boss"),
      skilling: content.filter((_, i) => buckets[i] === "skilling"),
      otherContent: content.filter((_, i) => buckets[i] === "area"),
      gear: upgrades.filter((_, i) => upgradeBuckets[i] === "gear"),
      skillItems: upgrades.filter((_, i) => upgradeBuckets[i] === "skillItem"),
      training,
      areas: region.areas ?? [],
      skills: region.skills ?? [],
      hardRules: region.hardRules ?? [],
      warnings: region.warnings ?? [],
      sourceCount: (region.source ? 1 : 0) + region.content.filter((c) => c.source).length,
      verifiedAt: region.source?.verifiedAt ?? null,
    };
    return [detail.id, detail];
  }),
);

/** Exposed for the test, which checks the rules cover every kind in the store. */
export const _classify = { classifyContent, classifyUpgrade };
