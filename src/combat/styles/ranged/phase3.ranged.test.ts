import { describe, expect, it } from "vitest";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { rotationOf } from "../../engine/simulation/contracts";
import {
  applyRangedAmmunitionLandedState,
  onRangedHitLanded,
} from "../../engine/resolution/landed/ranged";
import { createRuntime } from "../../engine/runtime/runtime";
import { patchRanged } from "../../engine/runtime/state";
import { GLOBAL_COOLDOWN_TICKS } from "../../engine/runtime/timing";
import { rangedInput } from "../../test/fixtures/inputs";
import {
  PUNCTURE_ABILITY_ID,
  PUNCTURE_CAP,
  PUNCTURE_DURATION_TICKS,
  PUNCTURE_FIRST_OFFSET_AFTER_FINISH,
  PUNCTURE_HIT_PERCENTS,
  PUNCTURE_HIT_INTERVAL_TICKS,
  applyPunctureStack,
  newPuncture,
  punctureHitDamage,
  punctureSequenceTicks,
  punctureStoreAmount,
} from "./puncture";
import { applyCaromingToRicochetHits } from "./caroming";
import { darkfangBasicHits, hasDarkfangWeapon } from "./darkfang";
import { testRangedAmmunition } from "../../testing/rangedAmmunition";
import { caromingRicochetBonus } from "../../shared/perks";
import {
  buildSimulationInputBase,
  toManualSimulateInput,
  toRevolutionInput,
} from "../../model/simulationBase";
import { buildResolvedCombatModel } from "../../model/resolve";
import { projectSerializableSimBase } from "../../model/simulationInput";
import { canonicalSimulationIdentity } from "../../solver/identity";
import type { HostCombatResolveInput } from "../../model/contracts";
import { simulateRevolution } from "../../engine/simulation/revolution";
import { RANGED_ABILITIES } from "./abilities";
import { EQUIPMENT_SET_ACTIVATION } from "../../shared/equipment";
import type { RangedAmmunitionMechanicId } from "../../data/ammunition";
import type { ResolvedRangedAmmunitionProfile } from "./ammunitionProfile";

const BASE = 1000;

function hostScaffold(overrides: Partial<HostCombatResolveInput> = {}): HostCombatResolveInput {
  return {
    style: "ranged",
    base: BASE,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    equipmentEffects: {
      activation: EQUIPMENT_SET_ACTIVATION,
      setCritChance: { unconditional: 0, conditional: {} },
      passiveIds: [],
      enchantments: [],
      weaponClass: "bow",
      defenderEquipped: false,
      passage: { active: false, agonyActive: false },
      amZiFlatDamage: 0,
      amHejDamageBonus: 0,
      vestments: {
        pieces: 0,
        heraldOfChaos: false,
        berserkExtension: false,
        increasedAdrenalineCap: false,
      },
    },
    league: {
      ruleset: "base",
      blessings: [],
      blessingIds: [],
      relics: [],
      totalArmour: 0,
      maximumLife: 10_000,
      powerburstUntilTick: 0,
      targetSize: 1,
      occupiedTiles: 1,
    },
    equipmentIds: ["item:noxious-longbow"],
    weaponConfiguration: "twohand",
    diagnostics: {
      slayerHelmet: null,
      salve: null,
      berserkersFury: {
        active: false,
        bonus: 0,
        currentLifePoints: 10_000,
        maximumLifePoints: 10_000,
        currentHealthPercent: 100,
      },
      powerburstRemainingTicks: 0,
      ringOfVigourActive: false,
      ringOfVigourSources: [],
      archaeologySelectedIds: [],
      maxAdrenaline: 100,
    },
    ...overrides,
  };
}

function stageB1Ammunition(
  mechanicId: Extract<
    RangedAmmunitionMechanicId,
    "ful" | "jas-dragonbane" | "jas-demonbane" | "dragonbane" | "demonbane" | "black-stone"
  > | null,
  pernix = false,
): ResolvedRangedAmmunitionProfile {
  return {
    projectile:
      mechanicId == null
        ? null
        : {
            itemId: `item:test-${mechanicId}`,
            label: `Test ${mechanicId}`,
            family: "arrows",
            statTier: 100,
            mechanicId,
            support: { status: "modeled", label: "Modeled" },
          },
    quiver: pernix
      ? {
          itemId: "item:test-pernix-quiver",
          label: "Test Pernix quiver",
          acceptedFamilies: ["arrows"],
          passiveIds: ["pernix-quiver-max-hit-band"],
          support: { status: "modeled", label: "Modeled" },
        }
      : null,
    weaponCapability: { mode: "optional", acceptedFamily: "arrows" },
    effectiveStatTier: 100,
  };
}

