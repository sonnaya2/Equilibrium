import { mulFloor } from "../../core/rounding";
import { MODERNISATION_PATCH_2, MODERNISATION_WIKI } from "../../data/sources";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { CHAOS_ROAR_DAMAGE_MULTIPLIER } from "../../styles/melee/abilities";
import { BERSERK_DAMAGE_MULTIPLIER } from "../../styles/melee/bloodlust";
import { burnActive, DRAGON_BREATH_COMBUST_BONUS_PCT } from "../../styles/magic/burn";
import {
  BLAST_INFUSED_BASIC_DAMAGE_MULT,
  BLAST_INFUSED_SOURCE,
  blastInfusedActive,
  sunshineActive,
  SUNSHINE_DAMAGE_MULTIPLIER,
  SUNSHINE_SOURCE,
} from "../../styles/magic/effects";
import { deathsSwiftnessMultiplier } from "../../styles/ranged/effects";
import { isAmmunitionHitEligible } from "../../styles/ranged/ammunitionEligibility";
import { resolveRangedAmmunitionHitEffects } from "../../styles/ranged/ammunitionPayloads";
import type { CombatModifier, DamageOverTimeKind, SourceReference } from "../../types";
import type { DamageProvenance } from "../../shared/damageProvenance";
import type { CastSnapshot } from "../cast/snapshot";
import type { SimulationRuntime } from "../runtime/runtime";
import {
  additiveMeleeDamageModifier,
  amZiModifier,
  ENDURING_RUIN_SOURCE,
  frostbladesModifier,
} from "../../shared/equipment";
import { FROSTBLADES_AD_FRACTION } from "../../styles/melee/effects";
import { activeFrostbladesMass } from "../../styles/melee/primordialIce";

/** Applies flat buffs at onCast so intermediate rounding follows stage order. */
export function buffMultiplier(
  id: string,
  multiplier: number,
  source: SourceReference,
): CombatModifier {
  return {
    id,
    stage: "onCast",
    priority: 0,
    applies: () => true,
    apply: (state) => ({ ...state, damage: mulFloor(state.damage, multiplier) }),
    source,
  };
}

export function targetAndPostHitModifiers(
  rt: SimulationRuntime,
  ability?: AbilitySpec,
): CombatModifier[] {
  const representative = ability ?? rt.byId.values().next().value;
  const configured =
    typeof rt.input.modifiers === "function"
      ? representative
        ? rt.input.modifiers(representative)
        : []
      : (rt.input.modifiers ?? []);
  return configured.filter(
    (modifier) => modifier.stage === "target" || modifier.stage === "postHit",
  );
}

/**
 * DoT ignores damage-boosting prayers and Berserk / Death's Swiftness / Sunshine
 * (wiki: Dismember / Slaughter / Massacre, verified 2026-07-31). Chaos Roar bleed
 * boost is the sourced exception; Vulnerability / base-stage still apply.
 */
const DOT_IGNORED_MODIFIER_IDS = new Set([
  "buff:berserk",
  "buff:deaths_swiftness",
  "buff:sunshine",
]);

/**
 * Land-tick modifiers: snap.baseMods + cast-scope next-hit mults + windowed globals at `at`.
 * DoT ticks filter out wiki-excluded buffs (prayers + DOT_IGNORED_MODIFIER_IDS).
 */
