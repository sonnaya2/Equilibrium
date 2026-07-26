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
    description: `${skillingActivities.length} region-defining training activities, shops and infrastructure.`,
    rows: skillingActivities,
  },
  {
    key: "skilling-equipment",
    label: "Skilling equipment",
    description: `${skillingEquipment.length} outfits, off-hands, tools and consumable skilling supply chains.`,
    rows: skillingEquipment,
  },
  {
    key: "combat-accounts",
    label: "Combat account",
    description: `${combatAccounts.length} account-level combat unlocks and achievement passives with region pressure.`,
    rows: combatAccounts,
  },
  {
    key: "combat-activities",
    label: "Combat activities",
    description: `${combatActivities.length} combat activities that change routing without becoming hard gates.`,
    rows: combatActivities,
  },
  {
    key: "combat-equipment",
    label: "Combat equipment",
    description: `${combatEquipment.length} combat equipment unlocks with optional support-region notes.`,
    rows: combatEquipment,
  },
];

export function RegionalUnlocksResearch() {
  return (
    <ResearchSection
      title="Regional unlocks"
      intro="Skilling and combat unlocks that change what a region is worth. Support-region notes stay optional — they are not forced gates."
      tabs={TABS}
      searchPlaceholder="Search regional unlocks"
      searchLabel="Search regional unlocks"
    />
  );
}
