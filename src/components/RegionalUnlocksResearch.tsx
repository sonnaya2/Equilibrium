import { researchRows, ResearchSection, type ResearchTab } from "./ResearchSection";
import skilling from "../../data/research/regional-skilling-unlocks.json";
import combat from "../../data/research/regional-combat-unlocks.json";

const skillingRows = researchRows(skilling.records);
const combatRows = researchRows(combat.records);

const skillingActivities = skillingRows.filter((row) => row.recordType === "activity");
const skillingEquipment = skillingRows.filter((row) => row.recordType === "equipment");
const combatAccounts = combatRows.filter((row) => row.recordType === "account");
const combatActivities = combatRows.filter((row) => row.recordType === "activity");
const combatEquipment = combatRows.filter((row) => row.recordType === "equipment");

const TABS: ResearchTab[] = [
  {
    key: "skilling-activities",
    label: "Skilling",
    description: "",
    rows: skillingActivities,
  },
  {
    key: "skilling-equipment",
    label: "Skilling gear",
    description: "",
    rows: skillingEquipment,
  },
  {
    key: "combat-accounts",
    label: "Account",
    description: "",
    rows: combatAccounts,
  },
  {
    key: "combat-activities",
    label: "Combat",
    description: "",
    rows: combatActivities,
  },
  {
    key: "combat-equipment",
    label: "Combat gear",
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
      searchPlaceholder="Search"
      searchLabel="Search regional unlocks"
    />
  );
}
