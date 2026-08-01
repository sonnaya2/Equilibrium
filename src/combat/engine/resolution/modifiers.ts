import { mulFloor } from "../../core/rounding";
import { MODERNISATION_PATCH_2, MODERNISATION_WIKI } from "../../data/sources";
import type { AbilitySpec } from "../../pipeline/calculateAbility";
import { CHAOS_ROAR_DAMAGE_MULTIPLIER } from "../../styles/melee/abilities";
import { BERSERK_DAMAGE_MULTIPLIER } from "../../styles/melee/bloodlust";
import { burnActive, DRAGON_BREATH_COMBUST_BONUS_PCT } from "../../styles/magic/burn";
import {
  sunshineActive,
  SUNSHINE_DAMAGE_MULTIPLIER,
  SUNSHINE_SOURCE,
} from "../../styles/magic/effects";
import { deathsSwiftnessMultiplier } from "../../styles/ranged/effects";
import type { CombatModifier, SourceReference } from "../../types";
import type { CastSnapshot } from "../cast/snapshot";
import type { SimulationRuntime } from "../runtime/runtime";

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

/**
 * Buff windows that never apply to damage over time. Wiki (Dismember /
 * Slaughter / Massacre, verified 2026-07-31): damage over time ignores
 * damage-boosting prayers and the Berserk / Death's Swiftness / Sunshine
 * windows. Chaos Roar's bleed boost is the sourced explicit exception;
 * Vulnerability and base-stage effects still apply.
 */
const DOT_IGNORED_MODIFIER_IDS = new Set([
  "buff:berserk",
  "buff:deaths_swiftness",
  "buff:sunshine",
]);

/**
 * Assemble the modifiers one cast hit resolves against at its land tick: the
 * cast's base set, the cast-scope next-hit multipliers, and the time-windowed
 * globals read from state at `at`. Damage-over-time ticks then drop the
 * modifiers the wiki excludes from them.
 */
export function landTimeModifiers(
  rt: SimulationRuntime,
  at: number,
  ability: AbilitySpec,
  snap: CastSnapshot,
  hitIndex: number,
  isDot: boolean,
): CombatModifier[] {
  const { state } = rt;
  const modifiers = [...snap.baseMods];
  if (snap.chaosRoarActive && (!snap.channelled || hitIndex === 0)) {
    modifiers.push(
      buffMultiplier("buff:chaos_roar", CHAOS_ROAR_DAMAGE_MULTIPLIER, MODERNISATION_WIKI),
    );
  }
  if (snap.empowerMult !== 1) {
    modifiers.push(buffMultiplier("buff:bloodlust_flurry", snap.empowerMult, MODERNISATION_WIKI));
  }
  if (ability.style === "melee" && at < state.berserkUntilTick) {
    modifiers.push(
      buffMultiplier("buff:berserk", BERSERK_DAMAGE_MULTIPLIER, MODERNISATION_PATCH_2),
    );
  }
  if (ability.style === "ranged") {
    const mult = deathsSwiftnessMultiplier(state.ranged.swiftness, at);
    if (mult !== 1) {
      modifiers.push(buffMultiplier("buff:deaths_swiftness", mult, MODERNISATION_WIKI));
    }
  }
  // A buff-granting cast's own hits predate its buff (wiki: the Sunshine beam
  // DoT is not buffed by its own window).
  if (
    ability.style === "magic" &&
    state.sunshine.grantedByCast !== snap.castSeq &&
    sunshineActive(state.sunshine, at)
  ) {
    modifiers.push(buffMultiplier("buff:sunshine", SUNSHINE_DAMAGE_MULTIPLIER, SUNSHINE_SOURCE));
  }
  // Dragon Breath deals 1.25x against targets burning from Combust (wiki).
  if (ability.id === "dragon_breath" && burnActive(state.magicFx.burns, "combust", at)) {
    modifiers.push(
      buffMultiplier(
        "buff:dragon_breath_combust",
        1 + DRAGON_BREATH_COMBUST_BONUS_PCT / 100,
        MODERNISATION_WIKI,
      ),
    );
  }
  if (!isDot) return modifiers;
  return modifiers.filter(
    (m) => !m.id.startsWith("prayer:") && !DOT_IGNORED_MODIFIER_IDS.has(m.id),
  );
}
