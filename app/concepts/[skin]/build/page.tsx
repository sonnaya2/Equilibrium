import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/Heading";
import { BuildPlanner } from "@/components/BuildPlanner";
import { ConceptPage } from "@/concepts/live/ConceptPage";
import { loadConceptBuildProps } from "@/concepts/live/buildData";
import { getLiveSkin, isLiveSkinId, LIVE_CONCEPTS } from "@/concepts/skins/registry";

export async function generateStaticParams() {
  return LIVE_CONCEPTS.map((s) => ({ skin: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ skin: string }>;
}): Promise<Metadata> {
  const { skin } = await params;
  const meta = getLiveSkin(skin);
  return {
    title: meta ? `Build · ${meta.label}` : "Build concept",
    robots: { index: false, follow: false },
  };
}

export default async function ConceptBuildPage({
  params,
}: {
  params: Promise<{ skin: string }>;
}) {
  const { skin: raw } = await params;
  if (!isLiveSkinId(raw)) notFound();
  const meta = getLiveSkin(raw)!;
  const { regions, relicTiers, blessingTiers, resetCount } = loadConceptBuildProps();

  return (
    <ConceptPage>
      <PageHeading
        title="Build planner"
        note={`${meta.label} · real regions/relics/blessings · picks sync with production Map`}
      />
      <BuildPlanner
        regions={regions}
        relicTiers={relicTiers}
        blessingTiers={blessingTiers}
        resetCount={resetCount}
      />
    </ConceptPage>
  );
}
