import { Page } from "@/components/Page";
import { ResearchBrowser } from "@/components/ResearchBrowser";
import { getResearchCatalog } from "@/research/catalog";

export default function DataPage() {
  return (
    <Page>
      <ResearchBrowser catalog={getResearchCatalog()} />
    </Page>
  );
}
