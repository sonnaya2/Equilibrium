import type { HitResult } from "../../pipeline/calculateHit";
import type { ActiveConjure } from "../../styles/necromancy/conjures";
import { spiritPoisonPending } from "../../styles/necromancy/conjures";
import { endBerserk } from "../../styles/melee/bloodlust";
import { expirePrimordialIce } from "../../styles/melee/primordialIce";
import { activePuncture } from "../../styles/ranged/puncture";
import {
  mapEventRefForKey,
  pendingKeyRanks,
  type PendingKeyRanks,
  type ScheduledEvent,
} from "../runtime/events";
import type { SimulationRuntime, SpiritEventMeta } from "../runtime/runtime";
import type { RotationState, TargetWeaponPoisonDistribution } from "../runtime/state";
import { liveDerivedSourceSeqs } from "../resolution/hitDetailsRetention";

/**
 * Future-evolution merge key (Phase 7).
 * Default: compact structural multi-field string. RS3_BRANCH_KEY_JSON=1 = JSON oracle.
 *
 * Field classes (merge key only; runtime still holds full history):
 * - Future: live state, pending queue, live derived hitDetails, spirit tracks/meta/hits
 * - Presentation/history (omitted): fixed-window endTick, total* ledgers, casts/events logs
 * - Historical normalize: expired cooldowns/charges; frost/haunted/ghost/tsunami/blast;
 *   expired burns/bleeds; expired puncture via activePuncture; expired berserk via endBerserk;
 *   half-open untils (chaos/fury/meteor/endless/NI/vestments/relentless/LD/flow/scythe);
 *   searing/sunshine/instability/enduringRuin expires + granted only while live;
 *   fully expired spirits pruned (keep zombie poison-tail residue)
 * - Allocators omitted (merge takes max): nextSeq, nextCastSeq
 * - Queue key ranks pending seq / cast / derivedFrom (see events.pendingKeyRanks)
 * - Map keys sorted so insertion order never blocks equivalence
 *
 * Deferred: state-level cast ids outside the pending set (grantedByCast, puncture owner).
 *
 * Do not drop a field without a partition + future-damage proof test.
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

/**
 * Half-open until clock: active while tick < until (cast/land use candidate < until).
 * Residue at/after until ≡ 0 so expired windows merge with never-set.
 */
function halfOpenUntil(until: number, tick: number): number {
  return until > tick ? until : 0;
}

/**
 * Map of clocks still live after `tick` (value > tick).
 * Shared by ability readyAt, burn until, bleed until: missing and expired are equivalent.
 */
function recordLiveClocks(rec: Readonly<Record<string, number>>, tick: number): string {
  const live: [string, number][] = [];
  for (const k of Object.keys(rec)) {
    const until = rec[k]!;
    if (until > tick) live.push([k, until]);
  }
  live.sort((a, b) => a[0].localeCompare(b[0]));
  if (live.length === 0) return "0";
  let out = String(live.length);
  for (const [k, until] of live) {
    out += FS + s(k) + n(until);
  }
  return out;
}

/** Ability ready-at map. Prune readyAt <= tick (same as firstLegalTick: ready now). */
function recordLiveReadyAt(rec: Readonly<Record<string, number>>, tick: number): string {
  return recordLiveClocks(rec, tick);
}

/**
 * Ability key -> still-recovering ready-at list.
 * Prune readyAt <= tick so fully recovered charges match never-spent state.
 */
