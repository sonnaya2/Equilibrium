import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "./equipment";
import {
  equipmentRecordPassiveIds,
  resolveAbilityCastAvailability,
  resolveEquippedAbilityId,
  resolveEquippedAbilityVariant,
} from "./abilityAvailability";
import { equipmentById } from "../data";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { RANGED_ABILITIES } from "../styles/ranged/abilities";
import { MAGIC_ABILITIES } from "../styles/magic/abilities";
import { NECROMANCY_ABILITIES } from "../styles/necromancy/abilities";

function byId(list: readonly { id: string }[], id: string) {
  const found = list.find((a) => a.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found as (typeof MELEE_ABILITIES)[number];
}

const overpower = byId(MELEE_ABILITIES, "overpower");
const overpowerIgneous = byId(MELEE_ABILITIES, "overpower_igneous");
const deadshot = byId(RANGED_ABILITIES, "deadshot");
const deadshotIgneous = byId(RANGED_ABILITIES, "deadshot_igneous");
const omnipower = byId(MAGIC_ABILITIES, "omnipower");
const omnipowerIgneous = byId(MAGIC_ABILITIES, "omnipower_igneous");
const instability = byId(MAGIC_ABILITIES, "instability");
const deathSkulls = byId(NECROMANCY_ABILITIES, "death_skulls");
const deathSkullsIgneous = byId(NECROMANCY_ABILITIES, "death_skulls_igneous");

const meleePeers = [overpower, overpowerIgneous];
const rangedPeers = [deadshot, deadshotIgneous];
const magicPeers = [omnipower, omnipowerIgneous];
const necroPeers = [deathSkulls, deathSkullsIgneous];

describe("igneous cape equipment passives", () => {
  it("Kal-Ket grants only Overpower", () => {
    const effects = activeEquipmentEffects({
      equipmentSlots: { cape: "item:igneous-kal-ket" },
    });
    expect(effects.passiveIds).toEqual(["igneous-overpower"]);
  });

  it("Kal-Xil grants only Deadshot", () => {
    const effects = activeEquipmentEffects({
      equipmentSlots: { cape: "item:igneous-kal-xil" },
    });
    expect(effects.passiveIds).toEqual(["igneous-deadshot"]);
  });

  it("Kal-Mej grants only Omnipower", () => {
    const effects = activeEquipmentEffects({
      equipmentSlots: { cape: "item:igneous-kal-mej" },
    });
    expect(effects.passiveIds).toEqual(["igneous-omnipower"]);
  });

  it("Kal-Mor grants only Death Skulls", () => {
    const effects = activeEquipmentEffects({
      equipmentSlots: { cape: "item:igneous-kal-mor" },
    });
    expect(effects.passiveIds).toEqual(["igneous-death-skulls"]);
  });

  it("Kal-Zuk grants all four without duplicates", () => {
    const effects = activeEquipmentEffects({
      equipmentSlots: { cape: "item:igneous-kal-zuk" },
    });
    expect([...effects.passiveIds].sort()).toEqual(
      ["igneous-deadshot", "igneous-death-skulls", "igneous-omnipower", "igneous-overpower"].sort(),
    );
    expect(new Set(effects.passiveIds).size).toBe(4);
  });

  it("unequipped cape grants nothing", () => {
    const effects = activeEquipmentEffects({ equipmentSlots: {} });
    expect(effects.passiveIds.some((id) => id.startsWith("igneous-"))).toBe(false);
  });

  it("equipment records expose plural passiveIds", () => {
    const zuk = equipmentById("item:igneous-kal-zuk");
    expect(zuk).toBeDefined();
    expect(equipmentRecordPassiveIds(zuk!).sort()).toEqual(
      ["igneous-deadshot", "igneous-death-skulls", "igneous-omnipower", "igneous-overpower"].sort(),
    );
  });
});

describe("resolveAbilityCastAvailability — igneous pairs", () => {
  const cases = [
    {
      style: "melee",
      base: overpower,
      upgrade: overpowerIgneous,
      peers: meleePeers,
      cape: "item:igneous-kal-ket",
      wrongCape: "item:igneous-kal-xil",
      passive: "igneous-overpower" as const,
      unlockMessage: "Requires Igneous Kal-Ket or Igneous Kal-Zuk",
    },
    {
      style: "ranged",
      base: deadshot,
      upgrade: deadshotIgneous,
      peers: rangedPeers,
      cape: "item:igneous-kal-xil",
      wrongCape: "item:igneous-kal-ket",
      passive: "igneous-deadshot" as const,
      unlockMessage: "Requires Igneous Kal-Xil or Igneous Kal-Zuk",
    },
    {
      style: "magic",
      base: omnipower,
      upgrade: omnipowerIgneous,
      peers: magicPeers,
      cape: "item:igneous-kal-mej",
      wrongCape: "item:igneous-kal-mor",
      passive: "igneous-omnipower" as const,
      unlockMessage: "Requires Igneous Kal-Mej or Igneous Kal-Zuk",
    },
    {
      style: "necromancy",
      base: deathSkulls,
      upgrade: deathSkullsIgneous,
      peers: necroPeers,
      cape: "item:igneous-kal-mor",
      wrongCape: "item:igneous-kal-mej",
      passive: "igneous-death-skulls" as const,
      unlockMessage: "Requires Igneous Kal-Mor or Igneous Kal-Zuk",
    },
  ] as const;

  for (const c of cases) {
    describe(c.style, () => {
      it("without passive: base available, upgrade missing-passive", () => {
        expect(resolveAbilityCastAvailability(c.base, { groupPeers: c.peers })).toEqual({
          available: true,
        });
        const upgrade = resolveAbilityCastAvailability(c.upgrade, { groupPeers: c.peers });
        expect(upgrade).toMatchObject({
          available: false,
          reason: "missing-passive",
          message: c.unlockMessage,
        });
      });

      it("with style cape: upgrade available, base superseded", () => {
        const effects = activeEquipmentEffects({ equipmentSlots: { cape: c.cape } });
        expect(
          resolveAbilityCastAvailability(c.upgrade, {
            equipmentIds: [c.cape],
            passiveIds: effects.passiveIds,
            groupPeers: c.peers,
          }),
        ).toEqual({ available: true });
        expect(
          resolveAbilityCastAvailability(c.base, {
            equipmentIds: [c.cape],
            passiveIds: effects.passiveIds,
            groupPeers: c.peers,
          }),
        ).toMatchObject({ available: false, reason: "superseded" });
      });

      it("with Kal-Zuk: upgrade available, base superseded", () => {
        const effects = activeEquipmentEffects({
          equipmentSlots: { cape: "item:igneous-kal-zuk" },
        });
        expect(
          resolveAbilityCastAvailability(c.upgrade, {
            equipmentIds: ["item:igneous-kal-zuk"],
            passiveIds: effects.passiveIds,
            groupPeers: c.peers,
          }),
        ).toEqual({ available: true });
        expect(
          resolveAbilityCastAvailability(c.base, {
            equipmentIds: ["item:igneous-kal-zuk"],
            passiveIds: effects.passiveIds,
            groupPeers: c.peers,
          }),
        ).toMatchObject({ available: false, reason: "superseded" });
      });

      it("unrelated cape does not unlock the variant", () => {
        const effects = activeEquipmentEffects({ equipmentSlots: { cape: c.wrongCape } });
        expect(
          resolveAbilityCastAvailability(c.upgrade, {
            equipmentIds: [c.wrongCape],
            passiveIds: effects.passiveIds,
            groupPeers: c.peers,
          }),
        ).toMatchObject({ available: false, reason: "missing-passive" });
      });

      it("base and upgrade cannot both be available", () => {
        for (const cape of [c.cape, "item:igneous-kal-zuk"] as const) {
          const effects = activeEquipmentEffects({ equipmentSlots: { cape } });
          const baseOk = resolveAbilityCastAvailability(c.base, {
            equipmentIds: [cape],
            passiveIds: effects.passiveIds,
            groupPeers: c.peers,
          }).available;
          const upOk = resolveAbilityCastAvailability(c.upgrade, {
            equipmentIds: [cape],
            passiveIds: effects.passiveIds,
            groupPeers: c.peers,
          }).available;
          expect(baseOk && upOk).toBe(false);
        }
        const none = activeEquipmentEffects({ equipmentSlots: {} });
        const baseOk = resolveAbilityCastAvailability(c.base, {
          passiveIds: none.passiveIds,
          groupPeers: c.peers,
        }).available;
        const upOk = resolveAbilityCastAvailability(c.upgrade, {
          passiveIds: none.passiveIds,
          groupPeers: c.peers,
        }).available;
        expect(baseOk && upOk).toBe(false);
      });

      it("resolveEquippedAbilityVariant rewrites base to upgrade with cape", () => {
        const effects = activeEquipmentEffects({ equipmentSlots: { cape: c.cape } });
        const byId = new Map(c.peers.map((p) => [p.id, p]));
        expect(
          resolveEquippedAbilityVariant(c.base, {
            passiveIds: effects.passiveIds,
            byId,
          }).id,
        ).toBe(c.upgrade.id);
        expect(
          resolveEquippedAbilityVariant(c.upgrade, {
            passiveIds: effects.passiveIds,
            byId,
          }).id,
        ).toBe(c.upgrade.id);
        expect(
          resolveEquippedAbilityVariant(c.base, {
            passiveIds: [],
            byId,
          }).id,
        ).toBe(c.base.id);
        expect(resolveEquippedAbilityId(c.base.id, byId, { passiveIds: effects.passiveIds })).toBe(
          c.upgrade.id,
        );
      });

      it("without cape upgrade id resolves to base", () => {
        const byId = new Map(c.peers.map((p) => [p.id, p]));
        expect(
          resolveEquippedAbilityVariant(c.upgrade, {
            passiveIds: [],
            byId,
          }).id,
        ).toBe(c.base.id);
        expect(resolveEquippedAbilityId(c.upgrade.id, byId, { passiveIds: [] })).toBe(c.base.id);
      });

      it("wrong cape does not rewrite base to upgrade", () => {
        const effects = activeEquipmentEffects({ equipmentSlots: { cape: c.wrongCape } });
        const byId = new Map(c.peers.map((p) => [p.id, p]));
        expect(
          resolveEquippedAbilityVariant(c.base, {
            passiveIds: effects.passiveIds,
            equipmentIds: [c.wrongCape],
            byId,
          }).id,
        ).toBe(c.base.id);
        expect(
          resolveEquippedAbilityId(c.base.id, byId, {
            passiveIds: effects.passiveIds,
            equipmentIds: [c.wrongCape],
          }),
        ).toBe(c.base.id);
        expect(
          resolveEquippedAbilityId(c.upgrade.id, byId, {
            passiveIds: effects.passiveIds,
            equipmentIds: [c.wrongCape],
          }),
        ).toBe(c.base.id);
      });
    });
  }
});

describe("native special access", () => {
  it("requires the resolved native weapon, while EoF remains a separate access path", () => {
    const fsoa = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: { twohand: "item:fractured-staff-of-armadyl" },
    });
    expect(fsoa.activeWeapon).toMatchObject({
      id: "item:fractured-staff-of-armadyl",
      specialAttackId: "instability",
      passiveIds: ["surging-storm"],
    });
    expect(
      resolveAbilityCastAvailability(instability, {
        equipmentIds: ["item:fractured-staff-of-armadyl"],
        activeWeapon: fsoa.activeWeapon,
      }),
    ).toEqual({ available: true });

    const wrongWeapon = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: { twohand: "item:staff-of-light" },
    });
    expect(
      resolveAbilityCastAvailability(instability, {
        equipmentIds: ["item:fractured-staff-of-armadyl"],
        activeWeapon: wrongWeapon.activeWeapon,
      }),
    ).toMatchObject({ available: false, reason: "missing-special-access" });
    expect(
      resolveAbilityCastAvailability(instability, {
        equipmentIds: ["item:staff-of-light", "item:essence-of-finality"],
        activeWeapon: wrongWeapon.activeWeapon,
      }),
    ).toEqual({ available: true });
  });
});
