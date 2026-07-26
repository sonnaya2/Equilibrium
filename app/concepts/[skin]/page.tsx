import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/Heading";
import { ConceptPage } from "@/concepts/live/ConceptPage";
import { loadConceptBuildProps } from "@/concepts/live/buildData";
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
    title: meta ? `${meta.label} concept` : "Concept",
    robots: { index: false, follow: false },
  };
}

export default async function ConceptHomePage({
  params,
}: {
  params: Promise<{ skin: string }>;
}) {
  const { skin: raw } = await params;
  if (!isLiveSkinId(raw)) notFound();
  const meta = getLiveSkin(raw)!;
  const catalog = getResearchCatalog();
  const build = loadConceptBuildProps();
  const base = `/concepts/${raw}`;

  return (
    <ConceptPage>
      <PageHeading title={meta.label} note={meta.thesis} />
      <div className="grid gap-4 md:grid-cols-2">
        <section className="panel">
          <div className="panel-head">This concept</div>
          <dl className="panel-body space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-parch-100">Shell</dt>
              <dd className="font-mono text-parch-50">{meta.layout}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-parch-100">Regions</dt>
              <dd className="font-mono text-parch-50">{catalog.regions.length}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-parch-100">Snapshot</dt>
              <dd className="font-mono text-parch-50">{build.snapshotDate}</dd>
            </div>
          </dl>
        </section>
        <section className="panel">
          <div className="panel-head">Open with real data</div>
          <ul className="divide-y divide-stone-750">
            {(
              [
                ["data", "Data"],
                ["build", "Build"],
                ["tasks", "Tasks"],
              ] as const
            ).map(([slug, name]) => (
              <li key={slug}>
                <Link
                  href={`${base}/${slug}`}
                  className="block px-3.5 py-3 text-sm font-medium text-gem-300 hover:bg-stone-raised"
                >
                  {name} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ConceptPage>
  );
}
