/**
 * Authoritative reconstruction of cast modifiers from explicit sources.
 * Host parity path: modifiersForResolvedModel(model, ability).
 * Worker path: modifiersFromSources(sources, league) uses the same factories.
 */
import type { AbilitySpec } from "../pipeline/calculateAbility";
import type { CombatModifier } from "../types";
import type { ResolvedLeagueRules } from "../league/ruleset";
import { leagueModifiers, setPieceContributionModifier } from "../league/ruleset";
import { additiveMeleeDamageModifier, amZiModifier, setDamageModifiers } from "../shared/equipment";
import {
  lungingPerkModifier,
  raceSlayerPerkModifier,
  ultimatumsPerkModifier,
} from "../shared/perks";
import { prayerDamageModifier, styleCurseById } from "../shared/prayers";
import { vulnerabilityModifier } from "../shared/vulnerability";
import { berserkersFuryModifier } from "../shared/berserkersFury";
import { salveDamageModifier, type ResolvedSalve, SALVE_VARIANTS } from "../shared/salveAmulet";
import {
  slayerHelmetDamageModifier,
  type ResolvedSlayerHelmet,
  type SlayerHelmetActivationSource,
  SLAYER_HELMET_TIERS,
} from "../shared/slayerHelmet";
import type { SerializableModifierSources } from "../solver/worker/serializable";
import type { ResolvedCombatModel, ResolvedModifierSources } from "./contracts";
import { reviveLeague } from "./simulationInput";

function setCountsMap(sources: SerializableModifierSources): Map<string, number> {
  return new Map(sources.setCounts);
}

/** Global modifiers shared by every ability (ultimatums/lunging appended per cast). */
export function buildGlobalModifiersFromSources(
  sources: ResolvedModifierSources,
  league: ResolvedLeagueRules,
): CombatModifier[] {
  const global: CombatModifier[] = [];
  global.push(
    ...setDamageModifiers(setCountsMap(sources), {
      pieceContribution: setPieceContributionModifier(league),
    }),
  );
  if (sources.vulnerability) global.push(vulnerabilityModifier());
  if (sources.styleCurseId && sources.styleCurseId !== "none") {
    const curse = styleCurseById(sources.styleCurseId);
    if (curse) global.push(prayerDamageModifier(curse));
  }
  if (sources.amZiFlatDamage > 0) global.push(amZiModifier(sources.amZiFlatDamage));
  if (sources.amHejDamageBonus > 0) {
    global.push(additiveMeleeDamageModifier(sources.amHejDamageBonus));
  }
  if (sources.slayer.demon > 0) {
    global.push(raceSlayerPerkModifier("demon", sources.target.demon === true));
  }
  if (sources.slayer.dragon > 0) {
    global.push(raceSlayerPerkModifier("dragon", sources.target.dragon === true));
  }
  if (sources.slayer.undead > 0) {
    global.push(raceSlayerPerkModifier("undead", sources.target.undead === true));
  }
  if (sources.slayerHelmet && sources.slayerHelmet.damageMult > 1) {
    const tier = SLAYER_HELMET_TIERS.find((t) => t.id === sources.slayerHelmet!.tierId);
    if (tier) {
      const resolved: ResolvedSlayerHelmet = {
        active: true,
        source: sources.slayerHelmet.source as SlayerHelmetActivationSource,
        tier,
        damageMult: sources.slayerHelmet.damageMult,
        hitChanceMult: tier.hitChanceMult,
        styleEligible: true,
        onSlayerTask: true,
        status: "active",
        analysisLabel: tier.label,
      };
      const mod = slayerHelmetDamageModifier(resolved);
      if (mod) global.push(mod);
    }
  }
  if (sources.salve && sources.salve.damageMult > 1) {
    const variant = SALVE_VARIANTS.find((v) => v.id === sources.salve!.variantId);
    if (variant) {
      const resolved: ResolvedSalve = {
        active: true,
        variant,
        damageMult: sources.salve.damageMult,
        hitChanceMult: variant.hitChanceMult,
        targetUndead: true,
        status: "active",
        analysisLabel: variant.label,
      };
      const mod = salveDamageModifier(resolved);
      if (mod) global.push(mod);
    }
  }
  global.push(...leagueModifiers(league));
  const furyBonus = sources.berserkersFuryBonus ?? 0;
  if (furyBonus > 0) {
    const fury = berserkersFuryModifier(furyBonus);
    if (fury) global.push(fury);
  }
  return global;
}

export function playerPoisonModifiersFromSources(
  sources: ResolvedModifierSources,
  league: ResolvedLeagueRules,
): CombatModifier[] {
  return buildGlobalModifiersFromSources(sources, league).filter(
    (modifier) => modifier.appliesToPlayerPoison === true,
  );
}

/**
 * Rebuild the cast-modifier factory used by simulate / simulateRevolution / worker.
 * Uses the historical reviveModifiers factories without React.
 */
export function modifiersFromSources(
  sources: ResolvedModifierSources,
  league: ResolvedLeagueRules,
): (ability: AbilitySpec) => CombatModifier[] {
  const global = buildGlobalModifiersFromSources(sources, league);
  return (ability: AbilitySpec) => [
    ...global,
    ...(sources.ultimatums > 0
      ? [ultimatumsPerkModifier(sources.ultimatums, ability.category)]
      : []),
    ...(sources.lunging > 0 ? [lungingPerkModifier(sources.lunging, ability.id)] : []),
  ];
}

/**
 * Reconstruct modifiers for one ability from an immutable resolved model.
 * Prefer this over storing castModifiersFor closures on presentation objects.
 */
export function modifiersForResolvedModel(
  model: ResolvedCombatModel,
  ability: AbilitySpec,
): CombatModifier[] {
  const league = reviveLeague(model.league);
  return modifiersFromSources(model.modifierSources, league)(ability);
}
