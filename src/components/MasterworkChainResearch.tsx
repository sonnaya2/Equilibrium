import { researchRows, ResearchSection, type ResearchTab } from "./ResearchSection";
import chain from "#shard/research/masterwork-staff-chain.json";

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

const regionPressure = researchRows(
  (chain.region_pressure as PressureRow[]).map((row) => {
    const source_urls = urlsFrom(row.source_url, row.secondary_source_url, row.region_source_url);
    return {
      ...row,
      name: row.component ?? "Component",
      source_urls: source_urls.length ? source_urls : undefined,
    };
  }),
);

export const MASTERWORK_CHAIN_TABS: ResearchTab[] = [
  {
    key: "region-pressure",
    label: "Regions",
    description: "",
    rows: regionPressure,
  },
  {
    key: "assembly",
    label: "Assembly",
    description: "",
    rows: researchRows(chain.assembly_evidence),
  },
  {
    key: "requirements",
    label: "Reqs",
    description: "",
    rows: researchRows(chain.requirements),
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
