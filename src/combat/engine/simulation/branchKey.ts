import type { HitResult } from "../../pipeline/calculateHit";
import type { ActiveConjure } from "../../styles/necromancy/conjures";
import { endBerserk } from "../../styles/melee/bloodlust";
import { normalizeLengFrostUntil } from "../../styles/melee/lengRng";
import { expirePrimordialIce } from "../../styles/melee/primordialIce";
import { activePuncture } from "../../styles/ranged/puncture";
import type { SimulationRuntime, SpiritEventMeta } from "../runtime/runtime";
import type { RotationState } from "../runtime/state";
import { liveDerivedSourceSeqs } from "../resolution/hitDetailsRetention";

/**
 * Future-evolution merge key (Phase 7).
 * Default: compact structural multi-field string. RS3_BRANCH_KEY_JSON=1 = JSON oracle.
 *
 * Field classes (merge key only; runtime still holds full history):
 * - Future: live state, pending queue, live derived hitDetails, spirit tracks/meta/hits
 * - Presentation/history (omitted): endTick, total* ledgers, casts/events logs
 * - Historical normalize: expired cooldowns/charges; frost/haunted/ghost/tsunami/blast;
 *   expired burns/bleeds; expired puncture via activePuncture; expired berserk via endBerserk
 * - Allocators omitted (merge takes max): nextSeq, nextCastSeq
 * - Map keys sorted so insertion order never blocks equivalence
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
 * Map of clocks still live after `tick` (value > tick).
 * Shared by ability readyAt, burn until, bleed until: missing and expired are equivalent.
 */
