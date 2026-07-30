import { researchRows, ResearchSection, type ResearchTab } from "./ResearchSection";
import pass3 from "#data/reference/permanent-unlocks-pass-3.json";
import pass5 from "#data/reference/permanent-unlocks-pass-5.json";

const necromancyTiers = pass3.necromancy.tiers.map((tier) => ({
  name: `Tier ${tier.tier} · Necromancy ${tier.necromancy_level}`,
  category: `${tier.souls} soul${tier.souls === 1 ? "" : "s"} maximum`,
  unlocks: tier.unlocks,
  confidence: pass3.necromancy.confidence,
  region_hint: pass3.necromancy.region_hint,
  region_status: pass3.necromancy.region_status,
  source_urls: pass3.necromancy.source_urls,
}));

const archaeologyRelics = pass3.archaeology.relics.map((relic) => ({
  ...relic,
  confidence: pass3.archaeology.confidence,
}));

const farmPerks = pass5.farm_combat_perks.records.map((record) => ({
  ...record,
  confidence: pass5.farm_combat_perks.confidence,
}));

export const PROGRESSION_SYSTEM_TABS: ResearchTab[] = [
  {
    key: "necromancy",
    label: "Necro talents",
    description: "",
    rows: researchRows(necromancyTiers),
  },
  {
    key: "archaeology",
    label: "Arch relics",
    description: "",
    rows: researchRows(archaeologyRelics),
  },
  {
    key: "dungeoneering",
    label: "Dungeoneering",
    description: "",
    rows: researchRows(pass5.dungeoneering),
  },
  {
    key: "base-camp",
    label: "Base camp",
    description: "",
    rows: researchRows(pass5.anachronia_base_camp),
  },
  {
    key: "farm",
    label: "Farm perks",
    description: "",
    rows: researchRows(farmPerks),
  },
  {
    key: "region-passives",
    label: "Passives",
    description: "",
    rows: researchRows(pass5.region_achievement_passives),
  },
  {
    key: "account",
    label: "Account",
    description: "",
    rows: researchRows(pass5.account_combat_infrastructure),
  },
];

export function ProgressionSystemsResearch() {
  return (
    <ResearchSection
      title="Progression"
      intro=""
      tabs={PROGRESSION_SYSTEM_TABS}
      searchPlaceholder="Search"
      searchLabel="Search progression systems"
    />
  );
}