describe("puncture pure helpers", () => {
  it("stores 1% ability damage per under-cap stack and caps at 250", () => {
    expect(punctureStoreAmount(BASE)).toBe(10);
    let state = newPuncture();
    for (let i = 0; i < 5; i++) {
      state = applyPunctureStack(state, i, BASE, 0);
    }
    expect(state.stacks).toBe(5);
    expect(state.storedDamage).toBe(50);
    expect(state.generation).toBe(5);

    for (let i = 0; i < PUNCTURE_CAP + 10; i++) {
      state = applyPunctureStack(state, 100 + i, BASE, 1);
    }
    expect(state.stacks).toBe(PUNCTURE_CAP);
    // First 250 stacks store; extras at cap add no damage.
    expect(state.storedDamage).toBe(PUNCTURE_CAP * 10);
  });

  it("sequence ticks: finish+1 then every 3 ticks", () => {
    const first = 10;
    expect([...punctureSequenceTicks(first)]).toEqual([10, 13, 16, 19, 22]);
    expect(PUNCTURE_HIT_PERCENTS).toEqual([50, 20, 15, 10, 5]);
    expect(punctureHitDamage(1000, 50)).toBe(500);
    expect(punctureHitDamage(1000, 15)).toBe(150);
  });

  it("1-stack base 1000: floor chain yields [5,2,1,1,0] (last 5% truncates)", () => {
    const stored = punctureStoreAmount(BASE);
    expect(stored).toBe(10);
    const hits = PUNCTURE_HIT_PERCENTS.map((pct) => punctureHitDamage(stored, pct));
    expect(hits).toEqual([5, 2, 1, 1, 0]);
    expect(hits.reduce((a, b) => a + b, 0)).toBe(9);
  });
});

