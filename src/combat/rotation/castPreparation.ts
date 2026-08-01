import type { AbilitySpec } from "../pipeline/calculateAbility";
import { isMeleeAbility } from "../styles/melee/abilities";
import {
  GREATER_BARGE_ENDLESS_ASSAULT_IDLE_TICKS,
  GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS,
  greaterBargeIdleBand,
} from "../styles/melee/effects";
import { searingWindsBonusPct } from "../styles/ranged/onHit";
import { resolveNecromancyAbility } from "../styles/necromancy/effects";
import { costOf, spendOf } from "./castRules";
import type { CastSnapshot } from "./resolution";
import type { SimulationRuntime } from "./runtime";
import { GLOBAL_COOLDOWN_TICKS, secondsToTicks } from "./timing";

/**
 * Everything one atomic cast needs, computed once against the advanced state
 * at the candidate tick. Preparation is READ-ONLY: every state mutation the
 * cast implies is recorded here as data and applied by castEffects at commit.
 */
export interface PreparedCast {
  /** The ability as queued. */
  ability: AbilitySpec;
  /** The resolved variant (Bloodlust form, necromancy resolution, Barge idle). */
  working: AbilitySpec;
  candidate: number;
  /** Listed adrenaline requirement at the candidate tick. */
  cost: number;
  /** Actual adrenaline spend at the candidate tick (Deathspore-zeroed). */
  spend: number;
  occupancyTicks: number;
  snap: CastSnapshot;
  /** Bloodlust stacks to consume at commit (0 = unempowered). */
  bloodlustSpend: number;
  /** Next-hit windows to consume at commit. */
  chaosRoarConsume: boolean;
  greaterFuryConsume: boolean;
  furyConsume: boolean;
  /** Endless Assault window to open (Greater Barge after enough idle ticks). */
  endlessAssaultGrantUntilTick?: number;
  /** Endless Assault window to consume (channelled melee inside one). */
  endlessAssaultConsume: boolean;
}

export function prepareCast(
  rt: SimulationRuntime,
  ability: AbilitySpec,
  candidate: number,
): PreparedCast {
  const input = rt.input;

  // Empowered variant resolution: the spend itself is recorded, not applied —
  // it lands atomically with the rest of the commit.
  const melee = isMeleeAbility(ability) ? ability : null;
  let working: AbilitySpec = ability;
  let empowerMult = 1;
  let bloodlustSpend = 0;
  if (melee) {
    const stacks = rt.state.melee.stacks;
    if (melee.bloodlustScale && stacks >= melee.bloodlustScale.threshold) {
      working = {
        ...ability,
        hits: ability.hits.map((hit) => ({ ...hit, band: melee.bloodlustScale!.band })),
      };
      bloodlustSpend = melee.bloodlustScale.threshold;
    } else if (melee.bloodlustExtraHits && stacks >= melee.bloodlustExtraHits.threshold) {
      working = {
        ...ability,
        hits: [...ability.hits, ...melee.bloodlustExtraHits.hits.map((hit) => ({ ...hit }))],
      };
      bloodlustSpend = melee.bloodlustExtraHits.threshold;
    } else if (melee.bloodlustMissingHp && stacks >= melee.bloodlustMissingHp.threshold) {
      // +1% per 1% of the target's missing LP, capped (wiki Bloodlust). Without
      // target HP input the stacks are still spent but no bonus is invented.
      const hp = input.targetHpPercent;
      empowerMult = hp != null ? 1 + Math.min(melee.bloodlustMissingHp.capPct, 100 - hp) / 100 : 1;
      bloodlustSpend = melee.bloodlustMissingHp.threshold;
    }
  }
  if (ability.style === "necromancy") {
    working = resolveNecromancyAbility(working, rt.state.necro, candidate);
  }

  const meleeIdleTicks =
    ability.style === "melee" && working.hits.length > 0 && rt.state.lastMeleeCastTick >= 0
      ? candidate - rt.state.lastMeleeCastTick
      : 0;
  let endlessAssaultGrantUntilTick: number | undefined;
  if (ability.id === "greater_barge" && working.hits.length > 0) {
    working = {
      ...working,
      hits: working.hits.map((h) => ({
        ...h,
        band: greaterBargeIdleBand(h.band.minPct, h.band.maxPct, meleeIdleTicks),
      })),
    };
    if (meleeIdleTicks >= GREATER_BARGE_ENDLESS_ASSAULT_IDLE_TICKS) {
      endlessAssaultGrantUntilTick =
        candidate + secondsToTicks(GREATER_BARGE_ENDLESS_ASSAULT_WINDOW_SECONDS);
    }
  }
  const endlessAssaultConsume =
    melee?.channelled === true &&
    working.hits.length > 0 &&
    rt.state.endlessAssaultUntilTick > 0 &&
    candidate < rt.state.endlessAssaultUntilTick;

  // Next-hit buffs are consumed by the next melee cast that can use them; the
  // benefit lands on that cast's FIRST eligible hit only (wiki: "only the
  // first hit of the channeled ability will receive the boost"). Chaos Roar is
  // the exception among them: channels get ×1.75 on the first hit, non-channel
  // multi-hit abilities on every hit, and bleeds benefit too.
  const damaging = working.hits.length > 0;
  const nonBleed = working.hits.some((h) => h.critEligible !== false);
  const chaosRoarConsume =
    ability.style === "melee" &&
    damaging &&
    rt.state.chaosRoarUntilTick > 0 &&
    candidate < rt.state.chaosRoarUntilTick;
  const greaterFuryConsume =
    ability.style === "melee" &&
    nonBleed &&
    rt.state.greaterFuryUntilTick > 0 &&
    candidate < rt.state.greaterFuryUntilTick;
  const furyConsume = ability.style === "melee" && nonBleed && rt.state.furyCritBonus;
  // Searing Winds eligibility is checked at cast (wiki: "calculated on cast") —
  // a channel cast inside the window keeps the bonus on hits landing after it.
  const searingWindsAtCast =
    ability.style === "ranged" && searingWindsBonusPct(rt.state.ranged.searingWinds, candidate) > 0;

  const snap: CastSnapshot = {
    castSeq: rt.nextCastSeq,
    critLayers: {
      ...input.crit,
      guaranteed: ability.guaranteedCrit || input.crit.guaranteed,
    },
    baseMods:
      typeof input.modifiers === "function" ? input.modifiers(ability) : (input.modifiers ?? []),
    chaosRoarActive: chaosRoarConsume,
    channelled: ability.channelTicks != null,
    greaterFuryActive: greaterFuryConsume,
    furyActive: furyConsume,
    firstEligibleHitIndex: working.hits.findIndex((h) => h.critEligible !== false),
    empowerMult,
    searingWindsAtCast,
  };

  return {
    ability,
    working,
    candidate,
    cost: costOf(rt.state, ability, candidate),
    spend: spendOf(rt.state, ability, candidate, input.ammo),
    occupancyTicks: ability.channelTicks ?? GLOBAL_COOLDOWN_TICKS,
    snap,
    bloodlustSpend,
    chaosRoarConsume,
    greaterFuryConsume,
    furyConsume,
    ...(endlessAssaultGrantUntilTick !== undefined ? { endlessAssaultGrantUntilTick } : {}),
    endlessAssaultConsume,
  };
}
