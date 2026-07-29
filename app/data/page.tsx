import type { Metadata } from "next";
import { Page } from "@/components/Page";
import { getResearchCatalog } from "@/research/catalog";
import { DataWorkbenchHost } from "./DataWorkbenchHost";

export const metadata: Metadata = {
  title: "Data",
};

export default function DataPage() {
  const catalog = getResearchCatalog();

  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="workbench-fill data-workbench">
        <DataWorkbenchHost catalog={catalog} />
      </div>
    </Page>
  );
}
