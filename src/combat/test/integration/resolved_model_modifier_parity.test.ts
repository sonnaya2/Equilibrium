/**
 * old castModifiersFor(ability) vs modifiersForResolvedModel(model, ability)
 */
import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import type { CombatModifier } from "../../types";
import { modifiersForResolvedModel } from "../../model";
import { BERSERKERS_FURY_ID } from "../../shared/berserkersFury";
import { FULL_SLAYER_HELMET_ITEM_ID } from "../../shared/slayerHelmet";
import { SALVE_AMULET_E_ITEM_ID } from "../../shared/salveAmulet";
import {
  DEFAULT_LOADOUT,
  normalizeLoadout,
  type Loadout,
} from "../../../components/combat/loadout/model";
import { loadoutStats } from "../../../components/combat/loadoutStats";
import { toResolvedCombatModel } from "../../../components/combat/toResolvedCombatModel";

function withLoadout(patch: Partial<Loadout>): Loadout {
  return normalizeLoadout({
    ...DEFAULT_LOADOUT,
    ...patch,
    buffs: { ...DEFAULT_LOADOUT.buffs, ...patch.buffs },
    perks: { ...DEFAULT_LOADOUT.perks, ...patch.perks },
    archaeology: patch.archaeology
      ? { ...DEFAULT_LOADOUT.archaeology, ...patch.archaeology }
      : DEFAULT_LOADOUT.archaeology,
    equipmentSlots: { ...DEFAULT_LOADOUT.equipmentSlots, ...patch.equipmentSlots },
    target:
      patch.target === undefined
        ? DEFAULT_LOADOUT.target
        : patch.target === null
          ? null
          : {
              ...patch.target,
              defenceLevel: patch.target.defenceLevel ?? 80,
              affinity: patch.target.affinity ?? "same",
            },
  });
}

function modKeys(mods: CombatModifier[]) {
  return mods.map((m) => ({ id: m.id, stage: m.stage, priority: m.priority }));
}

function expectParity(loadout: Loadout, abilityId: string, options = {}) {
  const ability = MELEE_ABILITIES.find((a) => a.id === abilityId)!;
  expect(ability).toBeDefined();
  const stats = loadoutStats(loadout, options);
  const model = toResolvedCombatModel(loadout, options);
  expect(modKeys(modifiersForResolvedModel(model, ability))).toEqual(
    modKeys(stats.castModifiersFor(ability)),
  );
}

describe("castModifiersFor vs modifiersForResolvedModel parity", () => {
  it("matches on default melee loadout (global-only basic)", () => {
    expectParity(withLoadout({}), "attack");
  });

  it("matches Ultimatums on ultimate and Lunging on dismember", () => {
    const loadout = withLoadout({
      perks: { ...DEFAULT_LOADOUT.perks, ultimatums: 4, lunging: 4 },
    });
    expectParity(loadout, "overpower");
    expectParity(loadout, "dismember");
    expectParity(loadout, "attack");
  });

  it("matches Slayer Helmet on-task melee", () => {
    const loadout = withLoadout({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
    });
    expectParity(loadout, "assault");
  });

  it("matches Salve (e) + undead target", () => {
    const loadout = withLoadout({
      equipmentSlots: { amulet: SALVE_AMULET_E_ITEM_ID },
      target: { defenceLevel: 80, affinity: "same", undead: true },
    });
    expectParity(loadout, "assault");
  });

  it("matches Berserker's Fury archaeology selection", () => {
    const loadout = withLoadout({
      archaeology: {
        ...DEFAULT_LOADOUT.archaeology,
        selectedIds: [BERSERKERS_FURY_ID],
        energyCap: 500,
      },
      currentHealthPercent: 20,
    });
    expectParity(loadout, "assault");
  });

  it("matches vulnerability + style curse", () => {
    const loadout = withLoadout({
      buffs: {
        ...DEFAULT_LOADOUT.buffs,
        vulnerability: true,
        styleCurse: "turmoil",
      },
    });
    expectParity(loadout, "assault");
  });

  it("matches race slayer perks + target flags", () => {
    const loadout = withLoadout({
      perks: {
        ...DEFAULT_LOADOUT.perks,
        demonSlayer: 1,
        dragonSlayer: 1,
        undeadSlayer: 1,
      },
      target: {
        defenceLevel: 80,
        affinity: "same",
        demon: true,
        dragon: true,
        undead: true,
      },
    });
    expectParity(loadout, "assault");
  });

  it("matches hit-cap disabled loadout modifiers (same mods; cap is separate)", () => {
    const loadout = withLoadout({ hitCapEnabled: false });
    expectParity(loadout, "assault");
    const model = toResolvedCombatModel(loadout);
    expect(model.cap.bypass).toBe(true);
  });
});
