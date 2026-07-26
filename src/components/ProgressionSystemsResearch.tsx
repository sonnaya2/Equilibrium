import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import pass3 from "../../data/reference/permanent-unlocks-pass-3.json";
import pass5 from "../../data/reference/permanent-unlocks-pass-5.json";

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

const TABS: ResearchTab[] = [
  {
    key: "necromancy",
    label: "Necromancy talents",
    description: "",
    rows: necromancyTiers as unknown as ResearchRow[],
  },
  {
    key: "archaeology",
    label: "Arch relics",
    description: "",
    rows: archaeologyRelics as unknown as ResearchRow[],
  },
  {
    key: "dungeoneering",
    label: "Dungeoneering",
    description: "",
    rows: pass5.dungeoneering as unknown as ResearchRow[],
  },
  {
    key: "base-camp",
    label: "Base camp",
    description: "",
    rows: pass5.anachronia_base_camp as unknown as ResearchRow[],
  },
  {
    key: "farm",
    label: "Farm perks",
    description: "",
    rows: farmPerks as unknown as ResearchRow[],
  },
  {
    key: "region-passives",
    label: "Region passives",
    description: "",
    rows: pass5.region_achievement_passives as unknown as ResearchRow[],
  },
  {
    key: "account",
    label: "Account",
    description: "",
    rows: pass5.account_combat_infrastructure as unknown as ResearchRow[],
  },
];

export function ProgressionSystemsResearch() {
  return (
    <ResearchSection
      title="Progression"
      intro=""
      tabs={TABS}
      searchPlaceholder="Search systems"
      searchLabel="Search systems"
    />
  );
}
