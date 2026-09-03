import { describe, expect, it } from "vitest";
import { projectSerializableSimBase } from "@/combat/model";
import { canonicalSimulationIdentity } from "@/combat/solver";
import { DEFAULT_LOADOUT, normalizeLoadout } from "./loadout/model";
import { loadoutWeaponConfig } from "./loadout/weaponConfiguration";
import { solverSnapshotFromResolvedModel } from "./solverSnapshot";
import { toResolvedCombatModel } from "./toResolvedCombatModel";

describe("Magic combat spell loadout", () => {
  it("normalizes stored spell choices and keeps legacy saves on manual tier", () => {
    expect(normalizeLoadout({}).magicSpell).toBe("none");
    expect(normalizeLoadout({ magicSpell: "exsanguinate" }).magicSpell).toBe("exsanguinate");
    expect(normalizeLoadout({ magicSpell: "incite-fear" }).magicSpell).toBe("incite-fear");
    expect(normalizeLoadout({ magicSpell: "invented" }).magicSpell).toBe("none");
  });

  it("uses tier 100 for both Senntisten spells and the configured tier for manual", () => {
    const manual = normalizeLoadout({
      ...DEFAULT_LOADOUT,
      style: "magic",
      spellTier: 87,
      magicSpell: "none",
    });
    expect(loadoutWeaponConfig(manual)).toMatchObject({ spellTier: 87 });
    expect(loadoutWeaponConfig({ ...manual, magicSpell: "exsanguinate" })).toMatchObject({
      spellTier: 100,
    });
    expect(loadoutWeaponConfig({ ...manual, magicSpell: "incite-fear" })).toMatchObject({
      spellTier: 100,
    });
  });

  it("preserves the choice through model, solver snapshot, wire payload, and identity", () => {
    const exsanguinate = toResolvedCombatModel(
      normalizeLoadout({ ...DEFAULT_LOADOUT, style: "magic", magicSpell: "exsanguinate" }),
    );
    const inciteFear = toResolvedCombatModel(
      normalizeLoadout({ ...DEFAULT_LOADOUT, style: "magic", magicSpell: "incite-fear" }),
    );

    expect(exsanguinate.magicSpell).toBe("exsanguinate");
    expect(solverSnapshotFromResolvedModel(exsanguinate).magicSpell).toBe("exsanguinate");
    const exsanguinateWire = projectSerializableSimBase(exsanguinate);
    const inciteFearWire = projectSerializableSimBase(inciteFear);
    expect(exsanguinateWire.magicSpell).toBe("exsanguinate");
    expect(inciteFearWire.magicSpell).toBe("incite-fear");
    expect(canonicalSimulationIdentity(exsanguinateWire)).not.toEqual(
      canonicalSimulationIdentity(inciteFearWire),
    );
  });
});
