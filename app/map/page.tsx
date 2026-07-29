import type { Metadata } from "next";
import { Page } from "@/components/Page";
import { RegionPlanner } from "@/map/RegionPlanner";
import type { PlannerRegion } from "@/map/data/plannerRegion";
import { REGION_ANCHOR_BY_ID } from "@/map/data/regionAnchors";
import { REGION_METRICS_BY_ID } from "@/map/data/regionMetrics";
import { getResearchCatalog } from "@/research/catalog";
import type { RegionId } from "@/league";

export const metadata: Metadata = {
  title: "Map",
};

export default function MapPage() {
  const catalog = getResearchCatalog();
  const plannerRegions: PlannerRegion[] = catalog.regions.map((region) => ({
    id: region.id as RegionId,
    name: REGION_ANCHOR_BY_ID.get(region.id as RegionId)?.name ?? region.name,
    availability: region.availability as PlannerRegion["availability"],
    quests: REGION_METRICS_BY_ID.get(region.id as RegionId)?.quests ?? 0,
  }));

  return (
    <Page wide className="map-shell flex min-h-0 flex-1 flex-col">
      <RegionPlanner regions={plannerRegions} boundaryRules={catalog.hardRules} />
    </Page>
  );
}
