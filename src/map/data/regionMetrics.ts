/**
 * Per-region countable facts, joined from the canonical stores by region id.
 * quests = quests touching the region (quests.json region_group_counts) — the
 * auto-completion-relevant count and the only number with enough spread to
 * make the board read as data. content/upgrades/training/areas come from the
 * research catalog. Missing joins render as 0.
 */

import questsData from "#shard/league/quests.json";
import { getResearchCatalog } from "@/research/catalog";
import type { RegionId } from "@/league";

export interface RegionMetrics {
  id: RegionId;
  quests: number;
  content: number;
  upgrades: number;
  training: number;
  areas: number;
}

const touched = questsData.region_group_counts as Record<string, number>;

export const REGION_METRICS: readonly RegionMetrics[] = getResearchCatalog().regions.map(
  (region) => ({
    id: region.id as RegionId,
    quests: touched[region.id] ?? 0,
    content: region.content.length,
    upgrades: region.upgrades.length,
    training: region.training.length,
    areas: region.areas.length,
  }),
);

export const REGION_METRICS_BY_ID: ReadonlyMap<RegionId, RegionMetrics> = new Map(
  REGION_METRICS.map((m) => [m.id, m]),
);
