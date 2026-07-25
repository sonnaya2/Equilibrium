import { Page } from "@/components/Page";
import { PageHeading } from "@/components/Heading";
import { MapLoader } from "@/map/MapLoader";
import { RegionPlanner, type PlannerRegion } from "@/map/RegionPlanner";
import { REGION_ANCHOR_BY_ID } from "@/map/data/regionAnchors";
import { REGION_METRICS_BY_ID } from "@/map/data/regionMetrics";
import { getResearchCatalog } from "@/research/catalog";
import type { RegionId } from "@/league";

function accessLabel(value: string): string {
  if (value === "automatic_early") return "first milestone";
  if (value === "starting") return "start";
  return "elective";
}

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
    hardRules: r.hardRules,
    warnings: r.warnings,
    sourceCount: (r.source ? 1 : 0) + r.content.filter((c) => c.source).length,
    verifiedAt: r.source?.verifiedAt ?? null,
  }));

  return (
    <Page>
      <PageHeading
        title="Region map"
        note="Misthalin and Havenhythe are fixed; Karamja unlocks at the first milestone. Pick three of the remaining eight. Build, tasks, and combat all read these picks."
      />
      <div className="mb-4">
        <MapLoader />
      </div>
      <RegionPlanner regions={plannerRegions} />

      <section className="panel mt-4">
        <div className="panel-head">What each pick opens</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Region</th>
              <th>Access</th>
              <th>Areas</th>
              <th>Training</th>
              <th>Upgrades</th>
            </tr>
          </thead>
          <tbody>
            {catalog.regions.map((region) => (
              <tr key={region.id}>
                <td className="font-medium text-parch-50">
                  {REGION_ANCHOR_BY_ID.get(region.id as RegionId)?.name ?? region.name}
                </td>
                <td>{accessLabel(region.availability)}</td>
                <td>{region.areas.join(" · ") || "—"}</td>
                <td className="num">{region.training.length}</td>
                <td className="num">{region.upgrades.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel mt-4">
        <div className="panel-head">Boundary rules</div>
        <div className="panel-body space-y-2">
          {catalog.hardRules.map((rule) => (
            <p key={rule} className="text-sm text-parch-300">
              {rule}
            </p>
          ))}
        </div>
      </section>
    </Page>
  );
}
