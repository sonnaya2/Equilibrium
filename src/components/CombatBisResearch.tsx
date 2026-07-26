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
    description: `${accounts.length} account-level combat unlocks and achievement passives with region pressure.`,
    rows: accounts,
  },
  {
    key: "activities",
    label: "Activities",
    description: `${activities.length} combat activities that change routing without becoming hard gates.`,
    rows: activities,
  },
  {
    key: "equipment",
    label: "Equipment",
    description: `${equipment.length} combat equipment unlocks including BiS chains with region combos.`,
    rows: equipment,
  },
  {
    key: "combos",
    label: "Combos",
    description: `${combos.length} multi-region BiS chains (combo label or multiple required regions).`,
    rows: combos,
  },
];

export function CombatBisResearch() {
  return (
    <ResearchSection
      title="Combat BiS"
      intro={`Regional combat BiS and support unlocks that change what a region is worth. ${combatRows.length} records (${combos.length} multi-region). Snapshot ${combat.snapshotDate}. Support-region notes stay optional unless marked all-required.`}
      tabs={TABS}
      searchPlaceholder="Search combat BiS unlocks"
      searchLabel="Search combat BiS unlocks"
    />
  );
}
