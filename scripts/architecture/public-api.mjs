/**
 * Deliberate public symbols re-exported from src/combat/index.ts.
 * Used by architecture audit + reachability inventory.
 * Paths that re-export * are expanded via AST inventory, not listed here.
 */
export const PUBLIC_BARREL_MODULES = [
  "src/combat/core/damagePerLevel",
  "src/combat/core/ticks",
  "src/combat/core/rounding",
  "src/combat/core/damagePotential",
  "src/combat/core/hitCaps",
  "src/combat/core/critical",
  "src/combat/core/defence",
  "src/combat/core/lifePoints",
  "src/combat/core/abilityDamage",
  "src/combat/pipeline/modifierPipeline",
  "src/combat/pipeline/calculateHit",
  "src/combat/pipeline/calculateAbility",
  "src/combat/target/genericTarget",
  "src/combat/types",
  "src/combat/shared/perks",
  "src/combat/shared/equipment",
  "src/combat/shared/equipmentStats",
  "src/combat/shared/abilityAvailability",
  "src/combat/shared/prayers",
  "src/combat/shared/vulnerability",
  "src/combat/shared/berserkersFury",
  "src/combat/shared/furyOfTheSmall",
  "src/combat/shared/adrenalineGain",
  "src/combat/shared/adrenalineTransaction",
  "src/combat/shared/heightenedSenses",
  "src/combat/shared/conservationOfEnergy",
  "src/combat/shared/ringOfVigour",
  "src/combat/shared/slayerHelmet",
  "src/combat/shared/salveAmulet",
  "src/combat/shared/onHitEligibility",
  "src/combat/shared/archaeologyRelics",
  "src/combat/shared/potions",
  "src/combat/engine/simulation/contracts",
  "src/combat/engine/runtime/events",
  "src/combat/engine/simulation/simulate",
  "src/combat/engine/simulation/revolution",
  "src/combat/league/ruleset",
  "src/combat/league/icyenicFaith",
  "src/combat/league/damage",
  "src/combat/abilities/registry",
  "src/combat/data/sources",
  "src/combat/data/availability",
  "src/combat/solver",
];

/** Modules that must NOT appear as star-exports from the public barrel. */
export const BARREL_BANNED_STAR_PREFIXES = [
  "src/combat/engine/cast",
  "src/combat/engine/resolution",
  "src/combat/engine/runtime/clock",
  "src/combat/engine/runtime/runtime",
  "src/combat/engine/schedulers",
  "src/combat/styles/melee/abilities",
  "src/combat/styles/ranged/abilities",
  "src/combat/styles/magic/abilities",
  "src/combat/styles/necromancy/abilities",
  "src/combat/styles/melee/effects",
  "src/combat/styles/ranged/effects",
  "src/combat/styles/magic/effects",
  "src/combat/styles/ranged/ammo",
  "src/combat/styles/melee/bloodlust",
  "src/combat/styles/magic/runicCharge",
  "src/combat/styles/magic/burn",
  "src/combat/styles/necromancy/necrosis",
  "src/combat/styles/necromancy/souls",
  "src/combat/styles/necromancy/conjures",
  "src/combat/styles/ranged/onHit",
  "src/combat/engine/runtime/state",
  "src/combat/engine/runtime/timing",
  "src/combat/shared/damageProvenance",
];

/**
 * True when a star-export target (repo-relative, no extension) hits the ban list.
 * @param {string} mod e.g. "src/combat/styles/melee/abilities"
 */
export function isBannedBarrelStarExport(mod) {
  for (const banned of BARREL_BANNED_STAR_PREFIXES) {
    if (mod === banned || mod.startsWith(banned + "/")) return true;
  }
  return false;
}