describe("puncture runtime", () => {
  it("first application schedules 5 hits after ability finish", () => {
    const s = simulate({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
      rotation: rotationOf("piercing_shot"),
    });
    const dots = s.events.filter((e) => e.abilityId === PUNCTURE_ABILITY_ID);
    expect(dots).toHaveLength(5);
    // Piercing Shot: 2 hits land, each stack. Finish = candidate + GCD.
    const finish = GLOBAL_COOLDOWN_TICKS;
    const first = finish + PUNCTURE_FIRST_OFFSET_AFTER_FINISH;
    expect(dots.map((e) => e.tick)).toEqual([
      first,
      first + PUNCTURE_HIT_INTERVAL_TICKS,
      first + 2 * PUNCTURE_HIT_INTERVAL_TICKS,
      first + 3 * PUNCTURE_HIT_INTERVAL_TICKS,
      first + 4 * PUNCTURE_HIT_INTERVAL_TICKS,
    ]);
    // 2 stacks: stored 20; hits 10, 4, 3, 2, 1
    expect(dots.map((e) => e.damage.expected)).toEqual([10, 4, 3, 2, 1]);
    const ctx = createCastContext({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
    });
    ctx.performCast(ctx.byId.get("piercing_shot")!, 0, false);
    expect(ctx.getState().ranged.puncture.stacks).toBe(2);
    expect(ctx.getState().ranged.puncture.storedDamage).toBe(20);
  });

  it("stack growth and cap", () => {
    const ctx = createCastContext({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
    });
    const pierce = ctx.byId.get("piercing_shot")!;
    for (let i = 0; i < 30; i++) {
      ctx.performCast(pierce, ctx.getState().tick, false);
    }
    // 30 casts * 2 hits = 60 stacks
    expect(ctx.getState().ranged.puncture.stacks).toBe(60);
    expect(ctx.getState().ranged.puncture.storedDamage).toBe(600);

    const cap = createCastContext({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
    });
    for (let i = 0; i < 130; i++) {
      cap.performCast(pierce, cap.getState().tick, false);
    }
    expect(cap.getState().ranged.puncture.stacks).toBe(PUNCTURE_CAP);
    expect(cap.getState().ranged.puncture.storedDamage).toBe(PUNCTURE_CAP * 10);
  });

  it("refresh before first damage event: only new generation deals damage", () => {
    // Auto @0 schedules first puncture at finish+1 = 4.
    // Second auto @3 lands before that tick, bumps gen, reschedules at 7.
    const s = simulate({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
      rotation: rotationOf("ranged_attack", "ranged_attack"),
    });
    const dots = s.events.filter((e) => e.abilityId === PUNCTURE_ABILITY_ID);
    const firstNew = GLOBAL_COOLDOWN_TICKS * 2 + PUNCTURE_FIRST_OFFSET_AFTER_FINISH;
    const positive = dots.filter((e) => e.damage.expected > 0);
    expect(positive).toHaveLength(5);
    expect(positive.map((e) => e.tick)).toEqual([
      firstNew,
      firstNew + PUNCTURE_HIT_INTERVAL_TICKS,
      firstNew + 2 * PUNCTURE_HIT_INTERVAL_TICKS,
      firstNew + 3 * PUNCTURE_HIT_INTERVAL_TICKS,
      firstNew + 4 * PUNCTURE_HIT_INTERVAL_TICKS,
    ]);
    // 2 stacks snapshotted: [10,4,3,2,1]
    expect(positive.map((e) => e.damage.expected)).toEqual([10, 4, 3, 2, 1]);
    // Gen bump cancels stale queue rows; no pre-first-new puncture lands.
    const early = dots.filter((e) => e.tick < firstNew);
    expect(early).toHaveLength(0);
  });

  it("refresh during active sequence cancels unlanded tails", () => {
    // Piercing @0: 2 stacks, sequence first at 4 ([10,4,3,2,1]).
    // Piercing @8: after hits at 4 and 7, gen bump drops remaining old tails from queue.
    const ctx = createCastContext({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
    });
    const pierce = ctx.byId.get("piercing_shot")!;
    ctx.performCast(pierce, 0, false);
    ctx.performCast(pierce, 8, false);
    expect(ctx.getState().ranged.puncture.stacks).toBe(4);
    expect(ctx.getState().ranged.puncture.storedDamage).toBe(40);

    const s = ctx.finish();
    const dots = s.events.filter((e) => e.abilityId === PUNCTURE_ABILITY_ID);
    // Early gen hits that landed before refresh keep their damage.
    const early = dots.filter((e) => e.tick === 4 || e.tick === 7);
    expect(early.map((e) => e.damage.expected)).toEqual([10, 4]);
    // Old mid-sequence tails (10/13/16) never land - cancelled on gen bump.
    const staleTicks = [10, 13, 16];
    expect(dots.filter((e) => staleTicks.includes(e.tick))).toHaveLength(0);
    // New generation full sequence from finish@11 + 1 = 12; stored 40.
    const newFirst = 11 + PUNCTURE_FIRST_OFFSET_AFTER_FINISH;
    const fresh = dots.filter(
      (e) =>
        e.tick >= newFirst &&
        (e.tick - newFirst) % PUNCTURE_HIT_INTERVAL_TICKS === 0 &&
        e.damage.expected > 0,
    );
    expect(fresh.map((e) => e.damage.expected)).toEqual([20, 8, 6, 4, 2]);
  });

  it("event invalidation: gen bump cancels pending puncture before new sequence", () => {
    const rt = createRuntime({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
    });
    const attack = rt.byId.get("ranged_attack")!;
    // Land one hit as finished cast so sequence is scheduled immediately.
    rt.state = patchRanged(rt.state, {
      puncture: { ...rt.state.ranged.puncture, lastCompletedCastSeq: 0 },
    });
    onRangedHitLanded(
      rt,
      {
        tick: 0,
        seq: 0,
        family: "hit",
        abilityId: attack.id,
        sourceCast: 0,
        hitIndex: 0,
        attached: false,
        procEligible: true,
        recursionAllowed: false,
        originKind: "direct",
        provenance: { kind: "player_direct" },
        resolve: () => ({ damage: { min: 0, max: 0, expected: 0 } }),
      },
      attack,
      { min: 100, max: 100, expected: 100 },
    );
    expect(rt.queue.pending().filter((e) => e.abilityId === PUNCTURE_ABILITY_ID)).toHaveLength(5);
    const gen1 = rt.state.ranged.puncture.generation;
    // Second land under finished owner bumps gen and cancels prior queue rows.
    onRangedHitLanded(
      rt,
      {
        tick: 2,
        seq: 1,
        family: "hit",
        abilityId: attack.id,
        sourceCast: 0,
        hitIndex: 0,
        attached: false,
        procEligible: true,
        recursionAllowed: false,
        originKind: "direct",
        provenance: { kind: "player_direct" },
        resolve: () => ({ damage: { min: 0, max: 0, expected: 0 } }),
      },
      attack,
      { min: 100, max: 100, expected: 100 },
    );
    expect(rt.state.ranged.puncture.generation).toBeGreaterThan(gen1);
    const pending = rt.queue.pending().filter((e) => e.abilityId === PUNCTURE_ABILITY_ID);
    expect(pending).toHaveLength(5);
    // New sequence starts at land+1 = 3 (not the old first at 1).
    expect(pending.map((e) => e.tick)[0]).toBe(2 + PUNCTURE_FIRST_OFFSET_AFTER_FINISH);
  });

  it("snapshot isolation: stored damage ignores later base changes via fixed base", () => {
    // Engine base is fixed per sim; verify closed-over amount equals store*percent
    // not recalculated against hit damage.
    const s = simulate({
      ...rangedInput,
      base: 2000,
      ammunition: testRangedAmmunition("splintering"),
      rotation: rotationOf("ranged_attack"),
    });
    const dots = s.events.filter((e) => e.abilityId === PUNCTURE_ABILITY_ID);
    // 1 stack stores floor(2000*0.01)=20; percents of 20
    expect(dots.map((e) => e.damage.expected)).toEqual([10, 4, 3, 2, 1]);
  });

  it("1-stack base 1000 sequence floors to [5,2,1,1,0]", () => {
    const s = simulate({
      ...rangedInput,
      base: BASE,
      ammunition: testRangedAmmunition("splintering"),
      rotation: rotationOf("ranged_attack"),
    });
    const dots = s.events.filter((e) => e.abilityId === PUNCTURE_ABILITY_ID);
    expect(dots).toHaveLength(5);
    expect(dots.map((e) => e.damage.expected)).toEqual([5, 2, 1, 1, 0]);
  });

  it("puncture cannot recursively apply itself", () => {
    const ctx = createCastContext({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
    });
    ctx.performCast(ctx.byId.get("ranged_attack")!, 0, false);
    // Drain puncture sequence
    ctx.performCast(ctx.byId.get("ranged_attack")!, 40, false);
    // Only stacks from basics (2), not from puncture dots
    expect(ctx.getState().ranged.puncture.stacks).toBe(2);
  });

  it("horizon: puncture tails outside fixed window are excluded from primary total", () => {
    // Auto @0: finish 3, puncture at 4,7,10,13,16. Horizon 8 lands only 4 and 7.
    const horizon = 8;
    const inWindow = [5, 2];
    const outWindowSum = 1 + 1 + 0;
    const inWindowSum = inWindow.reduce((a, b) => a + b, 0);

    const windowed = createCastContext({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
      horizonTicks: horizon,
    });
    windowed.performCast(windowed.byId.get("ranged_attack")!, 0, false);
    const primary = windowed.finish(undefined, horizon);
    const landedDots = primary.events.filter((e) => e.abilityId === PUNCTURE_ABILITY_ID);
    expect(landedDots.map((e) => e.tick)).toEqual([4, 7]);
    expect(landedDots.map((e) => e.damage.expected)).toEqual(inWindow);
    expect(primary.perAbility[PUNCTURE_ABILITY_ID] ?? 0).toBe(inWindowSum);
    expect(primary.horizonTicks).toBe(horizon);
    expect(primary.metric.tails).toBe("excluded");

    const withTailsCtx = createCastContext({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
      horizonTicks: horizon,
    });
    withTailsCtx.performCast(withTailsCtx.byId.get("ranged_attack")!, 0, false);
    const tails = withTailsCtx.finish(undefined, horizon, { includeTails: true });
    expect(tails.tails?.inWindowExpectedDamage).toBe(primary.totalExpected);
    expect(tails.tails?.postWindowTailDamage).toBeGreaterThanOrEqual(outWindowSum);
    expect(tails.totalExpected).toBe(primary.totalExpected);
    expect(tails.totalExpected).toBeLessThan(tails.tails!.totalIncludingTails);
  });

  it("expires after duration without reapplication", () => {
    const ctx = createCastContext({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
    });
    const attack = ctx.byId.get("ranged_attack")!;
    ctx.performCast(attack, 0, false);
    expect(ctx.getState().ranged.puncture.stacks).toBe(1);
    // Advance far past duration
    const late = PUNCTURE_DURATION_TICKS + 50;
    ctx.performCast(attack, late, false);
    // Fresh stack after expire
    expect(ctx.getState().ranged.puncture.stacks).toBe(1);
    expect(ctx.getState().ranged.puncture.storedDamage).toBe(10);
  });

  it("late land after owner cast completed schedules from land (no orphan pending)", () => {
    // Hit with sourceCast already finished would set pendingOwnerCast to a cast
    // that never completes again; lastCompletedCastSeq forces immediate schedule.
    const rt = createRuntime({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
    });
    const ability = rt.byId.get("ranged_attack")!;
    const finishedCast = 7;
    const landTick = 12;
    rt.state = patchRanged(rt.state, {
      puncture: {
        ...rt.state.ranged.puncture,
        lastCompletedCastSeq: finishedCast,
      },
    });
    onRangedHitLanded(
      rt,
      {
        tick: landTick,
        seq: 0,
        family: "hit",
        abilityId: ability.id,
        sourceCast: finishedCast,
        hitIndex: 0,
        attached: false,
        procEligible: true,
        recursionAllowed: false,
        originKind: "direct",
        provenance: { kind: "player_direct" },
        resolve: () => ({ damage: { min: 0, max: 0, expected: 0 } }),
      },
      ability,
      { min: 100, max: 100, expected: 100 },
    );
    const p = rt.state.ranged.puncture;
    expect(p.stacks).toBe(1);
    expect(p.pendingOwnerCast).toBe(-1);
    expect(p.storedDamage).toBe(10);
    const dots = rt.queue.pending().filter((e) => e.abilityId === PUNCTURE_ABILITY_ID);
    expect(dots).toHaveLength(5);
    const first = landTick + PUNCTURE_FIRST_OFFSET_AFTER_FINISH;
    expect(dots.map((e) => e.tick)).toEqual([
      first,
      first + PUNCTURE_HIT_INTERVAL_TICKS,
      first + 2 * PUNCTURE_HIT_INTERVAL_TICKS,
      first + 3 * PUNCTURE_HIT_INTERVAL_TICKS,
      first + 4 * PUNCTURE_HIT_INTERVAL_TICKS,
    ]);
  });

  it("open cast multi-hit defers schedule until completion (no per-hit schedule)", () => {
    const rt = createRuntime({
      ...rangedInput,
      ammunition: testRangedAmmunition("splintering"),
    });
    const ability = rt.byId.get("piercing_shot")!;
    const openCast = 3;
    // lastCompletedCastSeq stays -1 so openCast is still open.
    for (let hit = 0; hit < 2; hit++) {
      onRangedHitLanded(
        rt,
        {
          tick: hit,
          seq: hit,
          family: "hit",
          abilityId: ability.id,
          sourceCast: openCast,
          hitIndex: hit,
          attached: false,
          procEligible: true,
          recursionAllowed: false,
          originKind: "direct",
          provenance: { kind: "player_direct" },
          resolve: () => ({ damage: { min: 0, max: 0, expected: 0 } }),
        },
        ability,
        { min: 100, max: 100, expected: 100 },
      );
    }
    expect(rt.state.ranged.puncture.stacks).toBe(2);
    expect(rt.state.ranged.puncture.pendingOwnerCast).toBe(openCast);
    expect(rt.queue.pending().filter((e) => e.abilityId === PUNCTURE_ABILITY_ID)).toHaveLength(0);
  });
});

