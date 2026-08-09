import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { songOfDestructionSummary } from "../../styles/magic/songOfDestruction";
import { simulateRevolution } from "../simulation/revolution";
import { createRuntime } from "./runtime";

const magicBase = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MAGIC_ABILITIES,
  context: { style: "magic" as const },
  startingAdrenaline: 100,
  weaponConfiguration: "twohand" as const,
};

function staffWithEofEffects() {
  return activeEquipmentEffects({
    style: "magic",
    equipmentSlots: {
      twohand: "item:staff-of-light",
      amulet: "item:essence-of-finality",
    },
  });
}

function fsoaWithEofEffects() {
  return activeEquipmentEffects({
    style: "magic",
    equipmentSlots: {
      twohand: "item:fractured-staff-of-armadyl",
      amulet: "item:essence-of-finality",
    },
  });
}

describe("createRuntime nativeSpecial resolution", () => {
  it("uses EoF stored special when policy is on and the equipped weapon has no special", () => {
    const effects = staffWithEofEffects();
    expect(effects.activeWeapon?.specialAttackId).toBeNull();

    const rt = createRuntime({
      ...magicBase,
      equipmentIds: ["item:staff-of-light", "item:essence-of-finality"],
      equipmentEffects: {
        ...effects,
        songOfDestruction: songOfDestructionSummary(2),
      },
      eofStoredSpecialId: "soulfire",
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });

    expect(rt.nativeSpecial?.id).toBe("soulfire");
  });

  it("lists weapon special first and distinct EoF store second when both are set", () => {
    const effects = fsoaWithEofEffects();
    expect(effects.activeWeapon?.specialAttackId).toBe("instability");

    const rt = createRuntime({
      ...magicBase,
      equipmentIds: ["item:fractured-staff-of-armadyl", "item:essence-of-finality"],
      equipmentEffects: effects,
      eofStoredSpecialId: "soulfire",
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });

    expect(rt.nativeSpecial?.id).toBe("instability");
    expect(rt.nativeSpecials.map((spec) => spec.id)).toEqual(["instability", "soulfire"]);
  });

  it("resolves null when the policy is off even with an EoF store set", () => {
    const effects = staffWithEofEffects();

    const rt = createRuntime({
      ...magicBase,
      equipmentIds: ["item:staff-of-light", "item:essence-of-finality"],
      equipmentEffects: effects,
      eofStoredSpecialId: "soulfire",
      nativeSpecialPolicy: { useEquippedWeaponSpecial: false },
    });

    expect(rt.nativeSpecial).toBeNull();
  });

  it("also omits nativeSpecial when the policy is absent with an EoF store set", () => {
    const rt = createRuntime({
      ...magicBase,
      equipmentIds: ["item:staff-of-light", "item:essence-of-finality"],
      equipmentEffects: staffWithEofEffects(),
      eofStoredSpecialId: "soulfire",
    });

    expect(rt.nativeSpecial).toBeNull();
  });
});

describe("Revolution EoF native special path", () => {
  it("auto-casts Soulfire from EoF store when policy is on and weapon has no special", () => {
    const effects = {
      ...staffWithEofEffects(),
      songOfDestruction: songOfDestructionSummary(2),
    };
    const summary = simulateRevolution({
      ...magicBase,
      bar: [MAGIC_ABILITIES.find((ability) => ability.id === "magic_attack")!],
      style: "magic",
      durationTicks: 30,
      equipmentIds: ["item:staff-of-light", "item:essence-of-finality"],
      equipmentEffects: effects,
      eofStoredSpecialId: "soulfire",
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });

    expect(summary.ok).toBe(true);
    expect(summary.casts[0]).toMatchObject({ abilityId: "soulfire", tick: 0 });
    expect(summary.casts.some((cast) => cast.abilityId === "magic_attack")).toBe(true);
  });

  it("auto-casts Instability from EoF store without FSoA when policy is on", () => {
    const summary = simulateRevolution({
      ...magicBase,
      bar: [MAGIC_ABILITIES.find((ability) => ability.id === "magic_attack")!],
      style: "magic",
      durationTicks: 20,
      equipmentIds: ["item:staff-of-light", "item:essence-of-finality"],
      equipmentEffects: staffWithEofEffects(),
      eofStoredSpecialId: "instability",
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });

    expect(summary.ok).toBe(true);
    expect(summary.casts[0]).toMatchObject({ abilityId: "instability", tick: 0 });
    expect(summary.casts.some((cast) => cast.abilityId === "magic_attack")).toBe(true);
  });

  it("Roar MH + shield + EoF Instability: Soulfire first, then Instability while Soulfire is on CD", () => {
    const effects = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: {
        mainhand: "item:roar-of-awakening",
        offhand: "item:merciless-kiteshield",
        amulet: "item:essence-of-finality",
      },
    });
    expect(effects.activeWeapon?.specialAttackId).toBe("soulfire");

    const rt = createRuntime({
      ...magicBase,
      weaponConfiguration: "shield",
      equipmentIds: [
        "item:roar-of-awakening",
        "item:merciless-kiteshield",
        "item:essence-of-finality",
      ],
      equipmentEffects: {
        ...effects,
        songOfDestruction: songOfDestructionSummary(1),
      },
      eofStoredSpecialId: "instability",
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });
    expect(rt.nativeSpecials.map((spec) => spec.id)).toEqual(["soulfire", "instability"]);

    const summary = simulateRevolution({
      ...magicBase,
      weaponConfiguration: "shield",
      bar: [MAGIC_ABILITIES.find((ability) => ability.id === "magic_attack")!],
      style: "magic",
      durationTicks: 40,
      startingAdrenaline: 100,
      equipmentIds: [
        "item:roar-of-awakening",
        "item:merciless-kiteshield",
        "item:essence-of-finality",
      ],
      equipmentEffects: {
        ...effects,
        songOfDestruction: songOfDestructionSummary(1),
      },
      eofStoredSpecialId: "instability",
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });

    expect(summary.ok).toBe(true);
    const specialIds = summary.casts
      .filter((cast) => cast.abilityId === "soulfire" || cast.abilityId === "instability")
      .map((cast) => cast.abilityId);
    expect(specialIds[0]).toBe("soulfire");
    expect(specialIds).toContain("instability");
    const soulfireTick = summary.casts.find((cast) => cast.abilityId === "soulfire")!.tick;
    const instabilityTick = summary.casts.find((cast) => cast.abilityId === "instability")!.tick;
    expect(instabilityTick).toBeGreaterThan(soulfireTick);
  });
});
