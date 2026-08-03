import { getResearchCatalog } from "@/research/catalog";
import {
  UNLOCK_SECTIONS,
  getRegionalPanel,
  getUnlockPanel,
  type UnlockSection,
} from "@/research/panels";

/**
 * One region panel from live SQLite. `dynamic` must be a static string.
 */
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return getResearchCatalog().regions.flatMap((region) =>
    ["regional", ...UNLOCK_SECTIONS].map((panel) => ({ id: region.id, panel })),
  );
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; panel: string }> },
) {
  const { id, panel } = await context.params;
  const region = getResearchCatalog().regions.find((candidate) => candidate.id === id);
  if (!region) return new Response("Not found", { status: 404 });

  const headers = { "Cache-Control": "private, no-store" };
  if (panel === "regional") {
    return Response.json({ region: id, ...getRegionalPanel(region) }, { headers });
  }
  if ((UNLOCK_SECTIONS as readonly string[]).includes(panel)) {
    return Response.json(
      {
        region: id,
        section: panel,
        records: getUnlockPanel(region, panel as UnlockSection),
      },
      { headers },
    );
  }
  return new Response("Not found", { status: 404 });
}