describe("deathspore / searing winds / shadow imbued regressions", () => {
  it("deathspore free-cast still works with splintering path unused", () => {
    const rotation = rotationOf(...Array(12).fill("ranged_attack"), "imbue_shadows");
    const s = simulate({
      ...rangedInput,
      ammunition: testRangedAmmunition("deathspore"),
      startingAdrenaline: 100,
      rotation,
    });
    expect(s.casts.some((c) => c.abilityId === "imbue_shadows" && c.actualSpend === 0)).toBe(true);
  });

  it("searing winds boosts a follow-up attack", () => {
    const bare = simulate({
      ...rangedInput,
      startingAdrenaline: 100,
      rotation: rotationOf("ranged_attack"),
    });
    const withSw = simulate({
      ...rangedInput,
      startingAdrenaline: 100,
      rotation: rotationOf("galeshot", "ranged_attack"),
    });
    const bareHit = bare.events.find((e) => e.abilityId === "ranged_attack" && e.family === "hit");
    const buffed = withSw.events.find((e) => e.abilityId === "ranged_attack" && e.family === "hit");
    expect(buffed?.damage.expected ?? 0).toBeGreaterThan(bareHit?.damage.expected ?? 0);
  });

  it("shadow imbued grants adrenaline on a follow-up hit", () => {
    const s = simulate({
      ...rangedInput,
      startingAdrenaline: 100,
      rotation: rotationOf("imbue_shadows", "ranged_attack"),
    });
    const attack = s.casts.find((c) => c.abilityId === "ranged_attack");
    // Imbue costs 40 from 100 -> 60; basic +9 listed +5 imbued.
    expect(attack?.adrenalineAfter).toBe(60 + 9 + 5);
  });
});

