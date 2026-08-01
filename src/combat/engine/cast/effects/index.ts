import {
  activateBerserk,
  BERSERK_DURATION_SECONDS,
  spendBloodlust,
} from "../../../styles/melee/bloodlust";
import {
  BLEED_CHAIN_RECAST_WINDOW_TICKS,
  CHAOS_ROAR_DURATION_SECONDS,
  GREATER_FURY_CRIT_WINDOW_SECONDS,
  isMeleeAbility,
} from "../../../styles/melee/abilities";
import {
  GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS,
  METEOR_STRIKE_BASIC_ADREN_MULTIPLIER,
  METEOR_STRIKE_DURATION_SECONDS,
} from "../../../styles/melee/effects";
import { activateDeathsSwiftness } from "../../../styles/ranged/effects";
import {
  activateInstability,
  activateSunshine,
  CONC_BLAST_CRIT_PER_HIT_PCT,
  CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT,
  GREATER_CONC_BLAST_CRIT_PER_HIT_PCT,
  GREATER_CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT,
  GREATER_FLOW_REDUCTION,
  grantChannelledMight,
  isConcentratedBlast,
  RUNIC_FLOW_BONUS,
  SONIC_FLOW_REDUCTION,
} from "../../../styles/magic/effects";
import { applyCombust } from "../../../styles/magic/burn";
import {
  activateSearingWinds,
  activateShadowImbued,
  extendShadowImbued,
  spendDeathspore,
} from "../../../styles/ranged/onHit";
import { IMPATIENT_EXTRA_ADRENALINE, RELENTLESS_INTERNAL_CD_SECONDS } from "../../../shared/perks";
import { animaCharged, consumeAnima } from "../../../styles/magic/runicCharge";
import { isMagicAbility } from "../../../styles/magic/abilities";
import { applyNecroOnCast, deathSkullsCooldownTicks } from "../../../styles/necromancy/effects";
import {
  COMMAND_SKELETON_INITIAL_COOLDOWN_TICKS,
  CONJURE_ABILITY_SUMMONS,
  conjureActive,
} from "../../../styles/necromancy/conjures";
import type { PreparedCast } from "../prepare";
import { applySkeletonCommand, scheduleSpiritTracks } from "../../schedulers/conjures";
import type { CastRng } from "../../simulation/contracts";
import type { SimulationRuntime } from "../../runtime/runtime";
import {
  clearCooldowns,
  gainAdrenaline,
  gainMeleeBloodlust,
  patchRanged,
  spendAdrenaline,
  startCooldown,
} from "../../runtime/state";
import { secondsToTicks } from "../../../core/ticks";

/**
 * Every state transition of one atomic cast, in sourced order. Mechanic
 * calculations stay in their style modules — this dispatches them. The
 * prepared cast's captured consumption (Bloodlust spend, next-hit windows)
 * lands here so the whole transition is atomic.
 */
