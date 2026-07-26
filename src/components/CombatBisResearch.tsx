import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import combat from "../../data/research/regional-combat-unlocks.json";

const combatRows = combat.records as unknown as ResearchRow[];

const accounts = combatRows.filter((row) => row.recordType === "account");
const activities = combatRows.filter((row) => row.recordType === "activity");
const equipment = combatRows.filter((row) => row.recordType === "equipment");
const combos = combatRows.filter(
  (row) =>
    Boolean(row.comboLabel) ||
    (Array.isArray(row.requiredRegions) && (row.requiredRegions as string[]).length > 1),
);

const TABS: ResearchTab[] = [
  {
    key: "accounts",
    label: "Accounts",
    description: "",
    rows: accounts,
  },
  {
    key: "activities",
    label: "Activities",
    description: "",
    rows: activities,
  },
  {
    key: "equipment",
    label: "Equipment",
    description: "",
    rows: equipment,
  },
  {
    key: "combos",
    label: "Combos",
    description: "",
    rows: combos,
  },
];

export function CombatBisResearch() {
  return (
    <ResearchSection
      title="BiS"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search BiS"
      searchLabel="Search BiS"
    />
  );
}
