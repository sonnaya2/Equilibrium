import { describe, expect, it } from "vitest";
import { createCastContext, simulate } from "../../engine/simulation/simulate";
import { rotationOf } from "../../engine/simulation/contracts";
import { GLOBAL_COOLDOWN_TICKS } from "../../engine/runtime/timing";
import { rangedInput } from "../../test/fixtures/inputs";
import {
  PUNCTURE_ABILITY_ID,
  PUNCTURE_CAP,
  PUNCTURE_DURATION_TICKS,
  PUNCTURE_FIRST_OFFSET_AFTER_FINISH,
  PUNCTURE_HIT_FRACTIONS,
  PUNCTURE_HIT_INTERVAL_TICKS,
  applyPunctureStack,
  newPuncture,
  punctureHitDamage,
  punctureSequenceTicks,
  punctureStoreAmount,
} from "./puncture";
import { applyCaromingToRicochetHits } from "./caroming";
import { darkfangBasicHits, hasDarkfangWeapon } from "./darkfang";
import { styleAmmoFromEquipmentIds } from "./ammoModel";
import { caromingRicochetBonus } from "../../shared/perks";
import { buildSimulationInputBase, toManualSimulateInput, toRevolutionInput } from "../../model/simulationBase";
import { buildResolvedCombatModel } from "../../model/resolve";
import { projectSerializableSimBase } from "../../model/simulationInput";
import { canonicalSimulationIdentity } from "../../solver/identity";
import { emptyModifierSources } from "../../solver/worker/serializable";
import type { HostCombatResolveInput } from "../../model/contracts";
import { simulateRevolution } from "../../engine/simulation/revolution";
import { RANGED_ABILITIES } from "./abilities";
import { EQUIPMENT_SET_ACTIVATION } from "../../shared/equipment";

const BASE = 1000;

function hostScaffold(
  overrides: Partial<HostCombatResolveInput> = {},
): HostCombatResolveInput {
  return {
    style: "ranged",
    base: BASE,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    equipmentEffects: {
      activation: EQUIPMENT_SET_ACTIVATION,
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
      targetTiles: 1,
    },
    equipmentIds: [],
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
    expect(PUNCTURE_HIT_FRACTIONS).toEqual([0.5, 0.2, 0.15, 0.1, 0.05]);
    expect(punctureHitDamage(1000, 0.5)).toBe(500);
    expect(punctureHitDamage(1000, 0.15)).toBe(150);
  });
});