export function applyCastEffects(
  rt: SimulationRuntime,
  prepared: PreparedCast,
  rng?: CastRng,
): void {
  const { ability, working, candidate, cost, spend, snap } = prepared;
  const input = rt.input;
  const melee = isMeleeAbility(ability) ? ability : null;

  if (prepared.bloodlustSpend > 0) {
    rt.state = { ...rt.state, melee: spendBloodlust(rt.state.melee, prepared.bloodlustSpend) };
  }
  if (prepared.endlessAssaultGrantUntilTick !== undefined) {
    rt.state = { ...rt.state, endlessAssaultUntilTick: prepared.endlessAssaultGrantUntilTick };
  }
  if (prepared.endlessAssaultConsume) {
    rt.state = { ...rt.state, endlessAssaultUntilTick: 0 };
  }
  if (prepared.chaosRoarConsume) rt.state = { ...rt.state, chaosRoarUntilTick: 0 };
  if (prepared.greaterFuryConsume) rt.state = { ...rt.state, greaterFuryUntilTick: 0 };
  if (prepared.furyConsume) rt.state = { ...rt.state, furyCritBonus: false };

  if (ability.cooldownSeconds) {
    const cdTicks =
      ability.id === "death_skulls"
        ? deathSkullsCooldownTicks(rt.state.necro, candidate)
        : secondsToTicks(ability.cooldownSeconds);
    rt.state = startCooldown(rt.state, ability.id, cdTicks);
  }

  // Immediate on-cast grants/windows in their sourced order.
  if (ability.adrenaline?.gain) {
    const isBasic = ability.category === "basic" || !!ability.autoAttack;
    const meteorBasic =
      ability.style === "melee" &&
      ability.category === "basic" &&
      rt.state.meteorStrikeUntilTick > 0 &&
      candidate < rt.state.meteorStrikeUntilTick;
    let gain = meteorBasic
      ? ability.adrenaline.gain * METEOR_STRIKE_BASIC_ADREN_MULTIPLIER
      : ability.adrenaline.gain;
    if (isBasic) {
      gain *= input.adrenaline?.basicGainMultiplier ?? 1;
      // Impatient: state-changing RNG — the driver branches on it; never flat EV.
      if ((input.adrenaline?.impatientRank ?? 0) > 0 && rng?.impatientProc) {
        gain += IMPATIENT_EXTRA_ADRENALINE;
      }
    }
    rt.state = gainAdrenaline(rt.state, gain);
  }
  if (spend > 0) {
    // Relentless: on a proc the cost is fully refunded and the perk locks out
    // for 30s — state-changing RNG, branched by the driver; never flat EV.
    if (
      (input.adrenaline?.relentlessRank ?? 0) > 0 &&
      candidate >= rt.state.relentlessUntilTick &&
      rng?.relentlessProc
    ) {
      rt.state = {
        ...rt.state,
        relentlessUntilTick: candidate + secondsToTicks(RELENTLESS_INTERNAL_CD_SECONDS),
      };
    } else {
      rt.state = spendAdrenaline(rt.state, spend);
    }
  }
  if (spend === 0 && cost > 0 && ability.style === "ranged" && input.ammo === "deathspore") {
    rt.state = patchRanged(rt.state, {
      deathspore: spendDeathspore(rt.state.ranged.deathspore, candidate),
    });
  }
  if (melee?.bloodlustGain) {
    rt.state = gainMeleeBloodlust(rt.state, melee.bloodlustGain);
  }

  if (ability.style === "necromancy") {
    const skeletonWasActive = conjureActive(rt.state.conjures, "skeleton_warrior", candidate);
    const patch = applyNecroOnCast(rt.state.necro, ability, candidate, rt.state.conjures);
    rt.state = {
      ...rt.state,
      necro: patch.necro,
      ...(patch.conjures ? { conjures: patch.conjures } : {}),
    };
    if (patch.adrenalineBonus) rt.state = gainAdrenaline(rt.state, patch.adrenalineBonus);
    rt.state = clearCooldowns(rt.state, patch.clearCooldownIds);
    for (const spirit of rt.state.conjures.spirits) scheduleSpiritTracks(rt, spirit);
    // Wiki: conjuring a skeleton starts the command's initial 3.6s (6-tick)
    // lockout; commanding mutates the skeleton's own auto scheduler.
    if (CONJURE_ABILITY_SUMMONS[ability.id]?.includes("skeleton_warrior") && !skeletonWasActive) {
      rt.state = {
        ...rt.state,
        cooldowns: {
          ...rt.state.cooldowns,
          command_skeleton_warrior: candidate + COMMAND_SKELETON_INITIAL_COOLDOWN_TICKS,
        },
      };
    }
    if (ability.id === "command_skeleton_warrior") applySkeletonCommand(rt, candidate);
    // Bloated does not stack on the single static target: a recast cancels the
    // previous cast's pending tails and starts a fresh derived set (wiki:
    // "its 19.8-second duration will be reset").
    if (ability.id === "bloat") {
      if (rt.state.activeBloatCastSeq >= 0) {
        rt.queue.cancelByOwner(rt.state.activeBloatCastSeq);
      }
      rt.state = { ...rt.state, activeBloatCastSeq: snap.castSeq };
    }
  }

  if (ability.stateEffect === "berserk") {
    rt.state = {
      ...rt.state,
      melee: activateBerserk(rt.state.melee),
      berserkUntilTick: candidate + secondsToTicks(BERSERK_DURATION_SECONDS),
    };
  } else if (ability.stateEffect === "deaths_swiftness") {
    rt.state = patchRanged(rt.state, {
      swiftness: activateDeathsSwiftness(candidate, false, input.plantedFeet === true),
    });
  } else if (ability.stateEffect === "greater_deaths_swiftness") {
    rt.state = patchRanged(rt.state, { swiftness: activateDeathsSwiftness(candidate, true) });
  } else if (ability.stateEffect === "shadow_imbued") {
    rt.state = patchRanged(rt.state, { shadowImbued: activateShadowImbued(candidate) });
  }
  if (ability.appliesEffect === "searing_winds") {
    rt.state = patchRanged(rt.state, {
      searingWinds: activateSearingWinds(candidate, snap.castSeq),
    });
  }
  if (ability.appliesEffect === "sunshine" || ability.appliesEffect === "greater_sunshine") {
    const greater = ability.appliesEffect === "greater_sunshine";
    rt.state = {
      ...rt.state,
      sunshine: activateSunshine(
        candidate,
        greater,
        !greater && input.plantedFeet === true,
        snap.castSeq,
      ),
    };
  }
  if (ability.appliesEffect === "instability") {
    rt.state = { ...rt.state, instability: activateInstability(candidate) };
  }
  if (ability.appliesEffect === "chaos_roar") {
    rt.state = {
      ...rt.state,
      chaosRoarUntilTick: candidate + secondsToTicks(CHAOS_ROAR_DURATION_SECONDS),
    };
  }
  if (ability.appliesEffect === "greater_fury") {
    rt.state = {
      ...rt.state,
      greaterFuryUntilTick: candidate + secondsToTicks(GREATER_FURY_CRIT_WINDOW_SECONDS),
    };
  }
  if (ability.appliesEffect === "fury") {
    rt.state = { ...rt.state, furyCritBonus: true };
  }
  if (ability.appliesEffect === "meteor_strike") {
    rt.state = {
      ...rt.state,
      meteorStrikeUntilTick: candidate + secondsToTicks(METEOR_STRIKE_DURATION_SECONDS),
    };
  }
  if (
    ability.appliesEffect === "greater_flurry" &&
    rt.state.melee.berserk &&
    candidate < rt.state.berserkUntilTick
  ) {
    const extendTicks =
      working.hits.length * secondsToTicks(GREATER_FLURRY_BERSERK_EXTEND_PER_HIT_SECONDS);
    rt.state = { ...rt.state, berserkUntilTick: rt.state.berserkUntilTick + extendTicks };
  }

  if (ability.style === "melee" && working.hits.length > 0) {
    rt.state = { ...rt.state, lastMeleeCastTick: candidate };
  }

  // Dismember chain: each stage unlocks the next for 40 ticks; completing
  // Massacre resets it.
  if (melee?.enables === "slaughter" || melee?.enables === "massacre") {
    rt.state = {
      ...rt.state,
      bleedChainNext: melee.enables,
      bleedChainUntilTick: candidate + BLEED_CHAIN_RECAST_WINDOW_TICKS,
    };
  } else if (melee?.recastOf) {
    rt.state = { ...rt.state, bleedChainNext: null, bleedChainUntilTick: 0 };
  }

  if (ability.style === "ranged") {
    // Deathspore stacks, Shadow Imbued per-hit adrenaline, and Rapid Fire's
    // Searing Winds extension are landed-hit effects — see consumeNextHitEffects.
    if (ability.id === "shadow_tendrils") {
      rt.state = patchRanged(rt.state, {
        shadowImbued: extendShadowImbued(rt.state.ranged.shadowImbued, candidate),
      });
    }
  }
  if (isMagicAbility(ability)) {
    // Sonic Wave / Greater Sonic Wave earn Flow when their hit LANDS — the
    // cast only records what a landed hit should grant (Runic-charged casts
    // earn the empowered reduction and consume the charge now).
    if (ability.id === "sonic_wave" || ability.id === "greater_sonic_wave") {
      const empowered = animaCharged(rt.state.magic, candidate);
      const base = ability.id === "sonic_wave" ? SONIC_FLOW_REDUCTION : GREATER_FLOW_REDUCTION;
      rt.state = {
        ...rt.state,
        magicFx: {
          ...rt.state.magicFx,
          pendingFlowReduction: base + (empowered ? RUNIC_FLOW_BONUS : 0),
        },
      };
      if (empowered) rt.state = { ...rt.state, magic: consumeAnima(rt.state.magic) };
    }
    // Runic-charged Dragon Breath consumes the charge; the empowered band was
    // resolved in castPreparation.
    if (ability.id === "dragon_breath" && animaCharged(rt.state.magic, candidate)) {
      rt.state = { ...rt.state, magic: consumeAnima(rt.state.magic) };
    }
    if (isConcentratedBlast(ability.id)) {
      // The granting cast sets the per-stack crit pct (Runic-empowered if charged).
      const empowered = animaCharged(rt.state.magic, candidate);
      const perStack =
        ability.id === "concentrated_blast"
          ? empowered
            ? CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT
            : CONC_BLAST_CRIT_PER_HIT_PCT
          : empowered
            ? GREATER_CONC_BLAST_RUNIC_CRIT_PER_HIT_PCT
            : GREATER_CONC_BLAST_CRIT_PER_HIT_PCT;
      rt.state = { ...rt.state, magicFx: { ...rt.state.magicFx, concCritPerStackPct: perStack } };
      if (empowered) rt.state = { ...rt.state, magic: consumeAnima(rt.state.magic) };
    } else if (rt.state.magicFx.concCritStacks > 0) {
      // The next non-CB magic attack consumed the accumulated stacks.
      rt.state = { ...rt.state, magicFx: { ...rt.state.magicFx, concCritStacks: 0 } };
    }
    // A completed Asphyxiate channel grants Channelled Might (+15% crit damage
    // for 3.6s) when the channel ends. The sim always completes channels.
    if (ability.id === "asphyxiate" && ability.channelTicks != null) {
      rt.state = {
        ...rt.state,
        magicFx: {
          ...rt.state.magicFx,
          channelledMight: grantChannelledMight(candidate + ability.channelTicks),
        },
      };
    }
    if (ability.id === "combust") {
      rt.state = {
        ...rt.state,
        magicFx: { ...rt.state.magicFx, burns: applyCombust(rt.state.magicFx.burns, candidate) },
      };
    }
    // Enhanced/ultimate Magic casts consume Flow (wiki).
    if (
      (ability.category === "enhanced" || ability.category === "ultimate") &&
      rt.state.magicFx.flowUntilTick > 0
    ) {
      rt.state = {
        ...rt.state,
        magicFx: { ...rt.state.magicFx, flowUntilTick: 0, flowReduction: 0 },
      };
    }
  }
}
