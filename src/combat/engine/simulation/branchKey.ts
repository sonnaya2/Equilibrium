import type { HitResult } from "../../pipeline/calculateHit";
import type { ActiveConjure } from "../../styles/necromancy/conjures";
import { normalizeLengFrostUntil } from "../../styles/melee/lengRng";
import type { SimulationRuntime, SpiritEventMeta } from "../runtime/runtime";
import type { RotationState } from "../runtime/state";
import { liveDerivedSourceSeqs } from "../resolution/hitDetailsRetention";

/**
 * Future-evolution merge key.
 * Default: compact structural multi-field string (same distinguishability as the
 * historical JSON array key for engine state / maps / seq counters).
 * Debug/oracle: RS3_BRANCH_KEY_JSON=1 restores JSON.stringify of the full tuple.
 *
 * hitDetails in the key are only live derivedFrom sources still pending in the
 * queue (historical unreferenced HitResults cannot change future damage and would
 * only block equivalent-future merges after temporary frost divergence).
 * frostbladesUntilTick is encoded after expiry normalize against state.tick.
 */

const RS = "\x1e";
const US = "\x1f";
const FS = "\x1c";

function envJsonBranchKey(): boolean {
  if (typeof process === "undefined" || process.env == null) return false;
  const v = process.env.RS3_BRANCH_KEY_JSON;
  return v === "1" || v === "true";
}

function b(v: boolean): string {
  return v ? "1" : "0";
}

function n(v: number | undefined | null, d = 0): string {
  return String(v ?? d);
}

/** Length-prefixed string so ability ids / errors never collide with separators. */
function s(v: string | null | undefined): string {
  if (v == null || v === "") return "0" + US;
  return String(v.length) + US + v;
}

function recordNum(rec: Readonly<Record<string, number>>): string {
  // Match JSON.stringify enumeration order (insertion), not sorted keys.
  const keys = Object.keys(rec);
  if (keys.length === 0) return "0";
  let out = String(keys.length);
  for (const k of keys) {
    out += FS + s(k) + n(rec[k]!);
  }
  return out;
}

/**
 * Ability key -> still-recovering ready-at list.
 * Prune readyAt <= tick so fully recovered charges match never-spent state.
 */
function recordChargeLists(
  rec: Readonly<Record<string, readonly number[]>>,
  tick: number,
): string {
  const keys = Object.keys(rec);
  let out = "";
  let liveKeys = 0;
  for (const k of keys) {
    const list = (rec[k] ?? []).filter((readyAt) => readyAt > tick);
    if (list.length === 0) continue;
    liveKeys++;
    out += FS + s(k) + n(list.length);
    for (const t of list) out += US + n(t);
  }
  if (liveKeys === 0) return "0";
  return String(liveKeys) + out;
}

function encodeConjure(c: ActiveConjure): string {
  switch (c.id) {
    case "skeleton_warrior":
      return (
        "sk" +
        US +
        n(c.untilTick) +
        US +
        n(c.auto.nextTick) +
        US +
        n(c.rageStacks) +
        US +
        (c.commandResumeTick === undefined ? "" : n(c.commandResumeTick))
      );
    case "vengeful_ghost":
      return "vg" + US + n(c.untilTick) + US + n(c.auto.nextTick);
    case "putrid_zombie":
      return (
        "pz" +
        US +
        n(c.untilTick) +
        US +
        n(c.auto.nextTick) +
        US +
        n(c.poison.nextTick)
      );
    case "phantom_guardian":
      return "pg" + US + n(c.untilTick);
  }
}

function encodeState(state: RotationState): string {
  const inv = state.invention;
  const m = state.melee;
  const r = state.ranged;
  const g = state.magic;
  const nec = state.necromancy;
  const res = nec.resources;
  const t = state.target;
  const tm = t.melee;
  const parts: string[] = [
    n(state.tick),
    n(state.adrenaline),
    n(state.adrenalineCap),
    b(state.ringOfVigour),
    n(state.vestmentsAdrenalineUntilTick),
    recordNum(state.cooldowns as Record<string, number>),
    recordChargeLists(state.charges as Record<string, readonly number[]>, state.tick),
    n(state.relentlessUntilTick),
    n(inv.cracklingReadyTick),
    n(inv.aftershockCharge),
    n(inv.aftershockReadyTick),
    b(inv.aftershockPending),
    n(state.naturalInstinctUntilTick),
    // league optional
    state.league
      ? "1" +
        US +
        n(state.league.avernicRampageUntilTick) +
        US +
        n(state.league.strikingLightReadyTick)
      : "0",
    // melee
    n(m.bloodlust.stacks),
    b(m.bloodlust.berserk),
    n(m.berserkUntilTick),
    n(m.chaosRoarUntilTick),
    n(m.greaterFuryUntilTick),
    b(m.furyCritBonus),
    n(m.meteorStrikeUntilTick),
    n(m.endlessAssaultUntilTick),
    s(m.bleedChainNext),
    n(m.bleedChainUntilTick),
    n(m.enduringRuin.nextAttackBonus),
    n(m.enduringRuin.untilTick),
    n(m.enduringRuin.grantedByCast),
    n(m.primordialIceStacks),
    // Expired frost ≡ 0 (same as expand / completeAdvance).
    n(normalizeLengFrostUntil(m.frostbladesUntilTick, state.tick)),
    // ranged
    n(r.swiftness.startsAtTick),
    n(r.swiftness.expiresAtTick),
    n(r.searingWinds.expiresAtTick),
    r.searingWinds.grantedByCast === undefined ? "" : n(r.searingWinds.grantedByCast),
    n(r.shadowImbued.expiresAtTick),
    n(r.deathspore.stacks),
    n(r.deathspore.freeCastUntilTick),
    n(r.deathspore.cooldownUntilTick),
    // magic
    n(g.runicCharge.cooldownUntilTick),
    n(g.runicCharge.animaUntilTick),
    n(g.sunshine.startsAtTick),
    n(g.sunshine.expiresAtTick),
    g.sunshine.grantedByCast === undefined ? "" : n(g.sunshine.grantedByCast),
    n(g.instability.expiresAtTick),
    n(g.instability.grantedByCast),
    n(g.flowUntilTick),
    n(g.flowReduction),
    n(g.concCritStacks),
    n(g.concCritPerStackPct),
    n(g.channelledMight.startsAtTick),
    n(g.channelledMight.expiresAtTick),
    n(g.channelledMight.critDamageBonus),
    // necromancy resources
    n(res.residualSouls),
    n(res.necrosisStacks),
    n(res.livingDeathUntilTick),
    b(res.lantern),
    n(res.spectralScythe2UntilTick),
    n(res.spectralScythe3UntilTick),
    // conjures
    String(nec.conjures.spirits.length),
  ];
  for (const c of nec.conjures.spirits) {
    parts.push(encodeConjure(c));
  }
  parts.push(
    // target
    n(t.lastAttackTick),
    recordNum(t.burns.active as Record<string, number>),
    n(t.bloatedByCast),
    recordNum(tm.bleeds as Record<string, number>),
    n(tm.abyssalParasite.stacks),
    n(tm.abyssalParasite.expiresAtTick),
    n(tm.abyssalParasite.nextDamageTick),
    n(tm.abyssalParasite.scheduledThroughTick),
    n(tm.enduringRuin.bleedVulnerability),
    n(tm.enduringRuin.untilTick),
  );
  return parts.join(US);
}

