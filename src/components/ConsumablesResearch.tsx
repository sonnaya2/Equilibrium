import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import consumables from "../../data/reference/combat-consumables-pass-1.json";

const chain = consumables.overload_chain;

const TABS: ResearchTab[] = [
  {
    key: "overload",
    label: "Overload chain",
    description: `Permanent Herblore recipe progression from base overload (level ${chain.base_overload.herblore_level}) to elder overload salve. Recipes are bought from the ${chain.recipe_shop_gate.name} after ${chain.recipe_shop_gate.base_quest_gate} (${chain.recipe_shop_gate.region_hint}); relevant unreadable recipe pages must be found first.`,
    rows: chain.records as unknown as ResearchRow[],
  },
  {
    key: "adrenaline",
    label: "Adrenaline",
    description: "Adrenaline-management consumables and how each is unlocked.",
    rows: consumables.adrenaline as unknown as ResearchRow[],
  },
  {
    key: "bombs",
    label: "Bombs",
    description: "Thrown combat debuffs and their unlock route.",
    rows: consumables.bombs as unknown as ResearchRow[],
  },
  {
    key: "poison",
    label: "Poison",
    description: "Weapon poison tiers worth planning around.",
    rows: consumables.poison_stack as unknown as ResearchRow[],
  },
  {
    key: "production",
    label: "Production",
    description: "Optional infrastructure that changes batch production of combat consumables.",
    rows: consumables.production_infrastructure as unknown as ResearchRow[],
  },
];

export function ConsumablesResearch() {
  return (
    <ResearchSection
      title="Combat consumables"
      intro="Unlock and production dependencies for the consumables that change a League route. Live prices are deliberately excluded; availability and permanent recipe access are the planner inputs."
      tabs={TABS}
      searchPlaceholder="Search consumables"
      searchLabel="Search combat consumables"
    />
  );
}
