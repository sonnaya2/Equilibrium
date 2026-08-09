import { describe, expect, it } from "vitest";
import {
  emptyModifierSources,
  defaultSerializableRequest,
  type SerializableRevolutionSimBase,
} from "./worker/serializable";
import { reviveRevolutionBase } from "./worker/revive";
import { fingerprintSolveContext } from "./solutionStore";
import { activeEquipmentEffects } from "../shared/equipment";
import { songOfDestructionSummary } from "../styles/magic/songOfDestruction";

function songSim(pieceCount: number): SerializableRevolutionSimBase {
  return {
    base: 1000,
    level: 99,
    accuracy: 1,
    crit: { chance: 0 },
    equipmentEffects: {
      ...activeEquipmentEffects({ style: "magic" }),
      songOfDestruction: songOfDestructionSummary(pieceCount),
    },
    league: {
      ruleset: "base",
      blessings: [],
      blessingIds: [],
      totalArmour: 0,
      maximumLife: 10_000,
      powerburstUntilTick: 0,
      targetSize: 1,
      occupiedTiles: 1,
    },
    context: { style: "magic", ruleset: "base", targetSize: 1, occupiedTiles: 1 },
    equipmentIds: ["item:roar-of-awakening", "item:ode-to-deceit"],
    weaponConfiguration: "dualwield",
    modifierSources: emptyModifierSources(),
  };
}

describe("Song serialization and solver identity", () => {
  it("preserves the nested equipment summary through worker revival", () => {
    const sim = songSim(2);
    const revived = reviveRevolutionBase(structuredClone(sim));
    expect(revived.equipmentEffects?.songOfDestruction).toEqual(
      sim.equipmentEffects.songOfDestruction,
    );
  });

  it("includes Song equipment in the canonical solver fingerprint", async () => {
    const onePiece = defaultSerializableRequest({
      style: "magic",
      durationTicks: 50,
      loadout: songSim(1),
    });
    const twoPiece = {
      ...onePiece,
      loadout: songSim(2),
    };
    expect(await fingerprintSolveContext(onePiece)).not.toBe(
      await fingerprintSolveContext(twoPiece),
    );
  });
});
