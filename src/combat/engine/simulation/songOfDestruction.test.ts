import { describe, expect, it } from "vitest";
import { baseInput } from "../../test/fixtures/inputs";
import { activeEquipmentEffects } from "../../shared/equipment";
import {
  advanceSongAdrenalineStream,
  armSongAdrenalineStream,
  normalizeSongAdrenalineStream,
  songOfDestructionSummary,
} from "../../styles/magic/songOfDestruction";
import { createRuntime } from "../runtime/runtime";
import { advanceTo } from "../runtime/clock";
import { patchMagic, patchPlayer } from "../runtime/state";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { performCast } from "../cast";
import { simulate } from "./simulate";
import { simulateRevolution } from "./revolution";
import { calculateHit } from "../../pipeline/calculateHit";
import { resolveLightningSurge } from "../resolution/lightningSurge";

describe("Song of Destruction adrenaline stream", () => {
  it("arms six pulses for any qualifying Basic and preserves them on other casts", () => {
    const summary = songOfDestructionSummary(1);
    const basic = { style: "melee" as const, category: "basic" as const, basicAttack: true };
    const utility = { style: "magic" as const, category: "utility" as const };
    const armed = armSongAdrenalineStream(summary, 25, basic, 10);
    expect(armed).toEqual({ nextPulseTick: 11, remainingPulses: 6 });
    expect(armSongAdrenalineStream(summary, 25, utility, 12, armed)).toEqual(armed);
  });

  it("replaces a stream after two pulses when basics are three ticks apart", () => {
    const summary = songOfDestructionSummary(1);
    const basic = { style: "melee" as const, category: "basic" as const, basicAttack: true };
    const first = armSongAdrenalineStream(summary, 25, basic, 0);
    const beforeReplacement = advanceSongAdrenalineStream(first, 0, 3);
    expect(beforeReplacement).toEqual({
      stream: { nextPulseTick: 3, remainingPulses: 4 },
      pulses: 2,
    });
    expect(advanceSongAdrenalineStream(first, 3, 4)).toEqual({
      stream: { nextPulseTick: 4, remainingPulses: 5 },
      pulses: 1,
    });
    expect(armSongAdrenalineStream(summary, 25, basic, 3, beforeReplacement.stream)).toEqual({
      nextPulseTick: 4,
      remainingPulses: 6,
    });
  });

  it("normalizes completed streams and stops when the Song is unequipped", () => {
    expect(normalizeSongAdrenalineStream({ nextPulseTick: 1, remainingPulses: 2 }, 3)).toEqual({
      nextPulseTick: 0,
      remainingPulses: 0,
    });
    expect(
      advanceSongAdrenalineStream({ nextPulseTick: 1, remainingPulses: 2 }, 3, 5),
    ).toEqual({ stream: { nextPulseTick: 0, remainingPulses: 0 }, pulses: 0 });
  });

  it("grants the armed pulses through the canonical simulation clock", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "melee" }),
      songOfDestruction: songOfDestructionSummary(1),
    };
    const rt = createRuntime({
      ...baseInput,
      context: { style: "melee" },
      equipmentEffects: effects,
      startingAdrenaline: 0,
    });
    const stream = armSongAdrenalineStream(
      songOfDestructionSummary(1),
      25,
      { style: "melee", category: "basic", basicAttack: true },
      0,
    );
    rt.state = patchMagic(rt.state, {
      song: { ...rt.state.magic.song, adrenalineStream: stream },
    });

    advanceTo(rt, 3);
    expect(rt.state.adrenaline).toBe(2);
    advanceTo(rt, 7);
    expect(rt.state.adrenaline).toBe(6);
    expect(rt.analysis.song.timedAdrenalineGained).toBe(6);
    expect(rt.state.magic.song.adrenalineStream).toEqual({
      nextPulseTick: 0,
      remainingPulses: 0,
    });

    rt.state = patchMagic(rt.state, {
      song: { ...rt.state.magic.song, adrenalineStream: { nextPulseTick: 8, remainingPulses: 6 } },
    });
    const unequipped = createRuntime({ ...baseInput, context: { style: "melee" } });
    unequipped.state = { ...unequipped.state, tick: 7, adrenaline: 0 };
    unequipped.state = patchMagic(unequipped.state, {
      song: { ...unequipped.state.magic.song, adrenalineStream: rt.state.magic.song.adrenalineStream },
    });
    advanceTo(unequipped, 10);
    expect(unequipped.state.adrenaline).toBe(0);
    expect(unequipped.state.magic.song.adrenalineStream).toEqual({
      nextPulseTick: 0,
      remainingPulses: 0,
    });
  });

  it("normalizes expired Song state at the clock boundary", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(1),
    };
    const rt = createRuntime({
      ...baseInput,
      context: { style: "magic" },
      equipmentEffects: effects,
    });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        essenceCorruption: { stacks: 10, expiresAtTick: 5 },
        conflagrateUntilTick: 5,
        adrenalineStream: { nextPulseTick: 1, remainingPulses: 1 },
      },
    });

    advanceTo(rt, 5);
    expect(rt.state.magic.song).toEqual({
      essenceCorruption: { stacks: 0, expiresAtTick: 0 },
      conflagrateUntilTick: 0,
      adrenalineStream: { nextPulseTick: 0, remainingPulses: 0 },
    });
    expect(rt.analysis.song.finalStacks).toBe(0);
  });

  it("preserves stored Essence while unequipped until its natural expiry", () => {
    const rt = createRuntime({ ...baseInput, context: { style: "magic" } });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        essenceCorruption: { stacks: 10, expiresAtTick: 5 },
      },
    });

    advanceTo(rt, 3);
    expect(rt.state.magic.song.essenceCorruption).toEqual({ stacks: 10, expiresAtTick: 5 });
    advanceTo(rt, 5);
    expect(rt.state.magic.song.essenceCorruption).toEqual({ stacks: 0, expiresAtTick: 0 });
  });

  it("does not apply a stored Conflagrate window while the Song is unequipped", () => {
    const rt = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
    });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        conflagrateUntilTick: 25,
      },
    });

    expect(performCast(rt, rt.byId.get("combust")!, 0, false)).toEqual({ ok: true });
    expect(rt.casts[0]!.result.hits[0]!.expected).toBe(300);
    expect(rt.state.magic.song.conflagrateUntilTick).toBe(25);
    expect(rt.analysis.song.conflagrateConsumptions).toBe(0);
  });

  it("adds a prospective stack flat term and mutates stacks only after a DoT land", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(1),
    };
    const rt = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      equipmentEffects: effects,
      startingAdrenaline: 100,
    });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        essenceCorruption: { stacks: 9, expiresAtTick: 50 },
      },
    });
    const combust = rt.byId.get("combust")!;
    expect(rt.state.magic.song.essenceCorruption.stacks).toBe(9);
    expect(performCast(rt, combust, 0, false, { "essence-corruption-empowerment": false })).toEqual({
      ok: true,
    });
    expect(rt.state.magic.song.essenceCorruption.stacks).toBe(10);
    expect(rt.casts[0]!.result.hits[0]!.expected).toBe(429);
    expect(rt.events.find((event) => event.abilityId === "combust")?.appliedEffects).toEqual([
      {
        id: "song:essence-corruption",
        stackCount: 10,
        remainingTicks: 50,
      },
    ]);
    expect(rt.analysis.song).toMatchObject({
      finalStacks: 10,
      peakStacks: 10,
      empowermentRolls: 1,
      empowermentActivations: 0,
      essenceFlatBonusDamage: 129,
    });
  });

  it("does not retroactively arm the Basic stream when a DoT reaches 25 stacks", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(1),
    };
    const rt = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      equipmentEffects: effects,
      startingAdrenaline: 100,
    });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        essenceCorruption: { stacks: 24, expiresAtTick: 50 },
      },
    });

    expect(
      performCast(rt, rt.byId.get("combust")!, 0, false, {
        "essence-corruption-empowerment": false,
      }),
    ).toEqual({ ok: true });
    expect(rt.casts[0]!.result.hits[0]!.expected).toBe(474);
    expect(rt.state.magic.song.essenceCorruption.stacks).toBe(25);
    expect(rt.state.magic.song.adrenalineStream).toEqual({
      nextPulseTick: 0,
      remainingPulses: 0,
    });

    expect(performCast(rt, rt.byId.get("magic_attack")!, 3, false)).toEqual({ ok: true });
    expect(rt.state.magic.song.adrenalineStream).toEqual({ nextPulseTick: 6, remainingPulses: 4 });
  });

  it("uses the capped prospective stack and refreshes its half-open expiry", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(1),
    };
    const rt = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      equipmentEffects: effects,
      startingAdrenaline: 100,
    });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        essenceCorruption: { stacks: 99, expiresAtTick: 50 },
      },
    });

    expect(
      performCast(rt, rt.byId.get("combust")!, 3, false, {
        "essence-corruption-empowerment": false,
      }),
    ).toEqual({ ok: true });
    expect(rt.casts[0]!.result.hits[0]!.expected).toBe(699);
    expect(rt.state.magic.song.essenceCorruption).toEqual({ stacks: 100, expiresAtTick: 56 });
  });

  it("uses the current effective Magic level in the Essence flat term", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(1),
    };
    const rt = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      equipmentEffects: effects,
      startingAdrenaline: 100,
    });
    rt.state = patchPlayer(rt.state, { levelOverride: { level: 120, untilTick: 50 } });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        essenceCorruption: { stacks: 9, expiresAtTick: 50 },
      },
    });

    expect(
      performCast(rt, rt.byId.get("combust")!, 0, false, {
        "essence-corruption-empowerment": false,
      }),
    ).toEqual({ ok: true });
    expect(rt.casts[0]!.result.hits[0]!.expected).toBe(450);
  });

  it("weights Lightning Surge Essence attribution by its source crit probability", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(1),
    };
    const rt = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      equipmentEffects: effects,
    });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        essenceCorruption: { stacks: 10, expiresAtTick: 50 },
      },
    });
    rt.hitDetails.set(
      42,
      calculateHit({
        base: 1_000,
        band: { minPct: 100, maxPct: 100 },
        level: 99,
        accuracy: 1,
        crit: { chance: 0.5 },
      }),
    );

    const surge = resolveLightningSurge(rt, 0, 42);
    expect(surge.postDamagePotentialFlatContribution).toBe(64.5);
    expect(surge.damage.expected).toBe(464.5);
  });

  it("arms and replaces the Basic stream from 25 pre-cast stacks", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(1),
    };
    const rt = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      equipmentEffects: effects,
      startingAdrenaline: 100,
    });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        essenceCorruption: { stacks: 25, expiresAtTick: 50 },
      },
    });
    const basic = rt.byId.get("magic_attack")!;
    performCast(rt, basic, 0, false);
    expect(rt.state.magic.song.adrenalineStream).toEqual({ nextPulseTick: 3, remainingPulses: 4 });
    performCast(rt, basic, 3, false);
    expect(rt.state.magic.song.adrenalineStream).toEqual({ nextPulseTick: 6, remainingPulses: 4 });
  });

  it("makes an empowered Combust immediate without leaving a normal burn", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(1),
    };
    const rt = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      equipmentEffects: effects,
      startingAdrenaline: 100,
    });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        essenceCorruption: { stacks: 1, expiresAtTick: 50 },
      },
    });
    const combust = rt.byId.get("combust")!;
    expect(performCast(rt, combust, 0, false, { "essence-corruption-empowerment": true })).toEqual({
      ok: true,
    });
    expect(rt.events.filter((event) => event.abilityId === "combust")).toHaveLength(10);
    expect(new Set(rt.events.filter((event) => event.abilityId === "combust").map((e) => e.tick))).toEqual(
      new Set([0]),
    );
    expect(rt.state.target.burns.active.combust).toBeUndefined();
    expect(rt.state.cooldowns.combust).toBeUndefined();
  });

  it("adds one prospective flat term to each Corruption tail without reapplying Song", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(2),
    };
    const rt = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      equipmentEffects: effects,
      startingAdrenaline: 100,
    });
    rt.state = patchMagic(rt.state, {
      song: {
        ...rt.state.magic.song,
        essenceCorruption: { stacks: 9, expiresAtTick: 50 },
      },
    });
    const corruption = rt.byId.get("corruption_blast")!;
    expect(performCast(rt, corruption, 0, false, { "essence-corruption-empowerment": false })).toEqual({
      ok: true,
    });
    advanceTo(rt, 7);
    const parent = rt.events.find((event) => event.abilityId === "corruption_blast" && event.hitIndex === 0)!;
    const tail = rt.events.find((event) => event.abilityId === "corruption_blast" && event.hitIndex === 1)!;
    expect(tail.damage.expected).toBeCloseTo(parent.damage.expected * 0.8 + 132, 10);
  });

  it("routes Soulfire through native access and consumes Conflagrate once", () => {
    const effects = {
      ...activeEquipmentEffects({ style: "magic" }),
      activeWeapon: {
        id: "item:roar-of-awakening",
        slot: "mainhand" as const,
        style: "magic" as const,
        specialAttackId: "soulfire",
        passiveIds: [],
      },
      songOfDestruction: songOfDestructionSummary(2),
    };
    const rt = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      equipmentIds: ["item:roar-of-awakening"],
      weaponConfiguration: "mainhand",
      equipmentEffects: effects,
      startingAdrenaline: 100,
    });
    const soulfire = rt.byId.get("soulfire")!;
    expect(performCast(rt, soulfire, 0, false)).toEqual({ ok: true });
    advanceTo(rt, 16);
    // 1 direct + 6 DoT (last DoT at tickOffset 15).
    expect(rt.events.filter((event) => event.abilityId === "soulfire")).toHaveLength(7);
    expect(rt.state.magic.song.conflagrateUntilTick).toBe(25);
    expect(rt.state.cooldowns.soulfire).toBe(75);

    const combust = rt.byId.get("combust")!;
    expect(performCast(rt, combust, 22, false, { "essence-corruption-empowerment": false })).toEqual({
      ok: true,
    });
    expect(rt.state.magic.song.conflagrateUntilTick).toBe(0);
    const firstCombust = rt.events.find((event) => event.abilityId === "combust")!;
    expect(firstCombust.damage.expected).toBeGreaterThan(300);
    expect(rt.analysis.song).toMatchObject({
      soulfireCasts: 1,
      conflagrateConsumptions: 1,
    });
  });

  // Pipeline pin: Song 2pc multiplies DoT only; Soulfire opener expected matches 1pc.
  it("does not multiply Soulfire direct opener damage under Song 2pc", () => {
    const castSoulfire = (pieceCount: number) => {
      const effects = {
        ...activeEquipmentEffects({ style: "magic" }),
        activeWeapon: {
          id: "item:roar-of-awakening",
          slot: "mainhand" as const,
          style: "magic" as const,
          specialAttackId: "soulfire",
          passiveIds: [],
        },
        songOfDestruction: songOfDestructionSummary(pieceCount),
      };
      const rt = createRuntime({
        ...baseInput,
        abilities: MAGIC_ABILITIES,
        context: { style: "magic" },
        equipmentIds: ["item:roar-of-awakening"],
        weaponConfiguration: "mainhand",
        equipmentEffects: effects,
        startingAdrenaline: 100,
      });
      expect(performCast(rt, rt.byId.get("soulfire")!, 0, false)).toEqual({ ok: true });
      advanceTo(rt, 16);
      return rt.events
        .filter((event) => event.abilityId === "soulfire")
        .sort((a, b) => a.hitIndex - b.hitIndex);
    };
    const onePieceHits = castSoulfire(1);
    const twoPieceHits = castSoulfire(2);
    expect(onePieceHits).toHaveLength(7);
    expect(twoPieceHits).toHaveLength(7);
    expect(twoPieceHits[0]!.damage.expected).toBe(onePieceHits[0]!.damage.expected);
    expect(twoPieceHits[1]!.damage.expected).toBeGreaterThan(onePieceHits[1]!.damage.expected);
  });

  it("requires Roar for Soulfire and applies Vigour plus native-special policy", () => {
    const odeEffects = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: { offhand: "item:ode-to-deceit" },
    });
    const odeRuntime = createRuntime({
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" },
      equipmentIds: ["item:ode-to-deceit"],
      weaponConfiguration: "dualwield",
      equipmentEffects: odeEffects,
      startingAdrenaline: 100,
    });
    expect(performCast(odeRuntime, odeRuntime.byId.get("soulfire")!, 0, false).ok).toBe(false);

    const roarEffects = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: { mainhand: "item:roar-of-awakening" },
    });
    const roarInput = {
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" as const },
      equipmentIds: ["item:roar-of-awakening"],
      weaponConfiguration: "mainhand" as const,
      equipmentEffects: roarEffects,
      startingAdrenaline: 100,
      adrenaline: { ringOfVigour: true },
    };
    const roarRuntime = createRuntime(roarInput);
    expect(performCast(roarRuntime, roarRuntime.byId.get("soulfire")!, 0, false)).toEqual({
      ok: true,
    });
    expect(roarRuntime.state.adrenaline).toBe(68);

    const revolution = simulateRevolution({
      ...roarInput,
      bar: [MAGIC_ABILITIES.find(({ id }) => id === "magic_attack")!],
      style: "magic",
      durationTicks: 180,
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });
    expect(revolution.ok).toBe(true);
    expect(revolution.casts.filter(({ abilityId }) => abilityId === "soulfire").length).toBeGreaterThanOrEqual(
      2,
    );
  });

  it("keeps fixed-window score and full-analysis totals equal", () => {
    const input = {
      ...baseInput,
      abilities: MAGIC_ABILITIES,
      context: { style: "magic" as const },
      equipmentEffects: {
        ...activeEquipmentEffects({ style: "magic" }),
        songOfDestruction: songOfDestructionSummary(2),
      },
      rotation: Array.from({ length: 8 }, () => ({ abilityId: "combust" })),
      horizonTicks: 50,
    };
    const full = simulate(input, { detailLevel: "full-analysis", stochasticSeed: 23 });
    const score = simulate(input, { detailLevel: "score-only", stochasticSeed: 23 });
    expect(full.ok).toBe(true);
    expect(score.ok).toBe(true);
    expect(full.totalExpected).toBeCloseTo(score.totalExpected, 10);
    expect(full.rng?.probabilityMass).toBe(1);
    expect(full.rng?.residualWeight).toBe(0);
    const repeat = simulate(input, { detailLevel: "full-analysis", stochasticSeed: 23 });
    expect(repeat.totalExpected).toBe(full.totalExpected);
    expect(repeat.analysis?.song).toEqual(full.analysis?.song);
  });
});
