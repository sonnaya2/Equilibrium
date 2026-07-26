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
      <div className="workbench-fill">
        <div className="mb-1 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-parch-100">
          <span className="font-medium text-parch-50">Data</span>
          <span className="text-parch-300">
            {catalog.datasets.regions} regions · {catalog.datasets.skills} skills ·{" "}
            {catalog.datasets.trainingMethods} methods
          </span>
          <Link href="/sources" className="ml-auto text-gem-300 hover:underline">
            Sources
          </Link>
        </div>

        <DataWorkbenchHost
          catalog={catalog}
          notes={<p className="text-parch-300">Ironman only.</p>}
        />
      </div>
    </Page>
  );
}
