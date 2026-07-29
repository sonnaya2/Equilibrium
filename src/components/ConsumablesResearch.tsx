import { researchRows, ResearchSection, type ResearchTab } from "./ResearchSection";
import consumables from "../../data/reference/combat-consumables-pass-1.json";

const chain = consumables.overload_chain;

const TABS: ResearchTab[] = [
  {
    key: "overload",
    label: "Overloads",
    description: "",
    rows: researchRows(chain.records),
  },
  {
    key: "adrenaline",
    label: "Adrenaline",
    description: "",
    rows: researchRows(consumables.adrenaline),
  },
  {
    key: "bombs",
    label: "Bombs",
    description: "",
    rows: researchRows(consumables.bombs),
  },
  {
    key: "poison",
    label: "Poison",
    description: "",
    rows: researchRows(consumables.poison_stack),
  },
  {
    key: "production",
    label: "Production",
    description: "",
    rows: researchRows(consumables.production_infrastructure),
  },
];

export function ConsumablesResearch() {
  return (
    <ResearchSection
      title="Consumables"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search"
      searchLabel="Search consumables"
    />
  );
}