function recordLiveClocks(
  rec: Readonly<Record<string, number>>,
  tick: number,
): string {
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
function recordLiveReadyAt(
  rec: Readonly<Record<string, number>>,
  tick: number,
): string {
  return recordLiveClocks(rec, tick);
}

/**
 * Ability key -> still-recovering ready-at list.
 * Prune readyAt <= tick so fully recovered charges match never-spent state.
 */
function recordChargeLists(
  rec: Readonly<Record<string, readonly number[]>>,
  tick: number,
): string {
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
  const tick = state.tick;
  // Berserk land uses tick < until; clock endBerserk when until <= tick.
  const berserkExpired = m.berserkUntilTick <= tick;
  const bloodlust =
    m.bloodlust.berserk && berserkExpired ? endBerserk(m.bloodlust) : m.bloodlust;
  const berserkUntil = berserkExpired ? 0 : m.berserkUntilTick;
  // Expired puncture zeros stacks/stored/pending; keeps generation + lastCompletedCastSeq.
  const punc = activePuncture(r.puncture, tick);
  const parts: string[] = [
    n(tick),
    n(state.adrenaline),
    n(state.adrenalineCap),
    b(state.ringOfVigour),
    n(state.vestmentsAdrenalineUntilTick),
    recordLiveReadyAt(state.cooldowns as Record<string, number>, tick),
    recordChargeLists(state.charges as Record<string, readonly number[]>, tick),
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
    n(bloodlust.stacks),
    b(bloodlust.berserk),
    n(berserkUntil),
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
    // Primordial Ice: expired-normalized stack mass + expiry + frost open mass.
    (() => {
      const ice = expirePrimordialIce(m.primordialIce, tick);
      return ice.stackMass.map((w) => n(w)).join(US) + US + n(ice.expiresAtTick);
    })(),
    n(m.frostbladesOpenMass ?? 0),
    // Expired frost ≡ 0 (same as expand / completeAdvance).
    n(normalizeLengFrostUntil(m.frostbladesUntilTick, tick)),
    // ranged
    n(r.swiftness.startsAtTick),
    n(r.swiftness.expiresAtTick),
    n(r.searingWinds.expiresAtTick),
    r.searingWinds.grantedByCast === undefined ? "" : n(r.searingWinds.grantedByCast),
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
    // Tsunami / Blast Infused: expired until ≡ 0 for post-window merge.
    n(g.tsunamiCritAdrenUntilTick > 0 && g.tsunamiCritAdrenUntilTick <= tick
      ? 0
      : g.tsunamiCritAdrenUntilTick),
    n(g.blastInfusedUntilTick > 0 && g.blastInfusedUntilTick <= tick
      ? 0
      : g.blastInfusedUntilTick),
    // necromancy resources
    n(res.residualSouls),
    n(res.necrosisStacks),
    n(res.livingDeathUntilTick),
    b(res.lantern),
    n(res.spectralScythe2UntilTick),
    n(res.spectralScythe3UntilTick),
    n(res.deathSparkStacks),
    n(res.soulReaveStacks),
    b(res.soulReaveGrantOnLand),
    // conjures
    String(nec.conjures.spirits.length),
  ];
  for (const c of nec.conjures.spirits) {
    parts.push(encodeConjure(c, tick));
  }
  // Expired Haunted ≡ newHaunted() (zero until and cap).
  const hauntedUntil =
    t.haunted.untilTick > 0 && t.haunted.untilTick <= tick
      ? 0
      : t.haunted.untilTick;
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
    n(tm.enduringRuin.bleedVulnerability),
    n(tm.enduringRuin.untilTick),
    n(hauntedUntil),
    n(hauntedUntil === 0 ? 0 : t.haunted.capAbilityDamage),
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
  const tick = rt.state.tick;
  const hauntedUntil =
    rt.state.target.haunted.untilTick > 0 && rt.state.target.haunted.untilTick <= tick
      ? 0
      : rt.state.target.haunted.untilTick;
  const g = rt.state.magic;
  const m = rt.state.melee;
  const berserkExpired = m.berserkUntilTick <= tick;
  const bloodlust =
    m.bloodlust.berserk && berserkExpired ? endBerserk(m.bloodlust) : m.bloodlust;
  const punc = activePuncture(rt.state.ranged.puncture, tick);
  // Expiry + live CD/charges + map order: match structural distinguishability.
  const stateForKey = {
    ...rt.state,
    cooldowns: liveCooldownsForKey(rt.state.cooldowns as Record<string, number>, tick),
    charges: liveChargesForKey(rt.state.charges as Record<string, readonly number[]>, tick),
    melee: {
      ...m,
      bloodlust,
      berserkUntilTick: berserkExpired ? 0 : m.berserkUntilTick,
      // Match structural: expired ice -> empty unit mass (Icy Tempest / Leng future).
      primordialIce: expirePrimordialIce(m.primordialIce, tick),
      frostbladesUntilTick: normalizeLengFrostUntil(m.frostbladesUntilTick, tick),
    },
    ranged: {
      ...rt.state.ranged,
      puncture: punc,
    },
    magic: {
      ...g,
      tsunamiCritAdrenUntilTick:
        g.tsunamiCritAdrenUntilTick > 0 && g.tsunamiCritAdrenUntilTick <= tick
          ? 0
          : g.tsunamiCritAdrenUntilTick,
      blastInfusedUntilTick:
        g.blastInfusedUntilTick > 0 && g.blastInfusedUntilTick <= tick
          ? 0
          : g.blastInfusedUntilTick,
    },
    necromancy: {
      ...rt.state.necromancy,
      conjures: {
        spirits: rt.state.necromancy.conjures.spirits.map((c) =>
          c.id === "vengeful_ghost"
            ? { ...c, commanding: !!c.commanding && tick < c.untilTick }
            : c,
        ),
      },
    },
    target: {
      ...rt.state.target,
      burns: {
        active: liveClocksForKey(
          rt.state.target.burns.active as Record<string, number>,
          tick,
        ),
      },
      melee: {
        ...rt.state.target.melee,
        bleeds: liveClocksForKey(
          rt.state.target.melee.bleeds as Record<string, number>,
          tick,
        ),
      },
      haunted: {
        untilTick: hauntedUntil,
        capAbilityDamage: hauntedUntil === 0 ? 0 : rt.state.target.haunted.capAbilityDamage,
      },
    },
  };
  // endTick / nextSeq / nextCastSeq omitted: presentation + allocators (merge maxes them).
  return JSON.stringify([
    stateForKey,
    rt.queue.signature(),
    hitDetailsJsonPayload(rt),
    [...rt.spiritEventMeta].sort(([a], [b]) => a - b),
    [...rt.scheduledSpiritTracks].sort(),
    [...rt.spiritHitCounts].sort(([a], [b]) => a.localeCompare(b)),
  ]);
}

/** Compact structural key used by merge. */
export function branchKeyStructural(rt: SimulationRuntime): string {
  // Future state only: no endTick / nextSeq / nextCastSeq (see file header).
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
    encodeSpiritHits(rt.spiritHitCounts)
  );
}

export function buildBranchKey(rt: SimulationRuntime): string {
  return envJsonBranchKey() ? branchKeyJson(rt) : branchKeyStructural(rt);
}
