import { describe, expect, it } from "vitest";
import { equipmentById } from "@/combat/data";
import {
  resolveAmmunitionFromEquipment,
  resolveQuiverFromEquipment,
} from "@/combat/styles/ranged/ammunitionEquipment";
import { DEFAULT_LOADOUT, normalizeLoadout } from "./useLoadout";
import {
  rangedAmmunitionEffectPresentation,
  rangedAmmunitionEffectPresentationFromProfile,
} from "./ammunitionEffectPresentation";

function rangedLoadout(
  equipmentSlots: Record<string, string>,
  selectedAmmunitionId: string | null = null,
) {
  return normalizeLoadout({
    ...DEFAULT_LOADOUT,
    style: "ranged",
    equipmentSlots,
    selectedAmmunitionId,
  });
}

function resolvedBoltProfile(itemId: string, withQuiver = false) {
  const projectile = resolveAmmunitionFromEquipment(equipmentById(itemId));
  if (projectile == null) throw new Error(`missing test ammunition ${itemId}`);
  const quiver = withQuiver ? resolveQuiverFromEquipment(equipmentById("item:pernix-quiver")) : null;
  if (withQuiver && quiver == null) throw new Error("missing test quiver");
  return {
    projectile,
    quiver,
    weaponCapability: { mode: "required" as const, acceptedFamily: "bolts" as const },
    effectiveStatTier: projectile.statTier,
  };
}

describe("ranged ammunition effect presentation", () => {
  it("omits empty and ordinary ammunition", () => {
    expect(
      rangedAmmunitionEffectPresentation(
        rangedLoadout({ twohand: "item:ascension-crossbow" }),
      ),
    ).toBeNull();
    expect(
      rangedAmmunitionEffectPresentation(
        rangedLoadout({ twohand: "item:ascension-crossbow", ammo: "item:ascension-bolts" }),
      ),
    ).toBeNull();
  });

  it("presents a directly equipped enchanted bolt with its active status", () => {
    expect(
      rangedAmmunitionEffectPresentationFromProfile(resolvedBoltProfile("item:opal-bolts-e")),
    ).toMatchObject({
      effectId: "ammunition:opal",
      itemId: "item:opal-bolts-e",
      itemLabel: "Opal bolts (e)",
      label: "Opal bolts · Lucky Lightning",
      icon: "/game/combat/equipment/opal-bolts-e.webp",
      support: "modeled",
      statusLabel: "Loaded · Active",
      fullStatusClass: "modeled",
      rowClass: "",
    });
  });

  it("uses the selected projectile inside a quiver", () => {
    expect(
      rangedAmmunitionEffectPresentationFromProfile(
        resolvedBoltProfile("item:opal-bolts-e", true),
      ),
    ).toMatchObject({
      effectId: "ammunition:opal",
      itemId: "item:opal-bolts-e",
      label: "Opal bolts · Lucky Lightning",
      statusLabel: "Loaded · Active",
    });
  });

  it("shares the effect label while preserving standard and bakriminel identity", () => {
    const standard = rangedAmmunitionEffectPresentationFromProfile(
      resolvedBoltProfile("item:opal-bolts-e"),
    );
    const bakriminel = rangedAmmunitionEffectPresentationFromProfile(
      resolvedBoltProfile("item:opal-bakriminel-bolts-e"),
    );

    expect(standard?.label).toBe("Opal bolts · Lucky Lightning");
    expect(bakriminel?.label).toBe(standard?.label);
    expect(standard?.itemId).toBe("item:opal-bolts-e");
    expect(bakriminel?.itemId).toBe("item:opal-bakriminel-bolts-e");
    expect(bakriminel?.icon).toBe(
      "/game/combat/equipment/opal-bakriminel-bolts-e.webp",
    );
    expect(standard?.icon).toBe("/game/combat/equipment/opal-bolts-e.webp");
    expect(bakriminel?.icon).not.toBe(standard?.icon);
  });

  it("presents Emerald bakriminel bolts as modeled Magical Poison", () => {
    expect(
      rangedAmmunitionEffectPresentationFromProfile(
        resolvedBoltProfile("item:emerald-bakriminel-bolts-e"),
      ),
    ).toMatchObject({
      effectId: "ammunition:emerald",
      itemId: "item:emerald-bakriminel-bolts-e",
      itemLabel: "Emerald bakriminel bolts (e)",
      label: "Emerald bolts · Magical Poison",
      icon: "/game/combat/equipment/emerald-bakriminel-bolts-e.webp",
      support: "modeled",
      statusLabel: "Loaded · Active",
      fullStatusClass: "modeled",
      rowClass: "",
    });
  });

  it("keeps partial and unsupported support visible", () => {
    const partial = rangedAmmunitionEffectPresentationFromProfile(
      resolvedBoltProfile("item:diamond-bolts-e"),
    );
    const unsupported = rangedAmmunitionEffectPresentationFromProfile(
      resolvedBoltProfile("item:jade-bolts-e"),
    );

    expect(partial).toMatchObject({
      support: "partially-modeled",
      statusLabel: "Loaded · Partial",
      fullStatusClass: "partially-modeled",
      rowClass: "setup-status-row--partial",
    });
    expect(unsupported).toMatchObject({
      support: "unsupported",
      statusLabel: "Loaded · Unsupported",
      fullStatusClass: "not-modeled",
      rowClass: "setup-status-row--unmodeled",
    });
  });
});
