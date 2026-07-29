import type { Metadata } from "next";
import { Page } from "@/components/Page";
import { RegionPlanner } from "@/map/RegionPlanner";
import type { PlannerRegion } from "@/map/data/plannerRegion";
import { REGION_ANCHOR_BY_ID } from "@/map/data/regionAnchors";
import { REGION_METRICS_BY_ID } from "@/map/data/regionMetrics";
import { getResearchCatalog } from "@/research/catalog";
import { combatUnlockCountForRegion } from "@/research/combatClassification";
import type { RegionId } from "@/league";

export const metadata: Metadata = {
  title: "Map",
};

export default function MapPage() {
  const catalog = getResearchCatalog();
  const plannerRegions: PlannerRegion[] = catalog.regions.map((r) => {
    const upgrades = r.upgrades.map((u) => ({
      name: u.name,
      kind: u.category,
      ...(u.comboLabel ? { comboLabel: u.comboLabel } : {}),
      ...(u.requiredRegions?.length ? { requiredRegions: u.requiredRegions } : {}),
      ...(u.isRegionCombo ? { isRegionCombo: true as const } : {}),
    }));
    const combatUnlocks = combatUnlockCountForRegion(r.id);
    const multiRegionUnlocks = upgrades.filter(
      (u) =>
        u.isRegionCombo === true || (u.requiredRegions != null && u.requiredRegions.length > 1),
    ).length;

    return {
      id: r.id as RegionId,
      // In-game display names (Wilderness, Kharidian Desert, .) are our overlay
      // data in regionAnchors; the catalog keeps the short data names.
      name: REGION_ANCHOR_BY_ID.get(r.id as RegionId)?.name ?? r.name,
      availability: r.availability as PlannerRegion["availability"],
      quests: REGION_METRICS_BY_ID.get(r.id as RegionId)?.quests ?? 0,
      areas: r.areas,
      content: r.content.map((c) => ({ name: c.name, kind: c.kind, confidence: c.confidence })),
      upgrades,
      training: r.training.length,
      hardRules: r.hardRules,
      warnings: r.warnings,
      combatUnlocks,
      multiRegionUnlocks,
      sourceCount:
        (r.source ? 1 : 0) +
        r.content.filter((c) => c.source).length +
        r.upgrades.filter((u) => u.source).length +
        r.training.filter((t) => t.source).length,
      verifiedAt: r.source?.verifiedAt ?? null,
    };
  });

  return (
    <Page wide className="map-shell flex min-h-0 flex-1 flex-col">
      <RegionPlanner regions={plannerRegions} boundaryRules={catalog.hardRules} />
    </Page>
  );
}
