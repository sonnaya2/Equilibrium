import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BuildShowcaseBleed } from "@/concepts/build-showcase/BuildShowcaseBleed";
import {
  BUILD_SHOWCASE_CONCEPTS,
  type BuildConceptId,
} from "@/concepts/build-showcase/teams";

const IDS = new Set(BUILD_SHOWCASE_CONCEPTS.map((c) => c.id));

export function generateStaticParams() {
  return BUILD_SHOWCASE_CONCEPTS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meta = BUILD_SHOWCASE_CONCEPTS.find((c) => c.id === id);
  return {
    title: meta ? `${meta.codename} · Build Showcase` : "Build Showcase",
    robots: { index: false, follow: false },
  };
}

export default async function BuildShowcaseConceptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: raw } = await params;
  if (!IDS.has(raw as BuildConceptId)) notFound();

  return <BuildShowcaseBleed id={raw as BuildConceptId} />;
}
