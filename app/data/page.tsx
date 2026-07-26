import { Page } from "@/components/Page";
import { PermanentUnlockResearch } from "@/components/PermanentUnlockResearch";
import { ProgressionResearch } from "@/components/ProgressionResearch";
import { ResearchBrowser } from "@/components/ResearchBrowser";
import { getResearchCatalog } from "@/research/catalog";

export default function DataPage() {
  return (
    <Page>
      <ResearchBrowser catalog={getResearchCatalog()} />
      <ProgressionResearch />
      <PermanentUnlockResearch />
    </Page>
  );
}