describe("darkfang basic", () => {
  it("hasDarkfangWeapon detects catalogue ids, active weapon, and augmented", () => {
    expect(hasDarkfangWeapon(["item:dark-bow"])).toBe(true);
    expect(hasDarkfangWeapon(["item:gloomfire-bow"])).toBe(true);
    expect(hasDarkfangWeapon(["item:seren-godbow"])).toBe(false);
    expect(hasDarkfangWeapon(undefined, "item:dark-bow")).toBe(true);
    expect(hasDarkfangWeapon([], "item:gloomfire-bow")).toBe(true);
    expect(hasDarkfangWeapon(["item:augmented-dark-bow"])).toBe(true);
    expect(hasDarkfangWeapon(undefined, "item:augmented-gloomfire-bow")).toBe(true);
    expect(hasDarkfangWeapon(undefined, "item:seren-godbow")).toBe(false);
  });

  it("produces two independent 45-55% hits on the timeline", () => {
    const s = simulate({
      ...rangedInput,
      equipmentIds: ["item:dark-bow"],
      rotation: rotationOf("ranged_attack"),
    });
    const hits = s.events.filter(
      (e) => e.abilityId === "ranged_attack" && e.family === "hit" && !e.attached,
    );
    expect(hits).toHaveLength(2);
    // Each hit: 45-55% of 1000 = 450-550, expected 500
    expect(hits[0]!.damage.expected).toBe(500);
    expect(hits[1]!.damage.expected).toBe(500);
    expect(darkfangBasicHits()).toHaveLength(2);
  });

  it("detects darkfang via activeWeapon when equipmentIds omit the bow", () => {
    const s = simulate({
      ...rangedInput,
      equipmentIds: [],
      equipmentEffects: {
        activation: EQUIPMENT_SET_ACTIVATION,
        setCritChance: { unconditional: 0, conditional: {} },
        passiveIds: [],
        enchantments: [],
        weaponClass: "bow",
        defenderEquipped: false,
        passage: { active: false, agonyActive: false },
        amZiFlatDamage: 0,
        amHejDamageBonus: 0,
        vestments: {
          pieces: 0,
          heraldOfChaos: false,
          berserkExtension: false,
          increasedAdrenalineCap: false,
        },
        activeWeapon: {
          id: "item:dark-bow",
          slot: "twohand",
          style: "ranged",
          specialAttackId: "descent_of_darkness",
          passiveIds: [],
        },
      },
      rotation: rotationOf("ranged_attack"),
    });
    const hits = s.events.filter(
      (e) => e.abilityId === "ranged_attack" && e.family === "hit" && !e.attached,
    );
    expect(hits).toHaveLength(2);
    expect(hits[0]!.damage.expected).toBe(500);
    expect(hits[1]!.damage.expected).toBe(500);
  });

  it("each darkfang hit participates in deathspore stacks", () => {
    const ctx = createCastContext({
      ...rangedInput,
      ammunition: testRangedAmmunition("deathspore"),
      equipmentIds: ["item:gloomfire-bow"],
    });
    const attack = ctx.byId.get("ranged_attack")!;
    // 6 basics * 2 hits = 12 stacks -> free cast opens
    for (let i = 0; i < 6; i++) {
      ctx.performCast(attack, ctx.getState().tick, false);
    }
    expect(ctx.getState().ranged.deathspore.freeCastUntilTick).toBeGreaterThan(0);
  });
});

