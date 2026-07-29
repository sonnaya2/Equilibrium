import type { Metadata } from "next";
import { Page } from "@/components/Page";
import { getResearchCatalog } from "@/research/catalog";
import { DataBrowserHost } from "./DataBrowserHost";

export const metadata: Metadata = {
  title: "Data",
};

export default function DataPage() {
  const catalog = getResearchCatalog();

  return (
    <Page className="!max-w-none !px-0 !py-0">
      <div className="route-fill data-browser">
        <DataBrowserHost catalog={catalog} />
      </div>
    </Page>
  );
}
