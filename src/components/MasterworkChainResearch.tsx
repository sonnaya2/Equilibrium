import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import chain from "../../data/research/masterwork-staff-chain.json";

function urlsFrom(...values: unknown[]): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (typeof value === "string" && value.startsWith("https://") && !out.includes(value)) {
      out.push(value);
    }
  }
  return out;
}

type PressureRow = (typeof chain.region_pressure)[number] & {
  region_source_url?: string;
  secondary_source_url?: string;
  source_url?: string;
  component?: string;
};

const regionPressure = (chain.region_pressure as PressureRow[]).map((row) => {
  const source_urls = urlsFrom(row.source_url, row.secondary_source_url, row.region_source_url);
  return {
    ...row,
    name: row.component ?? "Component",
    source_urls: source_urls.length ? source_urls : undefined,
  };
}) as unknown as ResearchRow[];

export const MASTERWORK_CHAIN_TABS: ResearchTab[] = [
  {
    key: "region-pressure",
    label: "Region needs",
    description: "",
    rows: regionPressure,
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
      title="Masterwork staff"
      intro=""
      tabs={MASTERWORK_CHAIN_TABS}
      searchPlaceholder="Search"
      searchLabel="Search masterwork staff"
    />
  );
}