function recordChargeLists(rec: Readonly<Record<string, readonly number[]>>, tick: number): string {
  const keys = Object.keys(rec).sort((a, b) => a.localeCompare(b));
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

/** Clocks for JSON oracle: drop value <= tick; stable key order. */
function liveClocksForKey(
  rec: Readonly<Record<string, number>>,
  tick: number,
): Record<string, number> {
  const out: Record<string, number> = {};
  const keys = Object.keys(rec).sort((a, b) => a.localeCompare(b));
  for (const k of keys) {
    const until = rec[k]!;
    if (until > tick) out[k] = until;
  }
  return out;
}

/** Cooldowns for JSON oracle: drop readyAt <= tick; stable key order. */
function liveCooldownsForKey(
  rec: Readonly<Record<string, number>>,
  tick: number,
): Record<string, number> {
  return liveClocksForKey(rec, tick);
}

/** Charges for JSON oracle: drop recovered clocks; stable key order. */
function liveChargesForKey(
  rec: Readonly<Record<string, readonly number[]>>,
  tick: number,
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  const keys = Object.keys(rec).sort((a, b) => a.localeCompare(b));
  for (const k of keys) {
    const list = (rec[k] ?? []).filter((readyAt) => readyAt > tick);
    if (list.length > 0) out[k] = list;
  }
  return out;
}

/**
 * Spirits that still affect future damage or ownership identity for tracks.
 * Live while tick < untilTick. After until, only zombie poison tail remains
 * (autos cannot land past until; queue/meta still encode pending events).
 */
function spiritsForKey(spirits: readonly ActiveConjure[], tick: number): ActiveConjure[] {
  return spirits.filter((c) => tick < c.untilTick || spiritPoisonPending(c));
}

function encodeConjure(c: ActiveConjure, tick: number): string {
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
      // Commanding inert after untilTick; encode false so expired ghosts merge.
      return (
        "vg" +
        US +
        n(c.untilTick) +
        US +
        n(c.auto.nextTick) +
        US +
        b(!!c.commanding && tick < c.untilTick)
      );
    case "putrid_zombie":
      return "pz" + US + n(c.untilTick) + US + n(c.auto.nextTick) + US + n(c.poison.nextTick);
    case "phantom_guardian":
      return "pg" + US + n(c.untilTick);
  }
}

function poisonStateLive(
  poison: TargetWeaponPoisonDistribution["atoms"][number]["poison"],
  tick: number,
): boolean {
  return (poison.active && tick < poison.expiresAtTick) || poison.pendingApplicationHits.length > 0;
}

function encodePendingPoisonHits(
  poison: TargetWeaponPoisonDistribution["atoms"][number]["poison"],
  pending: readonly ScheduledEvent<SimulationRuntime>[],
): string {
  return poison.pendingApplicationHits
    .map((hit) => {
      const multiplicity = hit.multiplicity;
      const model =
        multiplicity.kind === "positive-binomial"
          ? `b:${n(multiplicity.trials)}:${n(multiplicity.probability)}`
          : multiplicity.kind === "positive-geometric"
            ? `g:${n(multiplicity.continuationProbability)}`
            : "s";
      return `${n(hit.tick)}:${n(poisonPendingOrder(pending, hit.tick, hit.seq))}:${model}`;
    })
    .join(",");
}

function encodeWeaponPoison(
  distribution: TargetWeaponPoisonDistribution,
  tick: number,
  pending: readonly ScheduledEvent<SimulationRuntime>[],
): string {
  let out = String(distribution.atoms.length);
  for (const atom of distribution.atoms) {
    const poison = atom.poison;
    out += FS + n(atom.probability) + US + n(halfOpenUntil(atom.immunityDisabledUntilTick, tick));
    if (!poisonStateLive(poison, tick)) {
      out += US + "0";
      continue;
    }
    out +=
      US +
      "1" +
      US +
      n(poison.expiresAtTick) +
      US +
      n(poison.effectiveTier) +
      US +
      poison.decayMass.map(n).join(",") +
      US +
      n(poison.remainingHits) +
      US +
      n(poison.cadenceTicks) +
      US +
      n(poison.nextHitTick) +
      US +
      n(poisonPendingOrder(pending, poison.nextHitTick, poison.pendingEventSeq)) +
      US +
      n(poison.sourceDamageMultiplier) +
      US +
      b(poison.cinderbaneContinuation) +
      US +
      s(poison.sourceLabel) +
      US +
      encodePendingPoisonHits(poison, pending);
  }
  return out;
}

function weaponPoisonJson(
  distribution: TargetWeaponPoisonDistribution,
  tick: number,
  pending: readonly ScheduledEvent<SimulationRuntime>[],
) {
  return distribution.atoms.map((atom) => ({
    probability: atom.probability,
    immunityDisabledUntilTick: halfOpenUntil(atom.immunityDisabledUntilTick, tick),
    poison: poisonStateLive(atom.poison, tick)
      ? {
          ...atom.poison,
          decayIndex: undefined,
          pendingEventSeq: poisonPendingOrder(
            pending,
            atom.poison.nextHitTick,
            atom.poison.pendingEventSeq,
          ),
          pendingApplicationHits: atom.poison.pendingApplicationHits.map((hit) => ({
            ...hit,
            seq: poisonPendingOrder(pending, hit.tick, hit.seq),
          })),
        }
      : { active: false },
  }));
}

