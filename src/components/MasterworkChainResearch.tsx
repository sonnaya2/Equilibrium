import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import chain from "../../data/research/masterwork-staff-chain.json";

const TABS: ResearchTab[] = [
  {
    key: "region-pressure",
    label: "Region pressure",
    description: "Component sources and whether each is a hard region lock or has cross-region alternatives.",
    rows: chain.region_pressure as unknown as ResearchRow[],
  },
  {
    key: "assembly",
    label: "Assembly steps",
    description: "The crafting chain from raw components to the finished tier-100 staff.",
    rows: chain.assembly_evidence as unknown as ResearchRow[],
  },
  {
    key: "requirements",
    label: "Requirements",
    description: "Account requirements the chain assumes.",
    rows: chain.requirements as unknown as ResearchRow[],
  },
];

export function MasterworkChainResearch() {
  return (
    <ResearchSection
      title="Masterwork staff chain"
      intro={`${chain.name}: tier ${chain.tier} ${chain.style}. ${chain.planner_summary.interpretation}`}
      tabs={TABS}
      searchPlaceholder="Search the chain"
      searchLabel="Search the Masterwork staff chain"
    />
  );
}
