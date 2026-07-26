import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import consumables from "../../data/reference/combat-consumables-pass-1.json";

const chain = consumables.overload_chain;

const TABS: ResearchTab[] = [
  {
    key: "overload",
    label: "Overload chain",
    description: "",
    rows: chain.records as unknown as ResearchRow[],
  },
  {
    key: "adrenaline",
    label: "Adrenaline",
    description: "",
    rows: consumables.adrenaline as unknown as ResearchRow[],
  },
  {
    key: "bombs",
    label: "Bombs",
    description: "",
    rows: consumables.bombs as unknown as ResearchRow[],
  },
  {
    key: "poison",
    label: "Poison",
    description: "",
    rows: consumables.poison_stack as unknown as ResearchRow[],
  },
  {
    key: "production",
    label: "Production",
    description: "",
    rows: consumables.production_infrastructure as unknown as ResearchRow[],
  },
];

export function ConsumablesResearch() {
  return (
    <ResearchSection
      title="Consumables"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search consumables"
      searchLabel="Search consumables"
    />
  );
}