function poisonPendingOrder(
  pending: readonly ScheduledEvent<SimulationRuntime>[],
  tick: number,
  seq: number,
): number {
  let order = 0;
  for (const event of pending) {
    if (event.tick > tick) break;
    if (event.tick === tick && event.seq < seq) order++;
  }
  return order;
}

function encodeState(
  state: RotationState,
  ranks: PendingKeyRanks,
  pending: readonly ScheduledEvent<SimulationRuntime>[],
): string {
  const inv = state.invention;
  const m = state.melee;
  const r = state.ranged;
  const g = state.magic;
  const nec = state.necromancy;
  const res = nec.resources;
  const t = state.target;
  const tm = t.melee;
  const tick = state.tick;
  // Berserk land uses tick < until; clock endBerserk when until <= tick.
  const berserkExpired = m.berserkUntilTick <= tick;
  const bloodlust = m.bloodlust.berserk && berserkExpired ? endBerserk(m.bloodlust) : m.bloodlust;
  const berserkUntil = berserkExpired ? 0 : m.berserkUntilTick;
  // Expired puncture zeros stacks/stored/pending; keeps generation + lastCompletedCastSeq.
  const punc = activePuncture(r.puncture, tick);
  // Half-open buff/lockout clocks: cast/land treat tick >= until as inactive.
  const vestmentsUntil = halfOpenUntil(state.vestmentsAdrenalineUntilTick, tick);
  const relentlessUntil = halfOpenUntil(state.relentlessUntilTick, tick);
  const naturalInstinctUntil = halfOpenUntil(state.naturalInstinctUntilTick, tick);
  const avernicRampageUntil = halfOpenUntil(state.league?.avernicRampageUntilTick ?? 0, tick);
  const strikingLightReadyTick = halfOpenUntil(state.league?.strikingLightReadyTick ?? 0, tick);
  const lordOfLightReadyTick = halfOpenUntil(state.league?.lordOfLightReadyTick ?? 0, tick);
  const chaosRoarUntil = halfOpenUntil(m.chaosRoarUntilTick, tick);
  const greaterFuryUntil = halfOpenUntil(m.greaterFuryUntilTick, tick);
  const meteorStrikeUntil = halfOpenUntil(m.meteorStrikeUntilTick, tick);
  const endlessAssaultUntil = halfOpenUntil(m.endlessAssaultUntilTick, tick);
  // Enduring Ruin (player): consume uses tick < until; clear granted when dead.
  const erUntil = halfOpenUntil(m.enduringRuin.untilTick, tick);
  const erBonus = erUntil > 0 ? m.enduringRuin.nextAttackBonus : 0;
  const erGranted = erUntil > 0 ? m.enduringRuin.grantedByCast : -1;
  // Searing / sunshine / instability: expires residue + granted only while live.
  const searingExpires = halfOpenUntil(r.searingWinds.expiresAtTick, tick);
  const searingGranted = searingExpires > 0 ? r.searingWinds.grantedByCast : undefined;
  const sunExpires = halfOpenUntil(g.sunshine.expiresAtTick, tick);
  const sunStarts = sunExpires > 0 ? g.sunshine.startsAtTick : 0;
  const sunGranted = sunExpires > 0 ? g.sunshine.grantedByCast : undefined;
  const instExpires = halfOpenUntil(g.instability.expiresAtTick, tick);
  const instGranted = instExpires > 0 ? g.instability.grantedByCast : -1;
  // Flow: expired until zeros reduction (consume path clears both together).
  const flowUntil = halfOpenUntil(g.flowUntilTick, tick);
  const flowReduction = flowUntil > 0 ? g.flowReduction : 0;
  const livingDeathUntil = halfOpenUntil(res.livingDeathUntilTick, tick);
  // Spectral scythe stages: cast legal while candidate < until (half-open).
  const scythe2Until = halfOpenUntil(res.spectralScythe2UntilTick, tick);
  const scythe3Until = halfOpenUntil(res.spectralScythe3UntilTick, tick);
  const liveSpirits = spiritsForKey(nec.conjures.spirits, tick);
  // Target enduring ruin bleed vuln: land uses at < until.
  const targetErUntil = halfOpenUntil(tm.enduringRuin.untilTick, tick);
  const targetErVuln = targetErUntil > 0 ? tm.enduringRuin.bleedVulnerability : 0;
  const parts: string[] = [
    n(tick),
    n(state.adrenaline),
    n(state.adrenalineCap),
    b(state.ringOfVigour),
    n(vestmentsUntil),
    recordLiveReadyAt(state.cooldowns as Record<string, number>, tick),
    recordChargeLists(state.charges as Record<string, readonly number[]>, tick),
    n(relentlessUntil),
    n(inv.cracklingReadyTick),
    n(inv.aftershockCharge),
    n(inv.aftershockReadyTick),
    b(inv.aftershockPending),
    n(naturalInstinctUntil),
    // league optional
    state.league
      ? "1" +
        US +
        n(avernicRampageUntil) +
        US +
        n(strikingLightReadyTick) +
        US +
        n(lordOfLightReadyTick)
      : "0",
    // melee
    n(bloodlust.stacks),
    b(bloodlust.berserk),
    n(berserkUntil),
    n(chaosRoarUntil),
    n(greaterFuryUntil),
    b(m.furyCritBonus),
    n(meteorStrikeUntil),
    n(endlessAssaultUntil),
    s(m.bleedChainNext),
    n(m.bleedChainUntilTick),
    n(erBonus),
    n(erUntil),
    n(erGranted),
    // Leng atoms: weight plus every future-relevant stack/Frostblades field.
    (() => {
      const ice = expirePrimordialIce(m.primordialIce, tick);
      return ice.atoms
        .map((atom) =>
          [
            n(atom.weight),
            n(atom.stacks),
            n(atom.stacksExpireAtTick),
            n(atom.frostbladesExpireAtTick),
          ].join(FS),
        )
        .join(US);
    })(),
    // ranged
    n(r.swiftness.startsAtTick),
    n(r.swiftness.expiresAtTick),
    n(searingExpires),
    searingGranted === undefined ? "" : n(searingGranted),
    n(r.shadowImbued.expiresAtTick),
    n(r.deathspore.stacks),
    n(r.deathspore.freeCastUntilTick),
    n(r.deathspore.cooldownUntilTick),
    n(punc.stacks),
    n(punc.expiresAtTick),
    n(punc.storedDamage),
    n(punc.generation),
    n(punc.pendingOwnerCast),
    n(punc.lastCompletedCastSeq),
    // magic
    n(g.runicCharge.cooldownUntilTick),
    n(g.runicCharge.animaUntilTick),
    n(sunStarts),
    n(sunExpires),
    sunGranted === undefined ? "" : n(sunGranted),
    n(instExpires),
    n(instGranted),
    n(flowUntil),
    n(flowReduction),
    n(g.concCritStacks),
    n(g.concCritPerStackPct),
    n(g.channelledMight.startsAtTick),
    n(g.channelledMight.expiresAtTick),
    n(g.channelledMight.critDamageBonus),
    // Tsunami / Blast Infused: expired until ≡ 0 for post-window merge.
    n(halfOpenUntil(g.tsunamiCritAdrenUntilTick, tick)),
    n(halfOpenUntil(g.blastInfusedUntilTick, tick)),
    // necromancy resources
    n(res.residualSouls),
    n(res.necrosisStacks),
    n(livingDeathUntil),
    b(res.lantern),
    n(scythe2Until),
    n(scythe3Until),
    n(res.deathSparkStacks),
    n(res.soulReaveStacks),
    b(res.soulReaveGrantOnLand),
    // conjures (fully expired pruned; poison-tail zombies kept)
    String(liveSpirits.length),
  ];
  for (const c of liveSpirits) {
    parts.push(encodeConjure(c, tick));
  }
  // Expired Haunted ≡ newHaunted() (zero until and cap).
  const hauntedUntil =
    t.haunted.untilTick > 0 && t.haunted.untilTick <= tick ? 0 : t.haunted.untilTick;
  const toxinStacks =
    tick < t.evolvingToxin.expiresAtTick ? Math.max(0, t.evolvingToxin.stacks) : 0;
  parts.push(
    // target
    n(t.lastAttackTick),
    // burnActive: tick < until; prune expired so residue matches missing.
    recordLiveClocks(t.burns.active as Record<string, number>, tick),
    n(t.bloatedByCast),
    // activeBleedCount: at < until; prune expired.
    recordLiveClocks(tm.bleeds as Record<string, number>, tick),
    n(tm.abyssalParasite.stacks),
    n(tm.abyssalParasite.expiresAtTick),
    n(tm.abyssalParasite.nextDamageTick),
    n(tm.abyssalParasite.scheduledThroughTick),
    n(tm.lastHurricaneCdrCast),
    n(targetErVuln),
    n(targetErUntil),
    n(hauntedUntil),
    n(hauntedUntil === 0 ? 0 : t.haunted.capAbilityDamage),
    encodeWeaponPoison(t.weaponPoison, tick, pending),
  );
  parts.push(toxinStacks > 0 ? "1" : "0");
  if (toxinStacks > 0) {
    parts.push(n(toxinStacks), n(t.evolvingToxin.expiresAtTick));
  }
  // Player vitality / Naragi / level override (absent ≡ zeroed).
  const player = state.player;
  if (!player) {
    parts.push("0");
  } else {
    const loUntil = halfOpenUntil(player.levelOverride.untilTick, tick);
    const dpUntil = halfOpenUntil(player.deathPrevention.untilTick, tick);
    const naragiUntil = halfOpenUntil(player.naragi.activeUntilTick, tick);
    parts.push(
      "1",
      n(player.vitality.currentLifePoints),
      n(player.vitality.maximumLifePoints),
      b(player.dead),
      n(loUntil),
      n(loUntil > 0 ? player.levelOverride.level : 0),
      s(player.deathPrevention.sourceId),
      n(dpUntil > 0 ? player.deathPrevention.charges : 0),
      n(dpUntil),
      n(naragiUntil),
      n(player.naragi.activatedAtTick),
      n(naragiUntil > 0 ? player.naragi.revivalCharges : 0),
      n(player.naragiHealed),
      n(player.naragiOverheal),
    );
  }
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
 * Keys remapped with queue ranks so drained-history absolute seqs merge.
 */
function encodeLiveDerivedHitDetails(rt: SimulationRuntime, ranks: PendingKeyRanks): string {
  const live = liveDerivedSourceSeqs(rt);
  if (live.length === 0) return "0";
  const entries: { key: number; h: HitResult }[] = [];
  for (const abs of live) {
    const h = rt.hitDetails.get(abs);
    if (!h) continue;
    entries.push({ key: mapEventRefForKey(abs, ranks), h });
  }
  if (entries.length === 0) return "0";
  entries.sort((a, b) => a.key - b.key);
  const parts: (string | number)[] = [entries.length];
  for (const { key, h } of entries) {
    parts.push(...encodeOneHit(key, h));
  }
  return parts.join(US);
}

function hitDetailsJsonPayload(
  rt: SimulationRuntime,
  ranks: PendingKeyRanks,
): [number, HitResult][] {
  const out: [number, HitResult][] = [];
  for (const abs of liveDerivedSourceSeqs(rt)) {
    const h = rt.hitDetails.get(abs);
    if (h) out.push([mapEventRefForKey(abs, ranks), h]);
  }
  out.sort((a, b) => a[0] - b[0]);
  return out;
}

function encodeSpiritMeta(
  map: ReadonlyMap<number, SpiritEventMeta>,
  ranks: PendingKeyRanks,
): string {
  if (map.size === 0) return "0";
  const entries = [...map.entries()].map(([abs, m]) => ({
    key: mapEventRefForKey(abs, ranks),
    m,
  }));
  entries.sort((a, b) => a.key - b.key);
  let out = String(entries.length);
  for (const { key, m } of entries) {
    out += FS + n(key) + US + s(m.id) + n(m.untilTick) + US + s(m.kind);
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
  const tick = rt.state.tick;
  const pending = rt.queue.pending();
  const ranks = pendingKeyRanks(pending);
  const hauntedUntil =
    rt.state.target.haunted.untilTick > 0 && rt.state.target.haunted.untilTick <= tick
      ? 0
      : rt.state.target.haunted.untilTick;
  const g = rt.state.magic;
  const m = rt.state.melee;
  const r = rt.state.ranged;
  const res = rt.state.necromancy.resources;
  const tm = rt.state.target.melee;
  const berserkExpired = m.berserkUntilTick <= tick;
  const bloodlust = m.bloodlust.berserk && berserkExpired ? endBerserk(m.bloodlust) : m.bloodlust;
  const punc = activePuncture(r.puncture, tick);
  const searingExpires = halfOpenUntil(r.searingWinds.expiresAtTick, tick);
  const sunExpires = halfOpenUntil(g.sunshine.expiresAtTick, tick);
  const instExpires = halfOpenUntil(g.instability.expiresAtTick, tick);
  const flowUntil = halfOpenUntil(g.flowUntilTick, tick);
  const erUntil = halfOpenUntil(m.enduringRuin.untilTick, tick);
  const targetErUntil = halfOpenUntil(tm.enduringRuin.untilTick, tick);
  const liveSpirits = spiritsForKey(rt.state.necromancy.conjures.spirits, tick);
  // Expiry + live CD/charges + map order: match structural distinguishability.
  const stateForKey = {
    ...rt.state,
    vestmentsAdrenalineUntilTick: halfOpenUntil(rt.state.vestmentsAdrenalineUntilTick, tick),
    relentlessUntilTick: halfOpenUntil(rt.state.relentlessUntilTick, tick),
    naturalInstinctUntilTick: halfOpenUntil(rt.state.naturalInstinctUntilTick, tick),
    cooldowns: liveCooldownsForKey(rt.state.cooldowns as Record<string, number>, tick),
    charges: liveChargesForKey(rt.state.charges as Record<string, readonly number[]>, tick),
    ...(rt.state.league
      ? {
          league: {
            avernicRampageUntilTick: halfOpenUntil(rt.state.league.avernicRampageUntilTick, tick),
            strikingLightReadyTick: halfOpenUntil(rt.state.league.strikingLightReadyTick, tick),
            lordOfLightReadyTick: halfOpenUntil(rt.state.league.lordOfLightReadyTick, tick),
          },
        }
      : {}),
    melee: {
      ...m,
      bloodlust,
      berserkUntilTick: berserkExpired ? 0 : m.berserkUntilTick,
      chaosRoarUntilTick: halfOpenUntil(m.chaosRoarUntilTick, tick),
      greaterFuryUntilTick: halfOpenUntil(m.greaterFuryUntilTick, tick),
      meteorStrikeUntilTick: halfOpenUntil(m.meteorStrikeUntilTick, tick),
      endlessAssaultUntilTick: halfOpenUntil(m.endlessAssaultUntilTick, tick),
      enduringRuin: {
        nextAttackBonus: erUntil > 0 ? m.enduringRuin.nextAttackBonus : 0,
        untilTick: erUntil,
        grantedByCast: erUntil > 0 ? m.enduringRuin.grantedByCast : -1,
      },
      // Match structural: normalize expired Leng atoms before JSON comparison.
      primordialIce: expirePrimordialIce(m.primordialIce, tick),
    },
    ranged: {
      ...r,
      puncture: punc,
      searingWinds: {
        expiresAtTick: searingExpires,
        ...(searingExpires > 0 && r.searingWinds.grantedByCast !== undefined
          ? { grantedByCast: r.searingWinds.grantedByCast }
          : {}),
      },
    },
    magic: {
      ...g,
      sunshine: {
        startsAtTick: sunExpires > 0 ? g.sunshine.startsAtTick : 0,
        expiresAtTick: sunExpires,
        ...(sunExpires > 0 && g.sunshine.grantedByCast !== undefined
          ? { grantedByCast: g.sunshine.grantedByCast }
          : {}),
      },
      instability: {
        expiresAtTick: instExpires,
        grantedByCast: instExpires > 0 ? g.instability.grantedByCast : -1,
      },
      flowUntilTick: flowUntil,
      flowReduction: flowUntil > 0 ? g.flowReduction : 0,
      tsunamiCritAdrenUntilTick: halfOpenUntil(g.tsunamiCritAdrenUntilTick, tick),
      blastInfusedUntilTick: halfOpenUntil(g.blastInfusedUntilTick, tick),
    },
    necromancy: {
      ...rt.state.necromancy,
      resources: {
        ...res,
        livingDeathUntilTick: halfOpenUntil(res.livingDeathUntilTick, tick),
        spectralScythe2UntilTick: halfOpenUntil(res.spectralScythe2UntilTick, tick),
        spectralScythe3UntilTick: halfOpenUntil(res.spectralScythe3UntilTick, tick),
      },
      conjures: {
        spirits: liveSpirits.map((c) =>
          c.id === "vengeful_ghost"
            ? { ...c, commanding: !!c.commanding && tick < c.untilTick }
            : c,
        ),
      },
    },
    target: {
      ...rt.state.target,
      burns: {
        active: liveClocksForKey(rt.state.target.burns.active as Record<string, number>, tick),
      },
      melee: {
        ...tm,
        bleeds: liveClocksForKey(tm.bleeds as Record<string, number>, tick),
        enduringRuin: {
          bleedVulnerability: targetErUntil > 0 ? tm.enduringRuin.bleedVulnerability : 0,
          untilTick: targetErUntil,
        },
      },
      haunted: {
        untilTick: hauntedUntil,
        capAbilityDamage: hauntedUntil === 0 ? 0 : rt.state.target.haunted.capAbilityDamage,
      },
      weaponPoison: weaponPoisonJson(rt.state.target.weaponPoison, tick, pending),
      evolvingToxin:
        tick < rt.state.target.evolvingToxin.expiresAtTick &&
        rt.state.target.evolvingToxin.stacks > 0
          ? rt.state.target.evolvingToxin
          : { stacks: 0, expiresAtTick: 0 },
    },
  };
  // Natural completion keeps endTick distinct; fixed-window duration is request-owned.
  return JSON.stringify([
    stateForKey,
    rt.queue.signature(),
    hitDetailsJsonPayload(rt, ranks),
    [...rt.spiritEventMeta]
      .map(([abs, m]) => [mapEventRefForKey(abs, ranks), m] as const)
      .sort(([a], [b]) => a - b),
    [...rt.scheduledSpiritTracks].sort(),
    [...rt.spiritHitCounts].sort(([a], [b]) => a.localeCompare(b)),
    rt.horizon == null ? rt.endTick : null,
  ]);
}

/** Compact structural key used by merge. */
export function branchKeyStructural(rt: SimulationRuntime): string {
  const pending = rt.queue.pending();
  const ranks = pendingKeyRanks(pending);
  return (
    encodeState(rt.state, ranks, pending) +
    RS +
    rt.queue.signature() +
    RS +
    encodeLiveDerivedHitDetails(rt, ranks) +
    RS +
    encodeSpiritMeta(rt.spiritEventMeta, ranks) +
    RS +
    encodeTracks(rt.scheduledSpiritTracks) +
    RS +
    encodeSpiritHits(rt.spiritHitCounts) +
    RS +
    (rt.horizon == null ? n(rt.endTick) : "")
  );
}

export function buildBranchKey(rt: SimulationRuntime): string {
  return envJsonBranchKey() ? branchKeyJson(rt) : branchKeyStructural(rt);
}

export interface BranchFingerprint {
  readonly hashA: number;
  readonly hashB: number;
  readonly structural: string;
}

export function fingerprintBranchKey(structural: string): BranchFingerprint {
  let hashA = 0x811c9dc5;
  let hashB = 0x9e3779b9;
  for (let index = 0; index < structural.length; index++) {
    const code = structural.charCodeAt(index);
    hashA = Math.imul(hashA ^ code, 0x01000193);
    hashB = Math.imul(hashB ^ code, 0x85ebca6b);
    hashB ^= hashB >>> 13;
  }
  return { hashA: hashA >>> 0, hashB: hashB >>> 0, structural };
}

export function buildBranchFingerprint(rt: SimulationRuntime): BranchFingerprint {
  return fingerprintBranchKey(buildBranchKey(rt));
}
