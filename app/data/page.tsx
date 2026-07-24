import { ResearchBrowser } from "@/components/ResearchBrowser";
import { getCurrentResearchCatalog } from "@/research/currentCatalog";

export default function DataPage() {
  return <ResearchBrowser catalog={getCurrentResearchCatalog()} />;
}
