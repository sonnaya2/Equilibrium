/**
 * Complete land-time identity for resolveCastHit reuse.
 * Must cover every input that feeds calculateHit / attached SW / Haunted bonus.
 * Input and memoized base modifiers use object identity so closed-over modifiers stay exact.
 */

import type { AbilityHit, AbilitySpec } from "../../pipeline/calculateAbility";
import {
  channelledMightCritBonus,
  isConcentratedBlast,
  sunshineActive,
} from "../../styles/magic/effects";
import { burnActive } from "../../styles/magic/burn";
import { deathsSwiftnessMultiplier } from "../../styles/ranged/effects";
import { activeBleedCount } from "../../styles/melee/effects";
import { activeFrostbladesMass } from "../../styles/melee/primordialIce";
import { findConjure } from "../../styles/necromancy/conjures";
import { isBasicAttack } from "../../shared/adrenalineGain";
import type { CastSnapshot } from "../cast/snapshot";
import type { SimulationRuntime } from "../runtime/runtime";

const objectIds = new WeakMap<object, number>();
let nextObjectId = 1;

function oid(obj: object): number {
  let id = objectIds.get(obj);
  if (id === undefined) {
    id = nextObjectId++;
    objectIds.set(obj, id);
  }
  return id;
}

function b(v: boolean): string {
  return v ? "1" : "0";
}

/**
 * Fingerprint of every land-time input that can change HitResult / attached SW / Haunted.
 * Branches that only differ post-hit (e.g. primordialIce mass alone) collide.
 */
export function landHitIdentity(
  rt: SimulationRuntime,
  at: number,
  hitSpec: AbilityHit,
  hitIndex: number,
  ability: AbilitySpec,
  snap: CastSnapshot,
  isDot: boolean,
  convertedChannel: boolean,
): string {
  const { input, state } = rt;
  const m = state.melee;
  const mag = state.magic;
  const ranged = state.ranged;
  const t = state.target;
  const ctx = input.context;
  const cap = input.cap;
  const skeleton =
    ability.id === "command_skeleton_warrior"
      ? findConjure(state.necromancy.conjures, "skeleton_warrior")
      : undefined;
  const bleedCount = activeBleedCount(t.melee, at);
  const frostMass =
    ability.style === "melee" && !isDot ? activeFrostbladesMass(m.primordialIce, at) : 0;
  const frostOn = frostMass > 0;
  const berserkOn = ability.style === "melee" && at < m.berserkUntilTick;
  const sunOn = ability.style === "magic" && sunshineActive(mag.sunshine, at);
  const sunSelf = mag.sunshine.grantedByCast === snap.castSeq;
  const concLive =
    ability.style === "magic" && isConcentratedBlast(ability.id)
      ? mag.concCritStacks * mag.concCritPerStackPct
      : 0;
  const might = ability.style === "magic" ? channelledMightCritBonus(mag.channelledMight, at) : 0;
  const ds = ability.style === "ranged" ? deathsSwiftnessMultiplier(ranged.swiftness, at) : 1;
  const combust = ability.id === "dragon_breath" && burnActive(t.burns, "combust", at);
  const erBleed =
    hitSpec.dotKind === "bleed" &&
    t.melee.enduringRuin.bleedVulnerability > 0 &&
    at < t.melee.enduringRuin.untilTick
      ? t.melee.enduringRuin.bleedVulnerability
      : 0;
  // Live Haunted at land (expiry-normalized); damage uses land-time, not snap.
  const hauntedUntil =
    t.haunted.untilTick > 0 && at < t.haunted.untilTick ? t.haunted.untilTick : 0;
  const hauntedCapLive = hauntedUntil > 0 ? t.haunted.capAbilityDamage : 0;

  // Equipment effects object identity covers am-zi / am-hej / champion-ring etc.
  const equipId = input.equipmentEffects ? oid(input.equipmentEffects) : 0;

  return [
    oid(input),
    oid(snap.baseMods),
    equipId,
    ability.id,
    ability.style,
    b(isBasicAttack(ability)),
    ability.category ?? "",
    ability.area ?? "",
    ability.channelTicks ?? -1,
    hitIndex,
    b(isDot),
    b(convertedChannel),
    hitSpec.band.minPct,
    hitSpec.band.maxPct,
    b(hitSpec.critEligible !== false),
    hitSpec.dotKind ?? "",
    hitSpec.bleedId ?? "",
    b(frostOn),
    frostMass,
    b(berserkOn),
    ds,
    b(sunOn),
    b(sunSelf),
    concLive,
    might,
    bleedCount,
    erBleed,
    b(combust),
    skeleton?.rageStacks ?? 0,
    input.base,
    input.level,
    input.accuracy,
    input.preciseRank ?? 0,
    input.tumekensPieces ?? 0,
    b(input.tumekensCritEnabled !== false),
    cap?.cap ?? -1,
    b(!!cap?.bypass),
    ctx?.ruleset ?? "",
    ctx?.targetSize ?? -1,
    ctx?.occupiedTiles ?? -1,
    b(!!snap.searingWindsAtCast),
    hauntedUntil,
    hauntedCapLive,
    b(!!snap.hauntedAtCast),
    snap.hauntedCapAd,
    b(!!snap.chaosRoarActive),
    b(!!snap.channelled),
    b(!!snap.furyActive),
    b(!!snap.greaterFuryActive),
    snap.firstEligibleHitIndex,
    snap.empowerMult,
    snap.enduringRuinBonus,
    snap.critLayers.chance,
    snap.critLayers.damageBonus ?? 0,
    b(!!snap.critLayers.guaranteed),
    b(!!snap.critLayers.disabled),
    b(snap.critLayers.eligible !== false),
    snap.tuskasEmpoweredDamage ?? -1,
  ].join("\x1f");
}
