import { describe, expect, it } from "vitest";
import { rotationOf } from "../simulation/contracts";
import { simulate } from "../simulation/simulate";
import { simulateRevolution } from "../simulation/revolution";
import { fsoaMagicInput, magicInput } from "../../test/fixtures/inputs";
import { createCastContext } from "../simulation/context";
import { resolveLeagueRules } from "../../league/ruleset";
import { activeEquipmentEffects } from "../../shared/equipment";
import { calculateHit } from "../../pipeline/calculateHit";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { performCast } from "../cast";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";

const fsoaTumekenEffects = activeEquipmentEffects({
  style: "magic",
  equipmentSlots: {
    twohand: "item:fractured-staff-of-armadyl",
    helmet: "item:tumekens-resplendence-helm",
    body: "item:tumekens-resplendence-body",
    legs: "item:tumekens-resplendence-legs",
  },
});

/** EoF Instability on a non-FSOA magic 2h - style magic, no surging-storm / native special. */
const eofStaffOfLightEffects = activeEquipmentEffects({
  style: "magic",
  equipmentSlots: {
    twohand: "item:staff-of-light",
    amulet: "item:essence-of-finality",
  },
});

function delayedMagicHit(tickOffset: number) {
  const attack = magicInput.abilities.find((ability) => ability.id === "magic_attack")!;
  return {
    ...attack,
    id: `delayed_magic_${tickOffset}`,
    hits: [{ ...attack.hits[0]!, tickOffset }],
  };
}

