import { ResearchSection, type ResearchRow, type ResearchTab } from "./ResearchSection";
import pass3 from "../../data/reference/permanent-unlocks-pass-3.json";
import pass5 from "../../data/reference/permanent-unlocks-pass-5.json";

const necromancyTiers = pass3.necromancy.tiers.map((tier) => ({
  name: `Tier ${tier.tier} · Necromancy ${tier.necromancy_level}`,
  category: `${tier.souls} soul${tier.souls === 1 ? "" : "s"} maximum`,
  unlocks: tier.unlocks,
  confidence: pass3.necromancy.confidence,
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
    description: `Talent tree tiers at the ${pass3.necromancy.location}. Up to ${pass3.necromancy.talent_points.maximum} talent points, earned only from Necromancy combat experience.`,
    rows: necromancyTiers as unknown as ResearchRow[],
  },
  {
    key: "archaeology",
    label: "Arch relics",
    description: `Combat-relevant relic powers. ${pass3.archaeology.active_relic_limit} relics can be active at once; monolith energy caps rise with qualification ranks.`,
    rows: archaeologyRelics as unknown as ResearchRow[],
  },
  {
    key: "dungeoneering",
    label: "Dungeoneering",
    description: "Token-bought permanent account buffs from Daemonheim.",
    rows: pass5.dungeoneering as unknown as ResearchRow[],
  },
  {
    key: "base-camp",
    label: "Base camp",
    description: "Anachronia base camp progression that feeds combat value back to the whole account.",
    rows: pass5.anachronia_base_camp as unknown as ResearchRow[],
  },
  {
    key: "farm",
    label: "Farm perks",
    description: pass5.farm_combat_perks.tier_1_account_rule,
    rows: farmPerks as unknown as ResearchRow[],
  },
  {
    key: "region-passives",
    label: "Region passives",
    description: "Achievement-set rewards with combat or region value, mapped to their base-game regions.",
    rows: pass5.region_achievement_passives as unknown as ResearchRow[],
  },
  {
    key: "account",
    label: "Account infrastructure",
    description: "Persistent account-wide combat infrastructure and where it comes from.",
    rows: pass5.account_combat_infrastructure as unknown as ResearchRow[],
  },
];

export function ProgressionSystemsResearch() {
  return (
    <ResearchSection
      title="Progression systems"
      intro="Progression systems with League overrides: Necromancy talents, combat Archaeology relics, and the account passives that alter combat or region value. Modelled as systems, not a flat best-in-slot list."
      tabs={TABS}
      searchPlaceholder="Search systems"
      searchLabel="Search progression systems"
    />
  );
}