describe("caroming", () => {
  it("adds flat +4% AD per rank to each ricochet hit band (wiki table)", () => {
    const base = RANGED_ABILITIES.find((a) => a.id === "ricochet")!.hits;
    const r4 = applyCaromingToRicochetHits(base, 4);
    const add = Math.round(caromingRicochetBonus(4) * 100);
    expect(add).toBe(16);
    // Rank 4 main 75-85 -> 91-101; returns 15-20 -> 31-36
    expect(r4[0]!.band.minPct).toBe(base[0]!.band.minPct + add);
    expect(r4[0]!.band.maxPct).toBe(base[0]!.band.maxPct + add);
    expect(r4[1]!.band.minPct).toBe(base[1]!.band.minPct + add);
    expect(r4).toHaveLength(base.length);
  });

  it("raises ricochet expected damage per hit without flattening", () => {
    const plain = simulate({
      ...rangedInput,
      rotation: rotationOf("ricochet"),
    });
    const withPerk = simulate({
      ...rangedInput,
      caromingRank: 4,
      rotation: rotationOf("ricochet"),
    });
    const plainHits = plain.events.filter(
      (e) => e.abilityId === "ricochet" && e.family === "hit" && !e.attached,
    );
    const perkHits = withPerk.events.filter(
      (e) => e.abilityId === "ricochet" && e.family === "hit" && !e.attached,
    );
    expect(plainHits).toHaveLength(3);
    expect(perkHits).toHaveLength(3);
    // Flat +16 AD% on each hit (not *1.16). Mean EV scales as (mid+16)/mid.
    for (let i = 0; i < 3; i++) {
      expect(perkHits[i]!.damage.expected).toBeGreaterThan(plainHits[i]!.damage.expected);
    }
    // Primary mid 80 -> 96 => 1.2x at base 1000
    expect(perkHits[0]!.damage.expected).toBeCloseTo(plainHits[0]!.damage.expected * (96 / 80), 5);
  });

  it("adds integer percentage points (no multiplicative float dust)", () => {
    const scaled = applyCaromingToRicochetHits(
      [{ band: { minPct: 15, maxPct: 20 }, tickOffset: 1 }],
      1,
    );
    expect(scaled[0]!.band.minPct).toBe(19);
    expect(scaled[0]!.band.maxPct).toBe(24);
  });
});

