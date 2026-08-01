import { getResearchCatalog, type ResearchRegion } from "@/research/catalog";
import { UNLOCK_SECTIONS } from "@/research/panels";

/**
 * One region's research payload, rendered from SQLite.
 *
 * Prerendered: `force-static` plus `generateStaticParams` means Next builds
 * these once from the database and serves them like files, so the /data browser
 * still lazy-loads a region at a time without a copy of the data living under
 * public/.
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return getResearchCatalog().regions.map((region) => ({ id: region.id }));
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const region: ResearchRegion | undefined = getResearchCatalog().regions.find(
    (candidate) => candidate.id === id,
  );
  if (!region) return new Response("Not found", { status: 404 });
  return Response.json({
    ...region,
    panelHrefs: {
      regional: `/data/regions/${id}/panels/regional`,
      unlocks: Object.fromEntries(
        UNLOCK_SECTIONS.map((section) => [section, `/data/regions/${id}/panels/${section}`]),
      ),
    },
  });
}
