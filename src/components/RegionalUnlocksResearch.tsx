import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import skilling from "../../data/research/regional-skilling-unlocks.json";
import combat from "../../data/research/regional-combat-unlocks.json";

const skillingRows = skilling.records as unknown as ResearchRow[];
const combatRows = combat.records as unknown as ResearchRow[];

const skillingActivities = skillingRows.filter((row) => row.recordType === "activity");
const skillingEquipment = skillingRows.filter((row) => row.recordType === "equipment");
const combatAccounts = combatRows.filter((row) => row.recordType === "account");
const combatActivities = combatRows.filter((row) => row.recordType === "activity");
const combatEquipment = combatRows.filter((row) => row.recordType === "equipment");

const TABS: ResearchTab[] = [
  {
    key: "skilling-activities",
    label: "Skilling activities",
    description: "",
    rows: skillingActivities,
  },
  {
    key: "skilling-equipment",
    label: "Skilling equipment",
    description: "",
    rows: skillingEquipment,
  },
  {
    key: "combat-accounts",
    label: "Combat account",
    description: "",
    rows: combatAccounts,
  },
  {
    key: "combat-activities",
    label: "Combat activities",
    description: "",
    rows: combatActivities,
  },
  {
    key: "combat-equipment",
    label: "Combat equipment",
    description: "",
    rows: combatEquipment,
  },
];

export function RegionalUnlocksResearch() {
  return (
    <ResearchSection
      title="Regional"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search unlocks"
      searchLabel="Search unlocks"
    />
  );
}