describe("deterministic ammunition hit effects", () => {
  it("applies Ful damage and Damage Potential to current ability events", () => {
    const ability = simulate({
      ...rangedInput,
      accuracy: 0.8,
      ammunition: stageB1Ammunition("ful"),
      rotation: rotationOf("piercing_shot"),
    }).casts[0]!.result;
    const abilityReference = simulate({
      ...rangedInput,
      accuracy: 0.7,
      rotation: rotationOf("piercing_shot"),
    }).casts[0]!.result;
    expect(ability.hits).toHaveLength(2);
    expect(ability.hits.every((hit) => Math.abs(hit.potential - 0.7) < 1e-12)).toBe(true);
    for (let index = 0; index < ability.hits.length; index++) {
      expect(ability.hits[index]!.min / abilityReference.hits[index]!.min).toBeCloseTo(1.15, 2);
      expect(ability.hits[index]!.max / abilityReference.hits[index]!.max).toBeCloseTo(1.15, 2);
    }

    const basic = simulate({
      ...rangedInput,
      accuracy: 0.8,
      ammunition: stageB1Ammunition("ful"),
      rotation: rotationOf("ranged_attack"),
    }).casts[0]!.result.hits[0]!;
    const basicReference = simulate({
      ...rangedInput,
      accuracy: 0.7,
      rotation: rotationOf("ranged_attack"),
    }).casts[0]!.result.hits[0]!;
    expect(basic.potential).toBeCloseTo(0.7, 12);
    expect(basic.min / basicReference.min).toBeCloseTo(1.15, 2);
    expect(basic.max / basicReference.max).toBeCloseTo(1.15, 2);
  });

  it.each([
    ["jas-dragonbane", { dragon: true, demon: false }, { dragon: false, demon: true }, 0.2, 1.3],
    ["jas-demonbane", { demon: true, dragon: false }, { demon: false, dragon: true }, 0.2, 1.3],
    ["dragonbane", { dragon: true, demon: false }, { dragon: false, demon: true }, 0.3, 1.25],
    ["demonbane", { demon: true, dragon: false }, { demon: false, dragon: true }, 0.3, 1.25],
  ] as const)(
    "%s gates ability damage and Damage Potential to the exact target group",
    (mechanicId, matching, nonMatching, damagePotentialDelta, multiplier) => {
      const inputAccuracy = 0.4;
      const matchingResult = simulate({
        ...rangedInput,
        accuracy: inputAccuracy,
        ammunition: stageB1Ammunition(mechanicId),
        targetClassification: matching,
        rotation: rotationOf("ricochet"),
      }).casts[0]!.result;
      const matchingReference = simulate({
        ...rangedInput,
        accuracy: inputAccuracy + damagePotentialDelta,
        rotation: rotationOf("ricochet"),
      }).casts[0]!.result;
      const nonMatchingResult = simulate({
        ...rangedInput,
        accuracy: inputAccuracy,
        ammunition: stageB1Ammunition(mechanicId),
        targetClassification: nonMatching,
        rotation: rotationOf("ricochet"),
      }).casts[0]!.result;
      const absentClassification = simulate({
        ...rangedInput,
        accuracy: inputAccuracy,
        ammunition: stageB1Ammunition(mechanicId),
        rotation: rotationOf("ricochet"),
      }).casts[0]!.result;
      const nonMatchingReference = simulate({
        ...rangedInput,
        accuracy: inputAccuracy,
        rotation: rotationOf("ricochet"),
      }).casts[0]!.result;

      expect(matchingResult.hits).toHaveLength(3);
      expect(
        matchingResult.hits.every((hit) => hit.potential === inputAccuracy + damagePotentialDelta),
      ).toBe(true);
      for (let index = 0; index < matchingResult.hits.length; index++) {
        expect(
          matchingResult.hits[index]!.expected / matchingReference.hits[index]!.expected,
        ).toBeCloseTo(multiplier, 2);
      }
      expect(nonMatchingResult.hits).toEqual(nonMatchingReference.hits);
      expect(absentClassification.hits).toEqual(nonMatchingReference.hits);
    },
  );

  it("uses the attuned-bane ability multiplier for the modern Basic Attack", () => {
    const basic = simulate({
      ...rangedInput,
      accuracy: 0.4,
      ammunition: stageB1Ammunition("dragonbane"),
      targetClassification: { dragon: true },
      rotation: rotationOf("ranged_attack"),
    }).casts[0]!.result.hits[0]!;
    const reference = simulate({
      ...rangedInput,
      accuracy: 0.7,
      rotation: rotationOf("ranged_attack"),
    }).casts[0]!.result.hits[0]!;
    expect(basic.potential).toBeCloseTo(0.7, 12);
    expect(basic.min).toBe(Math.floor(reference.min * 1.25));
    expect(basic.max).toBe(Math.floor(reference.max * 1.25));
  });

  it("raises only Pernix's maximum band below 25% current target LP", () => {
    const ammunition = stageB1Ammunition(null, true);
    const below = simulate({
      ...rangedInput,
      ammunition,
      targetMaximumLifePoints: 10_000,
      targetHpPercent: 24.99,
      rotation: rotationOf("ranged_attack"),
    }).casts[0]!.result.hits[0]!;
    const exact = simulate({
      ...rangedInput,
      ammunition,
      targetMaximumLifePoints: 10_000,
      targetHpPercent: 25,
      rotation: rotationOf("ranged_attack"),
    }).casts[0]!.result.hits[0]!;
    const reference = simulate({
      ...rangedInput,
      targetMaximumLifePoints: 10_000,
      targetHpPercent: 24.99,
      rotation: rotationOf("ranged_attack"),
    }).casts[0]!.result.hits[0]!;
    expect(below.min).toBe(reference.min);
    expect(below.max).toBe(reference.max + 40);
    expect(exact.min).toBe(reference.min);
    expect(exact.max).toBe(reference.max);
  });

  it("does not apply Jas damage or accuracy to a Searing Winds attached component", () => {
    const result = simulate({
      ...rangedInput,
      accuracy: 0.5,
      ammunition: stageB1Ammunition("jas-dragonbane"),
      targetClassification: { dragon: true },
      startingAdrenaline: 100,
      rotation: rotationOf("galeshot", "ranged_attack"),
    });
    const attack = result.events.find(
      (event) => event.abilityId === "ranged_attack" && event.family === "hit",
    );
    const attached = attack?.components?.find((component) => component.id === "searing_winds");
    const damageReference = simulate({
      ...rangedInput,
      accuracy: 0.7,
      startingAdrenaline: 100,
      rotation: rotationOf("galeshot", "ranged_attack"),
    }).events.find((event) => event.abilityId === "ranged_attack" && event.family === "hit");
    const attachedReference = simulate({
      ...rangedInput,
      accuracy: 0.5,
      startingAdrenaline: 100,
      rotation: rotationOf("galeshot", "ranged_attack"),
    })
      .events.find((event) => event.abilityId === "ranged_attack" && event.family === "hit")
      ?.components?.find((component) => component.id === "searing_winds");
    const directExpected = (attack?.damage.expected ?? 0) - (attached?.damage.expected ?? 0);
    const referenceDirectExpected =
      (damageReference?.damage.expected ?? 0) -
      (damageReference?.components?.find((component) => component.id === "searing_winds")?.damage
        .expected ?? 0);
    expect(directExpected / referenceDirectExpected).toBeCloseTo(1.3, 2);
    expect(attached?.damage).toEqual(attachedReference?.damage);
  });

  it("applies Black Stone after the current hit and lowers armour for later hits", () => {
    const ammunition = stageB1Ammunition("black-stone");
    const targetAccuracyProfile = {
      playerAccuracyRating: 1000,
      originalTargetArmourRating: 1200,
      affinity: 60,
      additiveHitChance: 0,
    };
    const withBlackStone = simulate({
      ...rangedInput,
      accuracy: 0.5,
      ammunition,
      targetAccuracyProfile,
      rotation: rotationOf("ranged_attack", "ranged_attack"),
    });
    const withoutBlackStone = simulate({
      ...rangedInput,
      accuracy: 0.5,
      rotation: rotationOf("ranged_attack", "ranged_attack"),
    });
    const liveHits = withBlackStone.events.filter(
      (event) => event.abilityId === "ranged_attack" && event.family === "hit",
    );
    const referenceHits = withoutBlackStone.events.filter(
      (event) => event.abilityId === "ranged_attack" && event.family === "hit",
    );
    expect(liveHits).toHaveLength(2);
    expect(referenceHits).toHaveLength(2);
    expect(liveHits[0]!.damage).toEqual(referenceHits[0]!.damage);
    expect(liveHits[1]!.damage.expected).toBeGreaterThan(referenceHits[1]!.damage.expected);
  });

  it("keeps Black Stone on the scalar fallback when no target profile is resolved", () => {
    const withArrow = simulate({
      ...rangedInput,
      ammunition: stageB1Ammunition("black-stone"),
      rotation: rotationOf("ranged_attack"),
    });
    const withoutArrow = simulate({ ...rangedInput, rotation: rotationOf("ranged_attack") });
    expect(withArrow.events).toEqual(withoutArrow.events);
  });

  it("accepts the explicit BotLG ammunition origin for Black Stone state", () => {
    const rt = createRuntime({
      ...rangedInput,
      ammunition: stageB1Ammunition("black-stone"),
      targetAccuracyProfile: {
        playerAccuracyRating: 1000,
        originalTargetArmourRating: 1200,
        affinity: 60,
        additiveHitChance: 0,
      },
    });
    const attack = rt.byId.get("ranged_attack")!;
    applyRangedAmmunitionLandedState(
      rt,
      {
        tick: 0,
        seq: 0,
        family: "hit",
        abilityId: attack.id,
        sourceCast: 0,
        hitIndex: 0,
        attached: false,
        procEligible: false,
        recursionAllowed: false,
        originKind: "direct",
        provenance: { kind: "botlg_perfect_equilibrium" },
        resolve: () => ({ damage: { min: 100, max: 100, expected: 100 } }),
      },
      { min: 100, max: 100, expected: 100 },
      "botlg",
    );
    expect(rt.state.target.blackStone?.reducedRating).toBe(9);
  });
});

