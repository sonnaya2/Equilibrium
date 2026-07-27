import archaeologySource from "../../data/research/planner-expansions-invention-archaeology.json";
import invention2026Source from "../../data/research/planner-expansions-invention-2026.json";
import perkSource from "../../data/research/planner-expansions-invention-perks.json";
import utilityPerkSource from "../../data/research/planner-expansions-invention-utility-perks.json";
import activePerkSource from "../../data/research/planner-expansions-invention-active-perks.json";
import coverageSource from "../../data/research/planner-expansions-invention-component-coverage.json";
import bottleneckSource from "../../data/research/planner-expansions-invention-material-bottlenecks.json";

export type AncientInventionMaterial =
  (typeof archaeologySource)["ancient_invention_materials"][number];
export type ArchaeologyDisassemblyBand =
  (typeof archaeologySource)["archaeology_disassembly_bands"][number];
export type CurrentWeaponPerkDependency =
  (typeof archaeologySource)["current_perk_component_dependencies"][number];
export type RareComponentRoute = (typeof archaeologySource)["rare_component_routes"][number];
export type New2026ComponentRoute =
  (typeof invention2026Source)["new_2026_component_routes"][number];
export type Current2026PerkDependency =
  (typeof invention2026Source)["current_2026_perk_dependencies"][number];
export type AccountComponentRoute =
  (typeof invention2026Source)["account_component_routes"][number];
export type ArmourPerkRecipe = (typeof perkSource)["current_armour_perk_recipes"][number];
export type UtilityPerkRecipe = (typeof utilityPerkSource)["utility_perk_recipes"][number];
export type ActiveInventionPerk = (typeof activePerkSource)["active_perks"][number];
export type PerkComponentSupplyRoute = (typeof perkSource)["component_supply_routes"][number];
export type GlobalOrAccountComponentRoute =
  (typeof perkSource)["global_or_account_component_routes"][number];
export type RemainingRareComponentRoute =
  (typeof coverageSource)["remaining_component_routes"][number];
export type PerkMaterialBottleneck = (typeof bottleneckSource)["materials"][number];

export function getAncientInventionMaterials(): AncientInventionMaterial[] {
  return archaeologySource.ancient_invention_materials;
}

export function getArchaeologyDisassemblyBands(): ArchaeologyDisassemblyBand[] {
  return archaeologySource.archaeology_disassembly_bands;
}

export function getCurrentWeaponPerkDependencies(): CurrentWeaponPerkDependency[] {
  return archaeologySource.current_perk_component_dependencies;
}

export function getRareComponentRoutes(): RareComponentRoute[] {
  return archaeologySource.rare_component_routes;
}

export function getNew2026ComponentRoutes(): New2026ComponentRoute[] {
  return invention2026Source.new_2026_component_routes;
}

export function getCurrent2026PerkDependencies(): Current2026PerkDependency[] {
  return invention2026Source.current_2026_perk_dependencies;
}

export function getAccountComponentRoutes(): AccountComponentRoute[] {
  return invention2026Source.account_component_routes;
}

export function getCurrentArmourPerkRecipes(): ArmourPerkRecipe[] {
  return perkSource.current_armour_perk_recipes;
}

export function getUtilityPerkRecipes(): UtilityPerkRecipe[] {
  return utilityPerkSource.utility_perk_recipes;
}

export function getActiveInventionPerks(): ActiveInventionPerk[] {
  return activePerkSource.active_perks;
}

export function getPerkComponentSupplyRoutes(): PerkComponentSupplyRoute[] {
  return perkSource.component_supply_routes;
}

export function getGlobalOrAccountComponentRoutes(): GlobalOrAccountComponentRoute[] {
  return perkSource.global_or_account_component_routes;
}

export function getRemainingRareComponentRoutes(): RemainingRareComponentRoute[] {
  return coverageSource.remaining_component_routes;
}

export function getRareComponentCoverageCount(): number {
  return coverageSource.coverage_after_this_file;
}

export function getPerkMaterialBottlenecks(): PerkMaterialBottleneck[] {
  return bottleneckSource.materials;
}
