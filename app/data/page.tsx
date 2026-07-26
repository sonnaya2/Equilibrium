import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/Page";
import { getResearchCatalog } from "@/research/catalog";
import { DataWorkbenchHost } from "./DataWorkbenchHost";

export const metadata: Metadata = {
  title: "Data",
  // Bust stale edge caches after browse shell rewrite.
  other: { "x-data-shell": "rail-stage-v2" },
};

export default function DataPage() {
  const catalog = getResearchCatalog();

  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="workbench-fill data-workbench">
        <header className="data-workbench__header">
          <span className="data-workbench__title">Data</span>
          <span className="data-workbench__summary">
            {catalog.datasets.regions} regions · {catalog.datasets.skills} skills ·{" "}
            {catalog.datasets.trainingMethods} methods
          </span>
          <Link href="/sources" className="data-workbench__sources">
            Sources
          </Link>
        </header>

        <DataWorkbenchHost
          catalog={catalog}
          notes={<p className="text-parch-300">Ironman only.</p>}
        />
      </div>
    </Page>
  );
}