describe("Lightning Surge proc event", () => {
  it("EoF Instability on staff of light (non-FSOA) still sets magicWeaponAtCast and schedules LS", () => {
    expect(eofStaffOfLightEffects.activeWeapon).toMatchObject({
      id: "item:staff-of-light",
      style: "magic",
      specialAttackId: null,
    });
    expect(eofStaffOfLightEffects.activeWeapon?.passiveIds).not.toContain("surging-storm");

    // Manual: EoF store grants Instability cast access; prepare snap reads equipped weapon style.
    const manual = simulate({
      ...magicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      weaponConfiguration: "twohand",
      equipmentIds: ["item:staff-of-light", "item:essence-of-finality"],
      equipmentEffects: eofStaffOfLightEffects,
      eofStoredSpecialId: "instability",
      rotation: rotationOf("instability", "magic_attack"),
    });
    expect(manual.ok).toBe(true);
    const manualAtkSeq = manual.casts.findIndex((c) => c.abilityId === "magic_attack");
    expect(manualAtkSeq).toBeGreaterThanOrEqual(0);
    const manualAtkHit = manual.events.find(
      (e) => e.sourceCast === manualAtkSeq && e.family === "hit",
    )!;
    expect(manualAtkHit.castSnap?.magicWeaponAtCast).toBe(true);
    expect(manualAtkHit.castSnap?.surgingStormAtCast).toBe(false);
    expect(manualAtkHit.lightningSurge).toBe(true);
    expect(
      manual.events.some(
        (e) =>
          e.family === "proc" &&
          e.abilityId === "instability_lightning_surge" &&
          e.sourceCast === manualAtkSeq,
      ),
    ).toBe(true);

    // Revolution native-special auto path uses the same performCast → prepare snap.
    const revo = simulateRevolution({
      ...magicInput,
      abilities: MAGIC_ABILITIES,
      bar: [MAGIC_ABILITIES.find((a) => a.id === "magic_attack")!],
      style: "magic",
      durationTicks: 20,
      crit: { chance: 1 },
      startingAdrenaline: 100,
      weaponConfiguration: "twohand",
      equipmentIds: ["item:staff-of-light", "item:essence-of-finality"],
      equipmentEffects: eofStaffOfLightEffects,
      eofStoredSpecialId: "instability",
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });
    expect(revo.ok).toBe(true);
    expect(revo.casts[0]).toMatchObject({ abilityId: "instability", tick: 0 });
    const revoAtkSeq = revo.casts.findIndex((c) => c.abilityId === "magic_attack");
    expect(revoAtkSeq).toBeGreaterThan(0);
    const revoAtkHit = revo.events.find(
      (e) => e.sourceCast === revoAtkSeq && e.family === "hit",
    )!;
    expect(revoAtkHit.castSnap?.magicWeaponAtCast).toBe(true);
    expect(revoAtkHit.lightningSurge).toBe(true);
    expect(
      revo.events.some(
        (e) =>
          e.family === "proc" &&
          e.abilityId === "instability_lightning_surge" &&
          e.sourceCast === revoAtkSeq,
      ),
    ).toBe(true);
  });

  it("schedules Instability's Lightning Surge as a proc event at sourceHitTick+1 (EV, non-recursive)", () => {
    const s = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      rotation: rotationOf(...Array(6).fill("magic_attack"), "instability", "magic_attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.rng?.lanes ?? 1).toBe(1);
    const instabilitySeq = s.casts.findIndex((c) => c.abilityId === "instability");
    const followSeq = s.casts.findIndex((c, i) => i > instabilitySeq);
    // Source: https://runescape.wiki/w/User%3ASfoxrs/sandbox/soa; this abstraction lands the candidate hit on the cast tick.
    // Instability's buff is active before its candidate hit in this abstraction.
    expect(s.events.filter((e) => e.sourceCast === instabilitySeq).map((e) => e.family)).toEqual([
      "hit",
      "proc",
    ]);
    const followEvents = s.events.filter((e) => e.sourceCast === followSeq);
    expect(followEvents.map((e) => e.family)).toEqual(["hit", "proc"]);
    const sourceHit = followEvents[0]!;
    // Source hit: boolean LS marker + castSnap (no nested lightningSurge.snap).
    expect(sourceHit.lightningSurge).toBe(true);
    expect(sourceHit.castSnap).toBeDefined();
    expect(sourceHit.castSnap!.castSeq).toBe(followSeq);
    const surge = followEvents[1]!;
    expect(surge.tick).toBe(s.casts[followSeq]!.tick + 1);
    expect(surge.procEligible).toBe(false);
    expect(surge.recursionAllowed).toBe(false);
    expect(surge.provenance).toEqual({ kind: "equipment_proc", detail: "lightning_surge" });
    expect(surge.lightningSurge).toBeUndefined();
    expect(surge.damage.expected).toBeCloseTo(1199.7512437810944, 10);
    expect(surge.damage.min).toBe(0);
    expect(surge.damage.max).toBe(0);
    // Hit events reconcile with the cast record; the surge EV lands in expected.
    expect(s.casts[followSeq]!.result.expected).toBeCloseTo(2899.2563913107733, 10);
    expect(s.casts[followSeq]!.result.hits).toHaveLength(1);
    expect(s.damageByTick[s.casts[followSeq]!.tick + 1]).toBeCloseTo(1199.7512437810944, 10);
  });

  it("checks Instability when the source hit lands, not when its cast starts", () => {
    const delayed = delayedMagicHit(5);
    const ctx = createCastContext({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, delayed],
    });
    ctx.performCast(delayed, 0, false);
    ctx.performCast(ctx.byId.get("instability")!, ctx.getState().tick, false);
    const summary = ctx.finish();
    // The schedule abstraction lands the candidate hit at its cast tick; this checks own-hit
    // eligibility and the sourced +1 proc delay, not an unsourced projectile offset.
    const procTicks = summary.events
      .filter((event) => event.family === "proc")
      .map((event) => event.tick);
    expect(procTicks).toHaveLength(2);
    expect(procTicks[0]).toBeLessThan(6);
    expect(procTicks[1]).toBe(6);
  });

  it("uses the half-open Instability window at the source hit boundary", () => {
    const lastActive = delayedMagicHit(46);
    const expired = delayedMagicHit(48);
    const active = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, lastActive],
      rotation: rotationOf("instability", lastActive.id),
    });
    const activeProcTicks = active.events
      .filter((event) => event.family === "proc")
      .map((event) => event.tick);
    expect(activeProcTicks).toHaveLength(2);
    expect(activeProcTicks.at(-1)).toBe(50);

    const inactive = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, expired],
      rotation: rotationOf("instability", expired.id),
    });
    const inactiveProcTicks = inactive.events
      .filter((event) => event.family === "proc")
      .map((event) => event.tick);
    expect(inactiveProcTicks).toHaveLength(1);
    expect(inactiveProcTicks[0]).toBeLessThan(48);
  });

  it("schedules full Lightning Surge only when the source hit crits", () => {
    // Concrete path: LS weight is 0 or 1 from parent outcome (not fractional EV).
    const s = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      rotation: rotationOf("instability", "magic_attack"),
    });
    const source = s.events.find(
      (event) => event.abilityId === "magic_attack" && event.family === "hit",
    )!;
    const surge = s.events.find(
      (event) =>
        event.family === "proc" &&
        event.provenance.detail === "lightning_surge" &&
        event.derivedFrom === source.seq,
    )!;
    expect(source.damage.critical?.outcome).toBe(true);
    expect(surge.expectedActivations).toBe(1);
    expect(surge.damage.expected).toBeGreaterThan(0);
  });

  it("checks each channel hit against the Instability expiry tick", () => {
    const attack = magicInput.abilities.find((ability) => ability.id === "magic_attack")!;
    const channel = {
      ...attack,
      id: "expiry_crossing_channel",
      channelTicks: 48,
      hits: [0, 46, 47].map((tickOffset) => ({ ...attack.hits[0]!, tickOffset })),
    };
    const s = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      startingAdrenaline: 50,
      abilities: [...magicInput.abilities, channel],
      rotation: rotationOf("instability", channel.id),
    });
    const procTicks = s.events
      .filter((event) => event.family === "proc")
      .map((event) => event.tick);
    expect(procTicks).toHaveLength(3);
    expect(procTicks).toContain(4);
    expect(procTicks).toContain(50);
    expect(procTicks).not.toContain(51);
  });

  it("does not inherit a channel parent hit-index bonus", () => {
    const attack = magicInput.abilities.find((ability) => ability.id === "magic_attack")!;
    const channel = {
      ...attack,
      id: "channelled_surge_source",
      channelTicks: 8,
      hits: [{ ...attack.hits[0]! }],
    };
    const equipmentEffects = activeEquipmentEffects({
      style: "magic",
      enchantments: ["metaphysics"],
      equipmentSlots: {
        twohand: "item:fractured-staff-of-armadyl",
        ring: "item:channelers-ring",
      },
    });
    // Channel may gain crit chance from gear; LS only if source critOutcome true.
    const rt = createRuntime(
      {
        ...fsoaMagicInput,
        crit: { chance: 0 },
        startingAdrenaline: 75,
        abilities: [...magicInput.abilities, channel],
        equipmentEffects,
      },
      { laneIndex: 0, laneCount: 1 },
    );
    expect(performCast(rt, rt.byId.get("instability")!, 0, false).ok).toBe(true);
    expect(performCast(rt, channel, rt.state.tick, false).ok).toBe(true);
    advanceTo(rt, rt.endTick);
    const source = rt.events.find((event) => event.abilityId === channel.id && event.family === "hit");
    const surge = rt.events.find((event) => event.family === "proc");
    expect(source?.damage.critical?.chance).toBeGreaterThan(0);
    if (source?.damage.critical?.outcome === true) {
      expect(surge).toBeDefined();
      expect(surge?.damage.critical?.chance).toBe(0);
    } else {
      expect(surge).toBeUndefined();
    }
  });

  it("does not inherit parent guaranteed or ability-specific crit layers", () => {
    const smokeRt = createRuntime(
      {
        ...fsoaMagicInput,
        crit: { chance: 0 },
        startingAdrenaline: 50,
      },
      { laneIndex: 0, laneCount: 1 },
    );
    expect(performCast(smokeRt, smokeRt.byId.get("instability")!, 0, false).ok).toBe(true);
    expect(performCast(smokeRt, smokeRt.byId.get("smoke_tendrils")!, smokeRt.state.tick, false).ok).toBe(
      true,
    );
    advanceTo(smokeRt, smokeRt.endTick);
    const smokeSource = smokeRt.events.find(
      (event) => event.abilityId === "smoke_tendrils" && event.family === "hit",
    );
    const smokeSurge = smokeRt.events.find(
      (event) => event.family === "proc" && event.sourceCast === smokeSource?.sourceCast,
    );
    expect(smokeSource?.damage.critical?.chance).toBe(1);
    expect(smokeSource?.damage.critical?.outcome).toBe(true);
    expect(smokeSurge?.damage.critical?.chance).toBe(0);

    const wildRt = createRuntime(
      {
        ...fsoaMagicInput,
        crit: { chance: 0 },
        startingAdrenaline: 75,
      },
      { laneIndex: 0, laneCount: 1 },
    );
    expect(performCast(wildRt, wildRt.byId.get("instability")!, 0, false).ok).toBe(true);
    expect(performCast(wildRt, wildRt.byId.get("wild_magic")!, wildRt.state.tick, false).ok).toBe(true);
    advanceTo(wildRt, wildRt.endTick);
    const wildSource = wildRt.events.find(
      (event) => event.abilityId === "wild_magic" && event.family === "hit",
    );
    const wildSurge = wildRt.events.find(
      (event) => event.family === "proc" && event.sourceCast === wildSource?.sourceCast,
    );
    expect(wildSource?.damage.critical?.chance).toBeCloseTo(0.1, 10);
    // LS only when that wild hit actually crits; surge itself has 0 crit chance.
    if (wildSource?.damage.critical?.outcome === true) {
      expect(wildSurge?.damage.critical?.chance).toBe(0);
    } else {
      expect(wildSurge).toBeUndefined();
    }
  });

  it("uses land-time Tumeken crit chance and Equilibrium suppression", () => {
    // Tumeken raises crit chance; LS only if that hit actually crits.
    const tumeken = createRuntime(
      {
        ...fsoaMagicInput,
        crit: { chance: 0 },
        startingAdrenaline: 100,
        equipmentEffects: fsoaTumekenEffects,
        tumekensPieces: 3,
        adrenaline: { relentlessRank: 1 },
      },
      { laneIndex: 0, laneCount: 1 },
    );
    expect(
      performCast(tumeken, tumeken.byId.get("instability")!, 0, false, { relentless: true }).ok,
    ).toBe(true);
    expect(performCast(tumeken, tumeken.byId.get("sunshine")!, tumeken.state.tick, false).ok).toBe(
      true,
    );
    expect(
      performCast(tumeken, tumeken.byId.get("magic_attack")!, tumeken.state.tick, false).ok,
    ).toBe(true);
    advanceTo(tumeken, tumeken.endTick);
    const attackHit = tumeken.events.find(
      (event) => event.abilityId === "magic_attack" && event.family === "hit",
    );
    expect(attackHit?.damage.critical?.chance).toBeCloseTo(0.045, 10);
    if (attackHit?.damage.critical?.outcome === true) {
      expect(tumeken.events.some((event) => event.family === "proc")).toBe(true);
    } else {
      expect(tumeken.events.some((event) => event.family === "proc")).toBe(false);
    }

    const equilibrium = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1, disabled: true },
      startingAdrenaline: 50,
      equipmentEffects: fsoaTumekenEffects,
      tumekensPieces: 3,
      rotation: rotationOf("instability", "magic_attack"),
    });
    expect(equilibrium.casts.at(-1)!.result.hits[0].critChance).toBe(0);
    expect(equilibrium.events.some((event) => event.family === "proc")).toBe(false);
  });

  it("Critual-capped chance materializes; LS only on concrete parent crit", () => {
    const league = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Order", "Order", "Order", "Chaos"],
    });
    const s = simulate(
      {
        ...fsoaMagicInput,
        crit: { chance: 0.8 },
        startingAdrenaline: 50,
        league,
        context: { style: "magic", ruleset: "equilibrium" },
        rotation: rotationOf("instability", "magic_attack"),
      },
      { stochasticSeed: 0 },
    );
    expect(s.rng?.lanes).toBe(128);
    const source = s.events.find((e) => e.abilityId === "magic_attack" && e.family === "hit");
    expect(source).toBeDefined();
    expect(source!.damage.critical?.chance).toBeCloseTo(0.5, 10);
    expect(typeof source!.damage.critical?.outcome).toBe("boolean");
    const surge = s.events.find(
      (e) =>
        e.family === "proc" &&
        e.provenance.detail === "lightning_surge" &&
        e.derivedFrom === source!.seq,
    );
    if (source!.damage.critical?.outcome === true) {
      expect(surge?.expectedActivations).toBe(1);
    } else {
      expect(surge).toBeUndefined();
    }
  });

  it("stochastic Critual parent crit schedules full Lightning Surge weight", () => {
    const league = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Order", "Order", "Order", "Chaos"],
    });
    let foundCritical = false;
    for (let laneIndex = 0; laneIndex < 128; laneIndex++) {
      const rt = createRuntime(
        {
          ...fsoaMagicInput,
          crit: { chance: 0.5 },
          startingAdrenaline: 50,
          league,
          context: { style: "magic", ruleset: "equilibrium" },
        },
        { laneIndex, laneCount: 128 },
      );
      expect(performCast(rt, rt.byId.get("instability")!, 0, false).ok).toBe(true);
      expect(performCast(rt, rt.byId.get("magic_attack")!, rt.state.tick, false).ok).toBe(true);
      advanceTo(rt, rt.endTick);
      const source = rt.events.find((e) => e.abilityId === "magic_attack" && e.family === "hit");
      if (source?.damage.critical?.outcome !== true) continue;
      foundCritical = true;
      const surges = rt.events.filter(
        (e) => e.family === "proc" && e.provenance.detail === "lightning_surge",
      );
      // Parent ability crit fires LS; Inferno may also fire LS if it crits (no Critual chain).
      const parentSurge = surges.find((e) => e.derivedFrom === source.seq);
      expect(parentSurge).toBeDefined();
      expect(parentSurge!.expectedActivations).toBe(1);
      expect(parentSurge!.lightningSurgeSourceCritChance).toBe(1);
      expect(parentSurge!.damage.expected).toBeGreaterThan(0);
      break;
    }
    expect(foundCritical).toBe(true);
  });

  it("magic-style Light of Saradomin crit can fire Lightning Surge under Instability", () => {
    const league = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Order"],
    });
    expect(league.blessingIds.has("striking-light")).toBe(true);

    let foundLightCrit = false;
    for (let laneIndex = 0; laneIndex < 128; laneIndex++) {
      const rt = createRuntime(
        {
          ...fsoaMagicInput,
          crit: { chance: 0.5 },
          startingAdrenaline: 50,
          league,
          context: { style: "magic", ruleset: "equilibrium" },
        },
        { laneIndex, laneCount: 128 },
      );
      expect(performCast(rt, rt.byId.get("instability")!, 0, false).ok).toBe(true);
      expect(performCast(rt, rt.byId.get("magic_attack")!, rt.state.tick, false).ok).toBe(true);
      advanceTo(rt, rt.endTick);

      const light = rt.events.find((e) => e.abilityId === "light-of-saradomin");
      if (!light || light.damage.critical?.outcome !== true) continue;
      foundLightCrit = true;
      expect(light.lightningSurge).toBe(true);
      expect(light.combatStyle).toBe("magic");
      const lightSurge = rt.events.find(
        (e) =>
          e.family === "proc" &&
          e.provenance.detail === "lightning_surge" &&
          e.derivedFrom === light.seq,
      );
      expect(lightSurge).toBeDefined();
      expect(lightSurge!.expectedActivations).toBe(1);
      break;
    }
    expect(foundLightCrit).toBe(true);
  });

  it("magic-style Inferno crit under Instability fires Lightning Surge; terminal noncrit does not", () => {
    const league = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Order", "Order", "Order", "Chaos"],
    });
    let foundCriticalInferno = false;
    let foundTerminalNoncrit = false;
    for (let laneIndex = 0; laneIndex < 128; laneIndex++) {
      const rt = createRuntime(
        {
          ...fsoaMagicInput,
          crit: { chance: 0.5 },
          startingAdrenaline: 50,
          league,
          context: { style: "magic", ruleset: "equilibrium" },
        },
        { laneIndex, laneCount: 128 },
      );
      expect(performCast(rt, rt.byId.get("instability")!, 0, false).ok).toBe(true);
      expect(performCast(rt, rt.byId.get("magic_attack")!, rt.state.tick, false).ok).toBe(true);
      advanceTo(rt, rt.endTick);

      const infernos = rt.events.filter((e) => e.abilityId === "inferno-of-zamorak");
      for (const inferno of infernos) {
        expect(inferno.lightningSurge).toBe(true);
        const lsFromInferno = rt.events.some(
          (e) =>
            e.family === "proc" &&
            e.provenance.detail === "lightning_surge" &&
            e.derivedFrom === inferno.seq,
        );
        if (inferno.damage.critical?.outcome === true) {
          foundCriticalInferno = true;
          expect(lsFromInferno).toBe(true);
        }
        if (inferno.damage.critical?.outcome === false) {
          foundTerminalNoncrit = true;
          expect(lsFromInferno).toBe(false);
        }
      }
      if (foundCriticalInferno && foundTerminalNoncrit) break;
    }
    expect(foundCriticalInferno).toBe(true);
    expect(foundTerminalNoncrit).toBe(true);
  });

  it("attaches Big Boned on a full Lightning Surge when the source crits", () => {
    const summary = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      league: resolveLeagueRules(
        { ruleset: "equilibrium", blessingPicks: ["Balance"] },
        { maximumLife: 10_000 },
      ),
      context: { style: "magic", ruleset: "equilibrium" },
      rotation: rotationOf(...Array(6).fill("magic_attack"), "instability", "magic_attack"),
    });
    const source = summary.events.find(
      (event) => event.abilityId === "magic_attack" && event.family === "hit",
    );
    // Last magic_attack after instability is the LS parent; find proc.
    const surge = summary.events.find((event) => event.family === "proc");
    expect(surge).toBeDefined();
    expect(surge!.expectedActivations).toBe(1);
    const bigBoned = surge!.components?.find((component) => component.id === "big-boned");
    expect(bigBoned?.analysis?.expectedActivations).toBe(1);
    expect(bigBoned?.damage.expected).toBeGreaterThan(0);
    expect(summary.events.some((event) => event.abilityId === "big-boned")).toBe(false);
    expect(source).toBeDefined();
  });

  it("counts Big Boned once on Lightning Surge (no materialize double-add)", () => {
    const rotation = rotationOf(
      ...Array(6).fill("magic_attack"),
      "instability",
      "magic_attack",
    );
    const withBb = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      league: resolveLeagueRules(
        { ruleset: "equilibrium", blessingPicks: ["Balance"] },
        { maximumLife: 10_000 },
      ),
      context: { style: "magic", ruleset: "equilibrium" },
      rotation,
    });
    const without = simulate({
      ...fsoaMagicInput,
      crit: { chance: 1 },
      context: { style: "magic" },
      rotation,
    });
    const surgeWith = withBb.events.find((event) => event.family === "proc");
    const surgeWithout = without.events.find((event) => event.family === "proc");
    expect(surgeWith).toBeDefined();
    expect(surgeWithout).toBeDefined();
    const bigBoned = surgeWith!.components?.find((component) => component.id === "big-boned");
    expect(bigBoned).toBeDefined();
    // materialize rebuilds pure host + components; composed hitDetail would double BB.
    expect(surgeWith!.damage.expected - surgeWithout!.damage.expected).toBeCloseTo(
      bigBoned!.damage.expected,
      10,
    );
  });
});
