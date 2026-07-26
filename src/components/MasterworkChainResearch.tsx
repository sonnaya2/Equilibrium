import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import chain from "../../data/research/masterwork-staff-chain.json";

const TABS: ResearchTab[] = [
  {
    key: "region-pressure",
    label: "Region pressure",
    description: "",
    rows: chain.region_pressure as unknown as ResearchRow[],
  },
  {
    key: "assembly",
    label: "Assembly steps",
    description: "",
    rows: chain.assembly_evidence as unknown as ResearchRow[],
  },
  {
    key: "requirements",
    label: "Requirements",
    description: "",
    rows: chain.requirements as unknown as ResearchRow[],
  },
];

export function MasterworkChainResearch() {
  return (
    <ResearchSection
      title="Masterwork staff chain"
      intro={`${chain.name} · tier ${chain.tier} ${chain.style}`}
      tabs={TABS}
      searchPlaceholder="Search the chain"
      searchLabel="Search the Masterwork staff chain"
    />
  );
}
