import { describe, expect, it } from "vitest";
import type { ActiveEquipmentEffects } from "../../shared/equipment";
import type { CombatModifier } from "../../types";
import { calculateHit } from "../../pipeline/calculateHit";
import { resolveLeagueAttachedHost } from "../../league/damage";
import { resolveLeagueRules } from "../../league/ruleset";
import { activeEquipmentEffects } from "../../shared/equipment";
import { resolveAbilityCastAvailability } from "../../shared/requirements";
import { allEngineSpecs, solverPalette } from "../../abilities/registry";
import { MELEE_ABILITIES } from "./abilities";
import { IGNEOUS_SHOWDOWN_PRIMARY_BAND, IGNEOUS_SHOWDOWN_REPEAT_BAND } from "./ekZekKil";
import { baseInput } from "../../test/fixtures/inputs";
import { createRuntime } from "../../engine/runtime/runtime";
import { commitCast } from "../../engine/cast";
import { prepareCast } from "../../engine/cast/prepare";
import { simulate } from "../../engine/simulation/simulate";
import { simulateRevolution } from "../../engine/simulation/revolution";
import { rotationOf } from "../../engine/simulation/contracts";

const SHOWDOWN_ID = "igneous_showdown";
const Eof = "item:essence-of-finality";

function weaponEffects(input: {
  specialAttackId: string | null;
  passiveIds: ActiveEquipmentEffects["passiveIds"];
}): ActiveEquipmentEffects {
  const base = activeEquipmentEffects({
    style: "melee",
    equipmentSlots: { twohand: "item:masterwork-2h-sword" },
  });
  return {
    ...base,
    passiveIds: [...new Set([...base.passiveIds, ...input.passiveIds])],
    activeWeapon: {
      id: input.specialAttackId === SHOWDOWN_ID ? "item:ek-zekkil" : "item:masterwork-2h-sword",
      slot: "twohand",
      style: "melee",
      specialAttackId: input.specialAttackId,
      passiveIds: input.passiveIds,
    },
  };
}

const swordEffects = weaponEffects({ specialAttackId: SHOWDOWN_ID, passiveIds: ["ashen-vow"] });
const otherWeaponEffects = weaponEffects({ specialAttackId: null, passiveIds: [] });

function showdown() {
  const ability = MELEE_ABILITIES.find((candidate) => candidate.id === SHOWDOWN_ID);
  if (!ability) throw new Error("Igneous Showdown is not registered");
  return ability;
}

function physicalInput(overrides: Record<string, unknown> = {}) {
  return {
    ...baseInput,
    abilities: MELEE_ABILITIES,
    context: { style: "melee" as const },
    weaponConfiguration: "twohand" as const,
    equipmentIds: ["item:ek-zekkil"],
    equipmentEffects: swordEffects,
    crit: { chance: 0, guaranteed: true },
    startingAdrenaline: 100,
    ...overrides,
  };
}

function expected(
  band: { minPct: number; maxPct: number },
  modifier?: CombatModifier,
  eligible = true,
) {
  return calculateHit({
    base: 1000,
    band,
    level: 99,
    accuracy: 1,
    crit: { chance: 0, guaranteed: true, eligible },
    ...(modifier ? { modifiers: [modifier] } : {}),
    context: { style: "melee", provenance: { kind: "player_direct" } },
    provenance: { kind: "player_direct" },
  });
}

function literalAshenVow(): CombatModifier {
  return {
    id: "test:ashen-vow",
    stage: "ability",
    priority: 0,
    abilityBaseMultiplier: 1.12,
    applies: () => true,
    apply: (state) => state,
    source: {
      source: "derived",
      url: "https://example.invalid/ashen-vow",
      verifiedAt: "2026-08-08",
    },
  };
}

