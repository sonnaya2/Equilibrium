import { getResearchCatalog, type ResearchRegion } from "@/research/catalog";
import { UNLOCK_SECTIONS } from "@/research/panels";

/**
 * One region's research payload from live SQLite.
 *
 * Must be a static string (`force-dynamic`). A NODE_ENV ternary is rejected by
 * Next route segment config parsing and 500s the route (empty Major unlocks).
 * Live read also keeps patch apply + data:rebuild visible without next build.
 */
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getResearchCatalog().regions.map((region) => ({ id: region.id }));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const region: ResearchRegion | undefined = getResearchCatalog().regions.find(
    (candidate) => candidate.id === id,
  );
  if (!region) return new Response("Not found", { status: 404 });
  return Response.json(
    {
      ...region,
      panelHrefs: {
        regional: `/data/regions/${id}/panels/regional`,
        unlocks: Object.fromEntries(
          UNLOCK_SECTIONS.map((section) => [section, `/data/regions/${id}/panels/${section}`]),
        ),
      },
    },
    {
      headers: {
        "Cache-Control": "private, no-store",
      },
    },
  );
}
