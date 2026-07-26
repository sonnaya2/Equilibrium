/**
 * Shared region/relic/blessing data for Build Showcase concepts.
 * Live mutations go through useBuild / useShowcaseActions.
 */

import blessingsData from "#data/league/blessings.json";
import questsData from "#data/league/quests.json";
import regionsData from "#data/league/regions.json";
import relicsData from "#data/league/relics.json";
import type { RegionId } from "@/league";
import { REGION_ANCHOR_BY_ID } from "@/map/data/regionAnchors";

export type ShowcaseRegion = {
  id: string;
  name: string;
  availability: string;
  primaryQuests: number;
  touchedQuests: number;
};

export type ShowcaseRelic = {
  name: string;
  effects: string[];
};

export type ShowcaseRelicTier = {
  tier: number;
  revealed: boolean;
  choices: ShowcaseRelic[];
};

export type ShowcaseBlessingTier = {
  tier: number;
  revealed: boolean;
  paths: string[];
  godTier: boolean;
};

const primaryQuests = questsData.primary_region_counts as Record<string, number>;
const touchedQuests = questsData.region_group_counts as Record<string, number>;

export const SHOWCASE_REGIONS: ShowcaseRegion[] = regionsData.records.map((r) => ({
  id: r.id,
  name: REGION_ANCHOR_BY_ID.get(r.id as RegionId)?.name ?? r.name,
  availability: r.availability,
  primaryQuests: primaryQuests[r.id] ?? 0,
  touchedQuests: touchedQuests[r.id] ?? 0,
}));

export const SHOWCASE_RELIC_TIERS: ShowcaseRelicTier[] = relicsData.records.map((t) => ({
  tier: t.tier,
  revealed: t.revealed,
  choices: t.choices.map((c) => ({ name: c.name, effects: c.effects })),
}));

export const SHOWCASE_BLESSING_TIERS: ShowcaseBlessingTier[] = blessingsData.records.map(
  (t) => ({
    tier: t.tier,
    revealed: t.revealed,
    paths: t.paths,
    godTier: t.godTier,
  }),
);

export const RELIC_MONOGRAM: Record<string, string> = {
  Survivalist: "SV",
  "Endless Harvest": "EH",
  "Golden Touch": "GT",
};

/** Wiki hex icons (processed D stone-inset) — use in choice cells. */
export const RELIC_ICON: Record<string, string> = {
  Survivalist: "/game/relics/survivalist.png",
  "Endless Harvest": "/game/relics/endless-harvest.png",
  "Golden Touch": "/game/relics/golden-touch.png",
};

/** Official news splash portraits — use in detail / stage panels. */
export const RELIC_PORTRAIT: Record<string, string> = {
  Survivalist: "/game/relics/survivalist.jpg",
  "Endless Harvest": "/game/relics/endless-harvest.jpg",
  "Golden Touch": "/game/relics/golden-touch.jpg",
};

export const LEAGUE_ART = {
  header: "/game/leagues/header.png",
  map: "/game/leagues/map.jpg",
  regionlock: "/game/leagues/regionlock.jpg",
  relicMenu: "/game/leagues/relic-menu.jpg",
  blessingMenu: "/game/leagues/blessing-menu.jpg",
  relicPlate: "/game/leagues/relic-plate.jpg",
  trophy: "/game/leagues/trophy.jpg",
} as const;

export function relicMono(name: string | null | undefined): string {
  if (!name) return "·";
  return RELIC_MONOGRAM[name] ?? "·";
}

export function relicIcon(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  return RELIC_ICON[name];
}

export function relicPortrait(name: string | null | undefined): string | undefined {
  if (!name) return undefined;
  return RELIC_PORTRAIT[name];
}

export function availLabel(value: string): string {
  if (value === "automatic_early") return "early";
  if (value === "starting") return "start";
  if (value === "elective") return "pick";
  return value.replaceAll("_", " ");
}
