import type { Metadata } from "next";
import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";
import { RegionPlanner } from "@/map/RegionPlanner";
import type { PlannerRegion } from "@/map/data/plannerRegion";
import { REGION_ANCHOR_BY_ID } from "@/map/data/regionAnchors";
import { REGION_METRICS_BY_ID } from "@/map/data/regionMetrics";
import { getResearchCatalog } from "@/research/catalog";
import type { RegionId } from "@/league";

export const metadata: Metadata = {
  title: "Map",
  description:
    "Plan your three elective region picks for RS3 Leagues II: Equilibrium and see what each region opens.",
};

export default function MapPage() {
  const catalog = getResearchCatalog();
  const plannerRegions: PlannerRegion[] = catalog.regions.map((r) => ({
    id: r.id as RegionId,
    // In-game display names (Wilderness, Kharidian Desert, .) are our overlay
    // data in regionAnchors; the catalog keeps the short data names.
    name: REGION_ANCHOR_BY_ID.get(r.id as RegionId)?.name ?? r.name,
    availability: r.availability as PlannerRegion["availability"],
    quests: REGION_METRICS_BY_ID.get(r.id as RegionId)?.quests ?? 0,
    areas: r.areas,
    content: r.content.map((c) => ({ name: c.name, kind: c.kind, confidence: c.confidence })),
    upgrades: r.upgrades.map((u) => ({ name: u.name, kind: u.category })),
    training: r.training.length,
    hardRules: r.hardRules,
    warnings: r.warnings,
    // Region row + every content / upgrade / training row that carries a SourceReference.
    sourceCount:
      (r.source ? 1 : 0) +
      r.content.filter((c) => c.source).length +
      r.upgrades.filter((u) => u.source).length +
      r.training.filter((t) => t.source).length,
    verifiedAt: r.source?.verifiedAt ?? null,
  }));

  return (
    <Page>
      <PageHeading
        title="Region map"
        note="Misthalin and Havenhythe are fixed; Karamja unlocks at the first milestone. Pick three of the remaining eight. Map, Build, and Combat share these picks."
      />
      <RegionPlanner regions={plannerRegions} boundaryRules={catalog.hardRules} />
    </Page>
  );
}
