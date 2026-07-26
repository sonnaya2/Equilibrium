import type { Metadata } from "next";
import Link from "next/link";
import { Page } from "@/components/Page";
import { getResearchCatalog } from "@/research/catalog";
import { DataWorkbenchHost } from "./DataWorkbenchHost";

export const metadata: Metadata = {
  title: "Data",
  description:
    "Region content, progression, and sourced game data for the Equilibrium planner.",
};

export default function DataPage() {
  const catalog = getResearchCatalog();

  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="workbench-fill">
        <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-parch-100">
          <span className="font-medium text-parch-50">Data</span>
          <span className="font-mono text-parch-300">
            {catalog.datasets.regions}r · {catalog.datasets.skills}s ·{" "}
            {catalog.datasets.trainingMethods}m · {catalog.snapshotDate}
          </span>
          <Link href="/sources" className="ml-auto text-gem-300 hover:underline">
            Sources
          </Link>
        </div>

        <DataWorkbenchHost
          catalog={catalog}
          notes={
            <p className="text-sm text-parch-100">
              Ironman / self-sufficient only. Each row carries its own source. Policy on{" "}
              <Link href="/sources" className="text-gem-300 hover:underline">
                Sources
              </Link>
              .
            </p>
          }
        />
      </div>
    </Page>
  );
}
