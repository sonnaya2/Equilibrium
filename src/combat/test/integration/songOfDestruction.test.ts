import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAbilityCatalogue } from "../../abilities/catalogue";
import { simulateRevolution } from "../../engine/simulation/revolution";
import { buildSimulationInputBase, toRevolutionInput } from "../../model";
import { filterAbilitiesForLoadout } from "../../../components/combat/abilityLoadoutFilter";
import { DEFAULT_LOADOUT, type Loadout } from "../../../components/combat/loadout/model";
import { resolveLoadoutCombat } from "../../../components/combat/toResolvedCombatModel";

type SongPatchRow = {
  op: string;
  path: string;
  body: {
    id: string;
    bonuses: { accuracy: number; damage: number };
    setId: string;
    specialAttackId?: string;
    slot: string;
    style: string;
    tier: number;
    unlock: { regions: string[]; requirement: string; type: string };
    sources: Array<{ url: string; verifiedAt: string }>;
  };
};

const patchRows = readFileSync(
  resolve(process.cwd(), "data/patches/2026-08-09-song-of-destruction.jsonl"),
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line) as SongPatchRow);

describe("Song of Destruction equipment patch", () => {
  it("keeps the full Roar and Ode records at their live record paths", () => {
    expect(patchRows.map(({ op, path }) => ({ op, path }))).toEqual([
      { op: "set-record", path: "$.records[36]" },
      { op: "set-record", path: "$.records[37]" },
    ]);
    expect(patchRows.map(({ body }) => body.unlock)).toEqual([
      { regions: ["misthalin"], requirement: "League self-supply: misthalin", type: "drop" },
      { regions: ["misthalin"], requirement: "League self-supply: misthalin", type: "drop" },
    ]);
  });

  it("records current weapon stats and native-special ownership", () => {
    const roar = patchRows[0]!.body;
    const ode = patchRows[1]!.body;
    expect(roar).toMatchObject({
      id: "item:roar-of-awakening",
      bonuses: { accuracy: 2765, damage: 912 },
      setId: "song-of-destruction",
      specialAttackId: "soulfire",
      slot: "mainhand",
      style: "magic",
      tier: 95,
    });
    expect(ode).toMatchObject({
      id: "item:ode-to-deceit",
      bonuses: { accuracy: 2765, damage: 456 },
      setId: "song-of-destruction",
      slot: "offhand",
      style: "magic",
      tier: 95,
    });
    expect(ode.specialAttackId).toBeUndefined();
    expect([...roar.sources, ...ode.sources].every(({ verifiedAt }) => verifiedAt === "2026-08-09")).toBe(
      true,
    );
  });
});

function songLoadout(
  equipmentSlots: Loadout["equipmentSlots"],
  useEquippedWeaponSpecial = false,
): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    style: "magic",
    startingAdrenaline: 100,
    buffs: {
      ...DEFAULT_LOADOUT.buffs,
      useEquippedWeaponSpecial,
    },
    equipmentSlots: {
      ...DEFAULT_LOADOUT.equipmentSlots,
      ...equipmentSlots,
    },
  };
}

describe("Song of Destruction resolved loadout", () => {
  it("activates the correct set tier and native Soulfire access from real equipment records", () => {
    const neither = resolveLoadoutCombat(songLoadout({}));
    const roar = resolveLoadoutCombat(songLoadout({ mainhand: "item:roar-of-awakening" }));
    const ode = resolveLoadoutCombat(songLoadout({ offhand: "item:ode-to-deceit" }));
    const both = resolveLoadoutCombat(
      songLoadout({
        mainhand: "item:roar-of-awakening",
        offhand: "item:ode-to-deceit",
      }),
    );

    expect(neither.model.equipmentEffects.songOfDestruction).toEqual({
      pieceCount: 0,
      enabled: false,
      twoPiece: false,
    });
    expect(roar.model.equipmentEffects.songOfDestruction).toEqual({
      pieceCount: 1,
      enabled: true,
      twoPiece: false,
    });
    expect(ode.model.equipmentEffects.songOfDestruction).toEqual({
      pieceCount: 1,
      enabled: true,
      twoPiece: false,
    });
    expect(both.model.equipmentEffects.songOfDestruction).toEqual({
      pieceCount: 2,
      enabled: true,
      twoPiece: true,
    });
    expect(roar.model.equipmentEffects.activeWeapon?.specialAttackId).toBe("soulfire");
    expect(ode.model.equipmentEffects.activeWeapon?.specialAttackId).toBeNull();

    const abilities = resolveAbilityCatalogue().catalogue.filter(
      (ability) => ability.style === "magic",
    );
    const visibleWithRoar = filterAbilitiesForLoadout(abilities, {
      weaponConfiguration: roar.model.weaponConfiguration,
      equipmentIds: roar.model.equipmentIds,
      activeWeapon: roar.model.equipmentEffects.activeWeapon,
      passiveIds: roar.model.equipmentEffects.passiveIds,
      league: roar.stats.league,
    });
    const visibleWithOde = filterAbilitiesForLoadout(abilities, {
      weaponConfiguration: ode.model.weaponConfiguration,
      equipmentIds: ode.model.equipmentIds,
      activeWeapon: ode.model.equipmentEffects.activeWeapon,
      passiveIds: ode.model.equipmentEffects.passiveIds,
      league: ode.stats.league,
    });
    expect(visibleWithRoar.map(({ id }) => id)).toContain("soulfire");
    expect(visibleWithOde.map(({ id }) => id)).not.toContain("soulfire");
  });

  it("auto-casts Soulfire from the resolved Roar loadout", () => {
    const { model } = resolveLoadoutCombat(
      songLoadout(
        {
          mainhand: "item:roar-of-awakening",
          offhand: "item:ode-to-deceit",
        },
        true,
      ),
    );
    const catalogue = resolveAbilityCatalogue();
    const result = simulateRevolution(
      toRevolutionInput(buildSimulationInputBase(model, catalogue), {
        bar: [catalogue.byId.get("magic_attack")!],
        style: "magic",
        durationTicks: 10,
      }),
      { stochasticSeed: 1, stochasticLanes: 128 },
    );

    expect(result.ok).toBe(true);
    expect(result.casts[0]?.abilityId).toBe("soulfire");
    expect(result.events.filter(({ abilityId }) => abilityId === "soulfire")).not.toHaveLength(0);
  });
});