function encodeOneHit(k: number, h: HitResult): (string | number)[] {
  return [
    k,
    h.potential,
    h.min,
    h.max,
    h.critMin,
    h.critMax,
    h.critChance,
    h.nonCritExpected,
    h.critExpected,
    h.expected,
    h.uncappedExpected,
    h.capLoss,
  ];
}

/**
 * Only HitResults still referenced by pending derivedFrom (Bloat / LS / etc.).
 * Empty when no derived consumers remain - historical frost-diverged lands must
 * not permanently block stack/frost reconvergence merges.
 */
function encodeLiveDerivedHitDetails(rt: SimulationRuntime): string {
  const live = liveDerivedSourceSeqs(rt);
  if (live.length === 0) return "0";
  const parts: (string | number)[] = [];
  let count = 0;
  for (const k of live) {
    const h = rt.hitDetails.get(k);
    if (!h) continue;
    if (count === 0) parts.push(0); // placeholder length
    parts.push(...encodeOneHit(k, h));
    count++;
  }
  if (count === 0) return "0";
  parts[0] = count;
  return parts.join(US);
}

function hitDetailsJsonPayload(rt: SimulationRuntime): [number, HitResult][] {
  const out: [number, HitResult][] = [];
  for (const k of liveDerivedSourceSeqs(rt)) {
    const h = rt.hitDetails.get(k);
    if (h) out.push([k, h]);
  }
  return out;
}

function encodeSpiritMeta(map: ReadonlyMap<number, SpiritEventMeta>): string {
  if (map.size === 0) return "0";
  const keys = [...map.keys()].sort((a, b) => a - b);
  let out = String(keys.length);
  for (const k of keys) {
    const m = map.get(k)!;
    out += FS + n(k) + US + s(m.id) + n(m.untilTick) + US + s(m.kind);
  }
  return out;
}

function encodeTracks(set: ReadonlySet<string>): string {
  if (set.size === 0) return "0";
  const keys = [...set].sort();
  let out = String(keys.length);
  for (const k of keys) out += FS + s(k);
  return out;
}

function encodeSpiritHits(map: ReadonlyMap<string, number>): string {
  if (map.size === 0) return "0";
  const keys = [...map.keys()].sort((a, b) => a.localeCompare(b));
  let out = String(keys.length);
  for (const k of keys) out += FS + s(k) + n(map.get(k)!);
  return out;
}

/** Historical JSON key (debug / oracle). Expensive - not the hot path. */
export function branchKeyJson(rt: SimulationRuntime): string {
  // Encode state with frost normalized so JSON partitions match structural.
  const stateForKey = {
    ...rt.state,
    melee: {
      ...rt.state.melee,
      frostbladesUntilTick: normalizeLengFrostUntil(
        rt.state.melee.frostbladesUntilTick,
        rt.state.tick,
      ),
    },
  };
  return JSON.stringify([
    stateForKey,
    rt.queue.signature(),
    hitDetailsJsonPayload(rt),
    [...rt.spiritEventMeta].sort(([a], [b]) => a - b),
    [...rt.scheduledSpiritTracks].sort(),
    [...rt.spiritHitCounts].sort(([a], [b]) => a.localeCompare(b)),
    rt.endTick,
    rt.nextSeq,
    rt.nextCastSeq,
  ]);
}

/** Compact structural key used by merge. */
export function branchKeyStructural(rt: SimulationRuntime): string {
  return (
    encodeState(rt.state) +
    RS +
    rt.queue.signature() +
    RS +
    encodeLiveDerivedHitDetails(rt) +
    RS +
    encodeSpiritMeta(rt.spiritEventMeta) +
    RS +
    encodeTracks(rt.scheduledSpiritTracks) +
    RS +
    encodeSpiritHits(rt.spiritHitCounts) +
    RS +
    n(rt.endTick) +
    US +
    n(rt.nextSeq) +
    US +
    n(rt.nextCastSeq)
  );
}

export function buildBranchKey(rt: SimulationRuntime): string {
  return envJsonBranchKey() ? branchKeyJson(rt) : branchKeyStructural(rt);
}