export function landTimeModifiers(
  rt: SimulationRuntime,
  at: number,
  ability: AbilitySpec,
  snap: CastSnapshot,
  hitIndex: number,
  isDot: boolean,
  convertedChannel = false,
  dotKind?: DamageOverTimeKind,
  frostbladesActive?: boolean,
  provenance?: DamageProvenance,
): CombatModifier[] {
  const { state } = rt;
  const modifiers = [...snap.baseMods];
  const equipment = rt.input.equipmentEffects;
  if (equipment?.amZiFlatDamage && !modifiers.some((modifier) => modifier.id === "item:am-zi")) {
    modifiers.push(amZiModifier(equipment.amZiFlatDamage));
  }
  const frostOn = frostbladesActive ?? activeFrostbladesMass(state.melee.primordialIce, at) === 1;
  if (
    ability.style === "melee" &&
    !isDot &&
    frostOn &&
    !modifiers.some((modifier) => modifier.id === "item:frostblades")
  ) {
    modifiers.push(frostbladesModifier(Math.floor(rt.input.base * FROSTBLADES_AD_FRACTION)));
  }
  if (
    equipment?.amHejDamageBonus &&
    !modifiers.some((modifier) => modifier.id === "item:additive-melee")
  ) {
    modifiers.push(additiveMeleeDamageModifier(equipment.amHejDamageBonus));
  }
  if (snap.enduringRuinBonus > 0) {
    const additiveIndex = modifiers.findIndex((modifier) => modifier.id === "item:additive-melee");
    if (additiveIndex >= 0) modifiers.splice(additiveIndex, 1);
    modifiers.push(
      additiveMeleeDamageModifier(
        (rt.input.equipmentEffects?.amHejDamageBonus ?? 0) + snap.enduringRuinBonus,
        ENDURING_RUIN_SOURCE,
      ),
    );
  }
  if (
    dotKind === "bleed" &&
    state.target.melee.enduringRuin.bleedVulnerability > 0 &&
    at < state.target.melee.enduringRuin.untilTick
  ) {
    modifiers.push({
      id: "item:enduring-ruin-bleed",
      stage: "target",
      priority: 50,
      applies: () => true,
      apply: (damage) => ({
        ...damage,
        damage: mulFloor(damage.damage, 1 + state.target.melee.enduringRuin.bleedVulnerability),
      }),
      source: ENDURING_RUIN_SOURCE,
    });
  }
  if (snap.chaosRoarActive && (!snap.channelled || hitIndex === 0)) {
    modifiers.push(
      buffMultiplier("buff:chaos_roar", CHAOS_ROAR_DAMAGE_MULTIPLIER, MODERNISATION_WIKI),
    );
  }
  if (snap.empowerMult !== 1) {
    modifiers.push(buffMultiplier("buff:bloodlust_flurry", snap.empowerMult, MODERNISATION_WIKI));
  }
  if (ability.style === "melee" && at < state.melee.berserkUntilTick) {
    modifiers.push(
      buffMultiplier("buff:berserk", BERSERK_DAMAGE_MULTIPLIER, MODERNISATION_PATCH_2),
    );
  }
  if (ability.style === "ranged") {
    if (provenance) {
      const ammunition = resolveRangedAmmunitionHitEffects({
        ammunition: rt.input.ammunition,
        style: ability.style,
        provenance,
        attackOrigin: "player",
        attackKind: "ability",
        targetClassification: rt.input.targetClassification,
      });
      if (ammunition.sourceHitMultiplier !== 1) {
        const multiplier = ammunition.sourceHitMultiplier;
        modifiers.push({
          id: `ammunition:${ammunition.mechanicId}`,
          stage: "onHit",
          priority: 30,
          applies: (context) =>
            context.provenance != null &&
            isAmmunitionHitEligible({
              style: context.style,
              provenance: context.provenance,
              attackOrigin: "player",
            }),
          apply: (damage) => ({ ...damage, damage: mulFloor(damage.damage, multiplier) }),
          source: MODERNISATION_WIKI,
        });
      }
    }
    const mult = deathsSwiftnessMultiplier(state.ranged.swiftness, at);
    if (mult !== 1) {
      modifiers.push(buffMultiplier("buff:deaths_swiftness", mult, MODERNISATION_WIKI));
    }
  }
  // A buff-granting cast's own hits predate its buff (wiki: the Sunshine beam
  // DoT is not buffed by its own window).
  if (
    ability.style === "magic" &&
    state.magic.sunshine.grantedByCast !== snap.castSeq &&
    sunshineActive(state.magic.sunshine, at)
  ) {
    modifiers.push(buffMultiplier("buff:sunshine", SUNSHINE_DAMAGE_MULTIPLIER, SUNSHINE_SOURCE));
  }
  // Dragon Breath deals 1.25x against targets burning from Combust (wiki).
  if (ability.id === "dragon_breath" && burnActive(state.target.burns, "combust", at)) {
    modifiers.push(
      buffMultiplier(
        "buff:dragon_breath_combust",
        1 + DRAGON_BREATH_COMBUST_BONUS_PCT / 100,
        MODERNISATION_WIKI,
      ),
    );
  }
  // Blast Infused: magic basics incl. Combust DoT ticks (wiki Inner Wrath).
  if (
    ability.style === "magic" &&
    ability.category === "basic" &&
    blastInfusedActive(state.magic, at)
  ) {
    modifiers.push(
      buffMultiplier("buff:blast_infused", BLAST_INFUSED_BASIC_DAMAGE_MULT, BLAST_INFUSED_SOURCE),
    );
  }
  if (!isDot || convertedChannel) return modifiers;
  return modifiers.filter(
    (m) => !m.id.startsWith("prayer:") && !DOT_IGNORED_MODIFIER_IDS.has(m.id),
  );
}
