import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/Heading";
import { ConceptDataLive } from "@/concepts/live/ConceptDataLive";
import { ConceptPage } from "@/concepts/live/ConceptPage";
import { getLiveSkin, isLiveSkinId, LIVE_CONCEPTS } from "@/concepts/skins/registry";
import { getResearchCatalog } from "@/research/catalog";

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
    title: meta ? `Data · ${meta.label}` : "Data concept",
    robots: { index: false, follow: false },
  };
}

export default async function ConceptDataPage({
  params,
}: {
  params: Promise<{ skin: string }>;
}) {
  const { skin: raw } = await params;
  if (!isLiveSkinId(raw)) notFound();
  const meta = getLiveSkin(raw)!;
  const catalog = getResearchCatalog();

  return (
    <ConceptPage>
      <PageHeading
        title="Data"
        note={`${meta.label} · ${meta.layout} · real catalog ${catalog.snapshotDate} · ${catalog.regions.length} regions`}
      />
      <ConceptDataLive
        layout={meta.layout}
        catalog={catalog}
        notes={
          <p className="text-sm text-parch-100">
            Live research under this shell.{" "}
            <Link href="/sources" className="text-parch-50 underline">
              Sources
            </Link>
          </p>
        }
      />
    </ConceptPage>
  );
}