describe("ammunition profile packing Manual / Revolution / identity", () => {
  it("carries one compact profile through the resolved model and worker wire", () => {
    const ammunition = testRangedAmmunition("splintering");
    const model = buildResolvedCombatModel(hostScaffold({ ammunition, caroming: 3 }));
    expect(model.ammunition).toEqual(ammunition);
    const wire = projectSerializableSimBase(model);
    expect(wire.ammunition).toEqual(ammunition);
    expect(wire.caromingRank).toBe(3);
  });

  it("carries the resolved target accuracy profile through model and worker wire", () => {
    const targetAccuracyProfile = {
      playerAccuracyRating: 1234,
      originalTargetArmourRating: 987,
      affinity: 90,
      additiveHitChance: 0.02,
      damagePotentialOverride: 0.42,
    };
    const model = buildResolvedCombatModel(hostScaffold({ targetAccuracyProfile }));
    expect(model.targetAccuracyProfile).toEqual(targetAccuracyProfile);
    expect(projectSerializableSimBase(model).targetAccuracyProfile).toEqual(targetAccuracyProfile);
  });

  it("changes solver identity when resolved projectile facts change", () => {
    const base = projectSerializableSimBase(
      buildResolvedCombatModel(hostScaffold({ ammunition: testRangedAmmunition("splintering") })),
    );
    const changed = {
      ...base,
      ammunition: testRangedAmmunition("deathspore"),
    };
    expect(JSON.stringify(canonicalSimulationIdentity(base))).not.toEqual(
      JSON.stringify(canonicalSimulationIdentity(changed)),
    );
  });

  it("Manual and Revolution consume the same resolved profile", () => {
    const model = buildResolvedCombatModel(
      hostScaffold({ ammunition: testRangedAmmunition("deathspore"), caroming: 2 }),
    );
    const byId = new Map(RANGED_ABILITIES.map((a) => [a.id, a]));
    const catalogue = {
      catalogue: RANGED_ABILITIES,
      byId,
      basicByStyle: new Map([["ranged" as const, RANGED_ABILITIES[0]!]]),
      abilityRegistry: {
        byId,
        basicByStyle: new Map([["ranged" as const, RANGED_ABILITIES[0]!]]),
      },
    };
    const base = buildSimulationInputBase(model, catalogue as never);
    const manual = toManualSimulateInput(base, { rotation: rotationOf("ranged_attack") });
    const revo = toRevolutionInput(base, {
      bar: [byId.get("ranged_attack")!],
      style: "ranged",
      durationTicks: 30,
    });
    expect(manual.ammunition).toEqual(revo.ammunition);
    expect(simulate(manual).events.some((e) => e.abilityId === "ranged_attack")).toBe(true);
    expect(simulateRevolution(revo).events.some((e) => e.abilityId === "ranged_attack")).toBe(true);
  });
});
