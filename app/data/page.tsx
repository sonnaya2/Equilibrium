import { ResearchBrowser } from "@/components/ResearchBrowser";
import { getResearchCatalog } from "@/research/catalog";

export default function DataPage() {
  return <ResearchBrowser catalog={getResearchCatalog()} />;
}
