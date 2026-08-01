import { getResearchCatalog } from "@/research/catalog";
import {
  UNLOCK_SECTIONS,
  getRegionalPanel,
  getUnlockPanel,
  type UnlockSection,
} from "@/research/panels";

/** One region panel, rendered from SQLite. `regional` plus the unlock sections. */
export const dynamic = "force-static";

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

  if (panel === "regional") {
    return Response.json({ region: id, ...getRegionalPanel(region) });
  }
  if ((UNLOCK_SECTIONS as readonly string[]).includes(panel)) {
    return Response.json({
      region: id,
      section: panel,
      records: getUnlockPanel(region, panel as UnlockSection),
    });
  }
  return new Response("Not found", { status: 404 });
}
