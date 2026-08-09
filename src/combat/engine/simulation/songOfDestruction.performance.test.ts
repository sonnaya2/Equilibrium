import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import { activeEquipmentEffects } from "../../shared/equipment";
import { songOfDestructionSummary } from "../../styles/magic/songOfDestruction";
import { simulate } from "./simulate";
import { simulateRevolution } from "./revolution";
import { stochasticLaneCount } from "../runtime/stochastic";
import { magicInput } from "../../test/fixtures/inputs";

function repeated(abilityId: string, count: number): { abilityId: string }[] {
  return Array.from({ length: count }, () => ({ abilityId }));
}

function timedCase(
  name: string,
  input: Parameters<typeof simulate>[0],
): { name: string; laneCount: number; wallMs: number; ok: boolean } {
  const laneCount = stochasticLaneCount(
    input,
    input.rotation.map(({ abilityId }) => abilityId),
  );
  const started = performance.now();
  const result = simulate(input, { detailLevel: "score-only", stochasticSeed: 19 });
  return {
    name,
    laneCount,
    wallMs: Math.round((performance.now() - started) * 1000) / 1000,
    ok: result.ok,
  };
}

function timedRevolutionCase(
  name: string,
  input: Parameters<typeof simulateRevolution>[0],
): { name: string; laneCount: number; wallMs: number; ok: boolean } {
  const laneCount = stochasticLaneCount(input, [
    ...input.bar.map(({ id }) => id),
    ...(input.equipmentEffects?.activeWeapon?.specialAttackId
      ? [input.equipmentEffects.activeWeapon.specialAttackId]
      : []),
  ]);
  const started = performance.now();
  const result = simulateRevolution(input, { detailLevel: "score-only", stochasticSeed: 19 });
  return {
    name,
    laneCount,
    wallMs: Math.round((performance.now() - started) * 1000) / 1000,
    ok: result.ok,
  };
}

describe("Song performance samples", () => {
  it("measures the no-Song, piece, stack, and Soulfire paths", () => {
    const onePiece = {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(1),
    };
    const twoPiece = {
      ...onePiece,
      songOfDestruction: songOfDestructionSummary(2),
    };
    const soulfireEffects = {
      ...twoPiece,
      activeWeapon: {
        id: "item:roar-of-awakening",
        slot: "mainhand" as const,
        style: "magic" as const,
        specialAttackId: "soulfire",
        passiveIds: [],
      },
    };
    const cases = [
      timedCase("no-song", { ...magicInput, rotation: repeated("magic_attack", 24) }),
      timedCase("one-piece", {
        ...magicInput,
        equipmentEffects: onePiece,
        rotation: repeated("combust", 24),
      }),
      timedCase("two-piece", {
        ...magicInput,
        equipmentEffects: twoPiece,
        rotation: repeated("combust", 24),
      }),
      timedCase("high-stacks", {
        ...magicInput,
        equipmentEffects: twoPiece,
        rotation: repeated("combust", 48),
      }),
      timedRevolutionCase("soulfire-heavy", {
        ...magicInput,
        equipmentEffects: soulfireEffects,
        equipmentIds: ["item:roar-of-awakening"],
        weaponConfiguration: "mainhand",
        bar: [MAGIC_ABILITIES.find(({ id }) => id === "magic_attack")!],
        style: "magic",
        durationTicks: 180,
        nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
      }),
    ];
    console.info("Song performance samples", cases);
    expect(cases.every(({ ok }) => ok)).toBe(true);
    expect(cases[0]?.laneCount).toBe(1);
    expect(cases.slice(1).every(({ laneCount }) => laneCount === 128)).toBe(true);
  });
});
