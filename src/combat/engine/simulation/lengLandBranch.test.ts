import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { baseInput } from "../../test/fixtures/inputs";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { expectedStacksFromAtoms } from "../../styles/melee/primordialIce";
import { createRuntime } from "../runtime/runtime";
import { snapshotRuntime } from "./branchCore";
import type { Branch } from "./branchCore";
import { expandLengOnLand } from "./lengLandBranch";

function runtime() {
  return createRuntime({
    ...baseInput,
    abilities: MELEE_ABILITIES,
    startingAdrenaline: 100,
    equipmentIds: ["item:dark-shard-of-leng", "item:dark-sliver-of-leng"],
    equipmentEffects: activeEquipmentEffects({
      style: "melee",
      equipmentSlots: {
        mainhand: "item:dark-shard-of-leng",
        offhand: "item:dark-sliver-of-leng",
      },
    }),
    weaponConfiguration: "dualwield",
  });
}

describe("Leng land expansion", () => {
  it("updates sparse atoms without residual branch mass", () => {
    const rt = runtime();
    const set = expandLengOnLand({ weight: 1, rt }, 0);
    expect(set.branches).toHaveLength(1);
    expect(set.residualWeight).toBe(0);
    expect(set.exactness).toBe("exact");
    expect(
      expectedStacksFromAtoms(set.branches[0]!.rt.state.melee.primordialIce.atoms),
    ).toBeCloseTo(0.12, 12);
    expect(set.branches[0]!.rt.state.melee.primordialIce.atoms).toHaveLength(4);
  });

  it("keeps stack and Frostblades expiry cohorts coupled through a snapshot", () => {
    const rt = runtime();
    rt.state = {
      ...rt.state,
      melee: {
        ...rt.state.melee,
        primordialIce: {
          atoms: [
            { weight: 0.5, stacks: 2, stacksExpireAtTick: 100, frostbladesExpireAtTick: 140 },
            { weight: 0.5, stacks: 2, stacksExpireAtTick: 200, frostbladesExpireAtTick: 240 },
          ],
        },
      },
    };
    const clone = snapshotRuntime(rt);
    expect(clone.state.melee.primordialIce).toEqual(rt.state.melee.primordialIce);
    clone.state = {
      ...clone.state,
      melee: {
        ...clone.state.melee,
        primordialIce: {
          atoms: clone.state.melee.primordialIce.atoms.map((atom, index) =>
            index === 0 ? { ...atom, stacksExpireAtTick: 1 } : atom,
          ),
        },
      },
    };
    expect(rt.state.melee.primordialIce.atoms[0]!.stacksExpireAtTick).toBe(100);
  });

  it("preserves all atom fields in the branch payload", () => {
    const rt = runtime();
    const branch: Branch = { weight: 0.25, rt };
    const set = expandLengOnLand(branch, 7);
    expect(set.branches[0]!.weight).toBe(0.25);
    expect(
      set.branches[0]!.rt.state.melee.primordialIce.atoms.every((atom) =>
        Number.isInteger(atom.stacks),
      ),
    ).toBe(true);
    expect(
      set.branches[0]!.rt.state.melee.primordialIce.atoms.reduce(
        (sum, atom) => sum + atom.weight,
        0,
      ),
    ).toBeCloseTo(1, 12);
  });
});