describe("Ek-ZekKil native special and Flamebound Rival", () => {
  it("uses active native capability, keeps EoF access separate, and stays out of the solver bar", () => {
    const ability = showdown();
    const canonicalSwordEffects = activeEquipmentEffects({
      style: "melee",
      equipmentSlots: { twohand: "item:ek-zekkil" },
    });
    const activeWeapon = canonicalSwordEffects.activeWeapon;
    expect(activeWeapon).toBeDefined();
    if (!activeWeapon) throw new Error("expected Ek-ZekKil active weapon");

    expect(activeWeapon.specialAttackId).toBe("igneous_showdown");
    expect(activeWeapon.passiveIds).toContain("ashen-vow");

    expect(ability.adrenaline?.cost).toBe(50);
    expect(ability.cooldownSeconds).toBe(60);
    expect(
      resolveAbilityCastAvailability(ability, {
        weaponConfiguration: "twohand",
        activeWeapon: { specialAttackId: SHOWDOWN_ID },
      }).available,
    ).toBe(true);
    expect(
      resolveAbilityCastAvailability(ability, {
        weaponConfiguration: "twohand",
        equipmentIds: ["item:ek-zekkil"],
        activeWeapon: { specialAttackId: null },
      }).available,
    ).toBe(false);
    // EoF alone is fail-closed; matching stored special unlocks.
    expect(
      resolveAbilityCastAvailability(ability, {
        weaponConfiguration: "twohand",
        equipmentIds: [Eof],
        activeWeapon: { specialAttackId: null },
      }).available,
    ).toBe(false);
    expect(
      resolveAbilityCastAvailability(ability, {
        weaponConfiguration: "twohand",
        equipmentIds: [Eof],
        activeWeapon: { specialAttackId: null },
        eofStoredSpecialId: SHOWDOWN_ID,
      }).available,
    ).toBe(true);
    expect(allEngineSpecs().some((candidate) => candidate.id === SHOWDOWN_ID)).toBe(true);
    expect(solverPalette("melee").some((candidate) => candidate.id === SHOWDOWN_ID)).toBe(false);
  });

  it("designates before the first physical hit, then repeats with four same-tick hits", () => {
    const rt = createRuntime(
      physicalInput({
        naturalInstinctUntilTick: 100,
        adrenaline: { ringOfVigour: true },
      }),
    );
    const ability = showdown();
    const first = prepareCast(rt, ability, 0);
    expect(first.working.hits).toHaveLength(1);
    expect(first.working.hits[0]!.band).toEqual(IGNEOUS_SHOWDOWN_PRIMARY_BAND);
    expect(first.cost).toBe(45);
    expect(first.spend).toBe(45);
    commitCast(rt, first, false);
    expect(rt.casts[0]!.adrenalineTransaction?.specialRefund).toBe(0);
    expect(rt.casts[0]!.refund).toBe(0);

    const firstEvent = rt.events.find((event) => event.abilityId === SHOWDOWN_ID);
    expect(firstEvent?.damage.expected).toBeCloseTo(
      expected(IGNEOUS_SHOWDOWN_PRIMARY_BAND, literalAshenVow()).expected,
      10,
    );
    expect(rt.state.target.melee.flameboundRival).toBe(true);

    const ordinaryAttack = MELEE_ABILITIES.find((candidate) => candidate.id === "attack");
    if (!ordinaryAttack) throw new Error("Melee attack is not registered");
    const ordinary = createRuntime(physicalInput());
    const ordinaryShowdown = prepareCast(ordinary, ability, 0);
    commitCast(ordinary, ordinaryShowdown, false);
    const preparedAttack = prepareCast(ordinary, ordinaryAttack, ordinary.state.tick);
    expect(preparedAttack.specialRefund).toBe(0);
    commitCast(ordinary, preparedAttack, false);
    const ordinaryRecord = ordinary.casts.find((cast) => cast.abilityId === "attack")!;
    expect(ordinaryRecord.adrenalineTransaction?.specialRefund).toBe(0);
    expect(ordinaryRecord.adrenalineGained).toBe(9);
    expect(ordinaryRecord.adrenalineAfter).toBe(59);

    rt.state = { ...rt.state, adrenaline: 100, cooldowns: {} };
    const repeat = prepareCast(rt, ability, rt.state.tick);
    expect(repeat.snap.igneousShowdownRepeat).toBe(true);
    expect(repeat.working.hits).toHaveLength(4);
    expect(repeat.working.hits.slice(1).every((hit) => hit.band.minPct === 245)).toBe(true);
    expect(repeat.specialRefund).toBe(30);
    commitCast(rt, repeat, false);

    const repeatEvents = rt.events.filter((event) => event.abilityId === SHOWDOWN_ID).slice(1);
    expect(repeatEvents).toHaveLength(4);
    expect(new Set(repeatEvents.map((event) => event.tick)).size).toBe(1);
    expect(repeatEvents.map((event) => event.hitIndex)).toEqual([0, 1, 2, 3]);
    expect(repeatEvents[0]!.damage.expected).toBeCloseTo(
      expected(IGNEOUS_SHOWDOWN_PRIMARY_BAND, literalAshenVow()).expected,
      10,
    );
    expect(repeatEvents[1]!.damage.expected).toBeCloseTo(
      expected(IGNEOUS_SHOWDOWN_REPEAT_BAND, literalAshenVow()).expected,
      10,
    );
    expect(rt.casts[1]!.adrenalineTransaction?.specialRefund).toBe(30);
    expect(rt.casts[1]!.adrenalineTransaction?.ringOfVigourRefund).toBe(0);
    expect(rt.casts[1]!.refund).toBe(0);
    expect(rt.casts[1]!.adrenalineAfter).toBe(85);

    const noNaturalInstinct = createRuntime(
      physicalInput({ adrenaline: { ringOfVigour: true }, naturalInstinctUntilTick: 0 }),
    );
    const noNaturalInstinctFirst = prepareCast(noNaturalInstinct, ability, 0);
    commitCast(noNaturalInstinct, noNaturalInstinctFirst, false);
    noNaturalInstinct.state = {
      ...noNaturalInstinct.state,
      adrenaline: 100,
      cooldowns: {},
      naturalInstinctUntilTick: 0,
    };
    const noNaturalInstinctRepeat = prepareCast(
      noNaturalInstinct,
      ability,
      noNaturalInstinct.state.tick,
    );
    expect(noNaturalInstinctRepeat.cost).toBe(45);
    expect(noNaturalInstinctRepeat.specialRefund).toBe(15);
  });

  it("keeps EoF Showdown as the initial one-hit behavior without physical passive or refund", () => {
    const result = simulate({
      ...physicalInput({
        equipmentIds: ["item:masterwork-2h-sword", Eof],
        equipmentEffects: otherWeaponEffects,
        startingAdrenaline: 50,
        eofStoredSpecialId: SHOWDOWN_ID,
      }),
      rotation: rotationOf(SHOWDOWN_ID),
    });
    expect(result.ok).toBe(true);
    const event = result.events.find((candidate) => candidate.abilityId === SHOWDOWN_ID)!;
    expect(event.castSnap?.ashenVowAtCast).toBe(false);
    expect(event.damage.expected).toBeCloseTo(expected(IGNEOUS_SHOWDOWN_PRIMARY_BAND).expected, 10);
    expect(result.casts[0]!.adrenalineTransaction?.specialRefund).toBe(0);
    expect(result.casts[0]!.result.hits).toHaveLength(1);
  });

  it("applies Ashen Vow to direct host damage, excludes bleeds, and leaves attached terms unboosted", () => {
    const direct = simulate({
      ...physicalInput(),
      rotation: rotationOf(SHOWDOWN_ID, "attack"),
    });
    const bleed = simulate({
      ...physicalInput(),
      rotation: rotationOf(SHOWDOWN_ID, "dismember"),
    });
    expect(direct.ok && bleed.ok).toBe(true);
    const directEvent = direct.events.find((event) => event.abilityId === "attack")!;
    const bleedEvent = bleed.events.find((event) => event.abilityId === "dismember")!;
    expect(directEvent.damage.expected).toBeCloseTo(
      expected({ minPct: 110, maxPct: 130 }, literalAshenVow()).expected,
      10,
    );
    expect(bleedEvent.damage.expected).toBeCloseTo(
      expected({ minPct: 25, maxPct: 35 }, undefined, false).expected,
      10,
    );

    const unrelated = simulate({
      ...physicalInput({
        equipmentIds: ["item:masterwork-2h-sword", Eof],
        equipmentEffects: otherWeaponEffects,
        eofStoredSpecialId: SHOWDOWN_ID,
      }),
      rotation: rotationOf(SHOWDOWN_ID, "attack"),
    });
    const unrelatedAttack = unrelated.events.find((event) => event.abilityId === "attack")!;
    expect(unrelatedAttack.damage.expected).toBeCloseTo(
      expected({ minPct: 110, maxPct: 130 }).expected,
      10,
    );

    const massacre = simulate({
      ...physicalInput(),
      rotation: rotationOf(SHOWDOWN_ID, "dismember", "slaughter", "massacre"),
    });
    const massacreEvents = massacre.events.filter((event) => event.abilityId === "massacre");
    expect(massacreEvents[0]!.damage.expected).toBeCloseTo(
      expected({ minPct: 110, maxPct: 130 }, literalAshenVow()).expected,
      10,
    );
    expect(
      massacreEvents
        .slice(1)
        .every(
          (event) =>
            Math.abs(
              event.damage.expected -
                expected({ minPct: 100, maxPct: 100 }, undefined, false).expected,
            ) < 1e-10,
        ),
    ).toBe(true);

    const capped = createRuntime(physicalInput({ cap: { cap: 300 } }));
    const cappedFirst = prepareCast(capped, showdown(), 0);
    commitCast(capped, cappedFirst, false);
    capped.state = { ...capped.state, adrenaline: 100, cooldowns: {} };
    const cappedRepeat = prepareCast(capped, showdown(), capped.state.tick);
    commitCast(capped, cappedRepeat, false);
    const cappedEvents = capped.events.filter((event) => event.abilityId === SHOWDOWN_ID).slice(1);
    expect(cappedEvents).toHaveLength(4);
    expect(cappedEvents.map((event) => event.damage.expected)).toEqual([300, 300, 300, 300]);
    expect(cappedEvents.every((event) => (event.damage.capLoss ?? 0) > 0)).toBe(true);

    const rules = resolveLeagueRules(
      { ruleset: "equilibrium", blessingPicks: ["Chaos", "Chaos"] },
      { maximumLife: 0 },
    );
    const common = {
      rules,
      source: { kind: "player_direct" as const },
      base: 1000,
      band: { minPct: 110, maxPct: 130 },
      level: 99,
      accuracy: 1,
      crit: { chance: 0, guaranteed: true },
      context: { style: "melee" as const, provenance: { kind: "player_direct" as const } },
      cap: { cap: 30_000 },
    };
    const plain = resolveLeagueAttachedHost({ ...common, modifiers: [] });
    const ashen = resolveLeagueAttachedHost({
      ...common,
      modifiers: [literalAshenVow()],
      attachedTermBase: 1000,
    });
    expect(ashen.baseHit.expected).toBeGreaterThan(plain.baseHit.expected);
    expect(ashen.components[0]?.damage.expected).toBe(plain.components[0]?.damage.expected);
  });

  it("injects the native special through the generic Revolution policy and repeats after cooldown", () => {
    const on = simulateRevolution({
      ...physicalInput(),
      bar: [MELEE_ABILITIES.find((ability) => ability.id === "attack")!],
      style: "melee",
      durationTicks: 202,
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });
    const off = simulateRevolution({
      ...physicalInput(),
      bar: [MELEE_ABILITIES.find((ability) => ability.id === "attack")!],
      style: "melee",
      durationTicks: 202,
      nativeSpecialPolicy: { useEquippedWeaponSpecial: false },
    });
    expect(on.ok && off.ok).toBe(true);
    const onSpecials = on.casts.filter((cast) => cast.abilityId === SHOWDOWN_ID);
    expect(onSpecials.map((cast) => cast.result.hits.length)).toEqual([1, 4]);
    expect(onSpecials[1]!.adrenalineTransaction?.specialRefund).toBe(15);
    expect(off.casts.some((cast) => cast.abilityId === SHOWDOWN_ID)).toBe(false);
    expect(on.rng?.lanes ?? 1).toBe(1);
  });
});