describe("puncture runtime", () => {
  it("first application schedules 5 hits after ability finish", () => {
    const s = simulate({
      ...rangedInput,
      ammo: "splintering",
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
    const ctx = createCastContext({ ...rangedInput, ammo: "splintering" });
    ctx.performCast(ctx.byId.get("piercing_shot")!, 0, false);
    expect(ctx.getState().ranged.puncture.stacks).toBe(2);
    expect(ctx.getState().ranged.puncture.storedDamage).toBe(20);
  });

  it("stack growth and cap", () => {
    const ctx = createCastContext({ ...rangedInput, ammo: "splintering" });
    const pierce = ctx.byId.get("piercing_shot")!;
    for (let i = 0; i < 30; i++) {
      ctx.performCast(pierce, ctx.getState().tick, false);
    }
    // 30 casts * 2 hits = 60 stacks
    expect(ctx.getState().ranged.puncture.stacks).toBe(60);
    expect(ctx.getState().ranged.puncture.storedDamage).toBe(600);

    const cap = createCastContext({ ...rangedInput, ammo: "splintering" });
    for (let i = 0; i < 130; i++) {
      cap.performCast(pierce, cap.getState().tick, false);
    }
    expect(cap.getState().ranged.puncture.stacks).toBe(PUNCTURE_CAP);
    expect(cap.getState().ranged.puncture.storedDamage).toBe(PUNCTURE_CAP * 10);
  });

  it("refresh during active sequence invalidates prior generation events", () => {
    // Cast A builds puncture; cast B after sequence has started restarts gen.
    const s = simulate({
      ...rangedInput,
      ammo: "splintering",
      // piercing @0, then wait with autos, then piercing again mid-sequence
      rotation: rotationOf(
        "piercing_shot",
        "ranged_attack",
        "ranged_attack",
        "piercing_shot",
      ),
    });
    const positive = s.events.filter(
      (e) => e.abilityId === PUNCTURE_ABILITY_ID && e.damage.expected > 0,
    );
    expect(positive.length).toBe(5);
    const ctx = createCastContext({ ...rangedInput, ammo: "splintering" });
    const pierce = ctx.byId.get("piercing_shot")!;
    const attack = ctx.byId.get("ranged_attack")!;
    ctx.performCast(pierce, 0, false);
    ctx.performCast(attack, ctx.getState().tick, false);
    ctx.performCast(attack, ctx.getState().tick, false);
    ctx.performCast(pierce, ctx.getState().tick, false);
    // Final stacks: 2 + 1 + 1 + 2 = 6
    expect(ctx.getState().ranged.puncture.stacks).toBe(6);
  });

  it("snapshot isolation: stored damage ignores later base changes via fixed base", () => {
    // Engine base is fixed per sim; verify closed-over amount equals store*fraction
    // not recalculated against hit damage.
    const s = simulate({
      ...rangedInput,
      base: 2000,
      ammo: "splintering",
      rotation: rotationOf("ranged_attack"),
    });
    const dots = s.events.filter((e) => e.abilityId === PUNCTURE_ABILITY_ID);
    // 1 stack stores floor(2000*0.01)=20; fractions of 20
    expect(dots.map((e) => e.damage.expected)).toEqual([10, 4, 3, 2, 1]);
  });

  it("puncture cannot recursively apply itself", () => {
    const ctx = createCastContext({ ...rangedInput, ammo: "splintering" });
    ctx.performCast(ctx.byId.get("ranged_attack")!, 0, false);
    // Drain puncture sequence
    ctx.performCast(ctx.byId.get("ranged_attack")!, 40, false);
    // Only stacks from basics (2), not from puncture dots
    expect(ctx.getState().ranged.puncture.stacks).toBe(2);
  });

  it("horizon: puncture tails beyond horizon still schedule but sim ends cleanly", () => {
    const s = simulate(
      {
        ...rangedInput,
        ammo: "splintering",
        rotation: rotationOf("ranged_attack"),
      },
      { includeTails: true },
    );
    expect(s.totalExpected).toBeGreaterThan(0);
    expect(s.events.some((e) => e.abilityId === PUNCTURE_ABILITY_ID)).toBe(true);
  });

  it("expires after duration without reapplication", () => {
    const ctx = createCastContext({ ...rangedInput, ammo: "splintering" });
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
});

describe("deathspore / searing winds / shadow imbued regressions", () => {
  it("deathspore free-cast still works with splintering path unused", () => {
    const rotation = rotationOf(...Array(12).fill("ranged_attack"), "imbue_shadows");
    const s = simulate({ ...rangedInput, ammo: "deathspore", rotation });
    expect(s.casts.some((c) => c.abilityId === "imbue_shadows" && c.actualSpend === 0)).toBe(
      true,
    );
  });

  it("searing winds boosts a follow-up attack", () => {
    const bare = simulate({
      ...rangedInput,
      rotation: rotationOf("ranged_attack"),
    });
    const withSw = simulate({
      ...rangedInput,
      rotation: rotationOf("galeshot", "ranged_attack"),
    });
    const bareHit = bare.events.find((e) => e.abilityId === "ranged_attack" && e.family === "hit");
    const buffed = withSw.events.find((e) => e.abilityId === "ranged_attack" && e.family === "hit");
    expect((buffed?.damage.expected ?? 0)).toBeGreaterThan(bareHit?.damage.expected ?? 0);
  });
});

describe("darkfang basic", () => {
  it("hasDarkfangWeapon detects catalogue ids", () => {
    expect(hasDarkfangWeapon(["item:dark-bow"])).toBe(true);
    expect(hasDarkfangWeapon(["item:gloomfire-bow"])).toBe(true);
    expect(hasDarkfangWeapon(["item:seren-godbow"])).toBe(false);
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

  it("each darkfang hit participates in deathspore stacks", () => {
    const ctx = createCastContext({
      ...rangedInput,
      ammo: "deathspore",
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
  it("scales each ricochet hit band by rank", () => {
    const base = RANGED_ABILITIES.find((a) => a.id === "ricochet")!.hits;
    const r4 = applyCaromingToRicochetHits(base, 4);
    const mult = 1 + caromingRicochetBonus(4);
    expect(mult).toBeCloseTo(1.16);
    expect(r4[0]!.band.minPct).toBeCloseTo(base[0]!.band.minPct * mult);
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
    for (let i = 0; i < 3; i++) {
      expect(perkHits[i]!.damage.expected).toBeCloseTo(
        plainHits[i]!.damage.expected * 1.16,
        5,
      );
    }
  });
});

describe("ammo packing Manual / Revolution / identity", () => {
  it("styleAmmoFromEquipmentIds maps deathspore arrows", () => {
    expect(styleAmmoFromEquipmentIds(["item:deathspore-arrows"])).toBe("deathspore");
    expect(styleAmmoFromEquipmentIds(["item:splintering-arrows"])).toBe("splintering");
  });

  it("resolved model carries ammo and caroming into sim base + identity", () => {
    const model = buildResolvedCombatModel(
      hostScaffold({
        ammo: "splintering",
        caroming: 3,
        equipmentIds: ["item:dark-bow"],
      }),
    );
    expect(model.ammo).toBe("splintering");
    expect(model.caromingRank).toBe(3);

    // Catalogue not required for packing fields
    const wire = projectSerializableSimBase(model);
    expect(wire.ammo).toBe("splintering");
    expect(wire.caromingRank).toBe(3);

    const idA = canonicalSimulationIdentity(wire);
    const idB = canonicalSimulationIdentity({ ...wire, ammo: "deathspore" });
    expect(JSON.stringify(idA)).not.toEqual(JSON.stringify(idB));
    const idC = canonicalSimulationIdentity({ ...wire, caromingRank: 1 });
    expect(JSON.stringify(idA)).not.toEqual(JSON.stringify(idC));
  });

  it("Manual / Revolution both receive packed ammo", () => {
    const model = buildResolvedCombatModel(
      hostScaffold({ ammo: "deathspore", equipmentIds: ["item:deathspore-arrows"] }),
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
    expect(base.ammo).toBe("deathspore");

    const manual = toManualSimulateInput(base, {
      rotation: rotationOf("ranged_attack"),
    });
    const revo = toRevolutionInput(base, {
      bar: [byId.get("ranged_attack")!],
      style: "ranged",
      durationTicks: 30,
    });
    expect(manual.ammo).toBe("deathspore");
    expect(revo.ammo).toBe("deathspore");

    const manSim = simulate(manual);
    const revoSim = simulateRevolution(revo);
    // Same ammo path: both can land ranged basics
    expect(manSim.events.some((e) => e.abilityId === "ranged_attack")).toBe(true);
    expect(revoSim.events.some((e) => e.abilityId === "ranged_attack")).toBe(true);
  });
});
