import { describe, expect, it } from "vitest";
import type { ActiveEquipmentEffects } from "../../shared/equipment";
import { activeEquipmentEffects } from "../../shared/equipment";
import { createRuntime } from "../runtime/runtime";
import { performCast } from "../cast";
import { RANGED_ABILITIES } from "../../styles/ranged/abilities";
import { simulateRevolution } from "./revolution";

function botlgEffects(): ActiveEquipmentEffects {
  const base = activeEquipmentEffects({ style: "ranged" });
  return {
    ...base,
    passiveIds: ["perfect-equilibrium"],
    weaponClass: "bow",
    activeWeapon: {
      id: "item:bow-of-the-last-guardian",
      slot: "twohand",
      style: "ranged",
      specialAttackId: "balance_by_force",
      passiveIds: ["perfect-equilibrium"],
    },
  };
}

function revolutionInput(overrides: Record<string, unknown> = {}) {
  return {
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    abilities: RANGED_ABILITIES,
    bar: [RANGED_ABILITIES.find((ability) => ability.id === "ranged_attack")!],
    style: "ranged" as const,
    durationTicks: 120,
    startingAdrenaline: 100,
    weaponConfiguration: "twohand" as const,
    equipmentEffects: botlgEffects(),
    ...overrides,
  };
}

describe("BotLG native special policy", () => {
  it("uses a generic 50-tick minimum and recasts after the Balance window expires", () => {
    const summary = simulateRevolution({
      ...revolutionInput(),
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });
    const casts = summary.casts.filter((cast) => cast.abilityId === "balance_by_force");
    const ticks = casts.map((cast) => cast.tick);

    expect(summary.ok).toBe(true);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    expect(ticks[0]).toBe(0);
    expect(ticks.every((tick, index) => index === 0 || tick - ticks[index - 1]! >= 50)).toBe(true);
    expect(ticks).toEqual([0, 51, 102]);
  });

  it("does not use the native special when the policy is off", () => {
    const summary = simulateRevolution({
      ...revolutionInput(),
      nativeSpecialPolicy: { useEquippedWeaponSpecial: false },
    });

    expect(summary.ok).toBe(true);
    expect(summary.casts.some((cast) => cast.abilityId === "balance_by_force")).toBe(false);
  });

  it("allows a manual Balance cast to refresh the active window before expiry", () => {
    const input = revolutionInput({ horizonTicks: 60 });
    const rt = createRuntime(input, { laneIndex: 0, laneCount: 1, seed: 1 });
    const balance = RANGED_ABILITIES.find((ability) => ability.id === "balance_by_force")!;

    expect(performCast(rt, balance, 0, false).ok).toBe(true);
    expect(performCast(rt, balance, rt.state.tick, false).ok).toBe(true);
    expect(rt.state.ranged.balanceByForce.expiresAtTick).toBe(53);
  });
});
