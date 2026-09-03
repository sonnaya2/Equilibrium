import { describe, expect, it } from "vitest";
import { blessingHitEligibility } from "../league/damage";
import { runPipeline } from "../pipeline/modifierPipeline";
import { mulFloor } from "../core/rounding";
import {
  capabilitiesOf,
  type DamageCapabilities,
  type DamageProvenance,
  type DamageProvenanceKind,
} from "./damageProvenance";
import { isOnHitPlayerDamage } from "./onHitEligibility";
import {
  FULL_SLAYER_HELMET_ITEM_ID,
  resolveSlayerHelmet,
  slayerHelmetDamageModifier,
} from "./slayerHelmet";

/**
 * Event-family capability matrix. Columns are product gates; rows are provenance kinds.
 * Values are asserted cell-by-cell so a kind cannot silently inherit player_direct.
 */

type CapKey = keyof DamageCapabilities;

const CAP_KEYS: CapKey[] = [
  "playerAttack",
  "directHit",
  "onHitGear",
  "blessingRider",
  "cindersOnHit",
  "blessingOnHit",
  "canCrit",
  "canGeneratePerfectEquilibrium",
  "canApplyAmmunition",
  "canGenerateResources",
  "canTriggerProcs",
  "recursiveDamage",
  "prayerMods",
  "canApplyAbyssalParasite",
  "canApplyWeaponPoison",
  "canApplyEvolvingToxin",
];

/** Expected capability rows (product law). */
const MATRIX: Record<DamageProvenanceKind, DamageCapabilities> = {
  player_direct: {
    playerAttack: true,
    directHit: true,
    onHitGear: true,
    blessingRider: true,
    cindersOnHit: true,
    blessingOnHit: true,
    canCrit: true,
    canGeneratePerfectEquilibrium: true,
    canApplyAmmunition: true,
    canGenerateResources: true,
    canTriggerProcs: true,
    recursiveDamage: true,
    prayerMods: true,
    canApplyAbyssalParasite: true,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: true,
  },
  player_auto: {
    playerAttack: true,
    directHit: true,
    onHitGear: true,
    blessingRider: true,
    cindersOnHit: true,
    blessingOnHit: true,
    canCrit: true,
    canGeneratePerfectEquilibrium: true,
    canApplyAmmunition: true,
    canGenerateResources: true,
    canTriggerProcs: true,
    recursiveDamage: true,
    prayerMods: true,
    canApplyAbyssalParasite: true,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  player_poison: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  player_dot: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  player_converted_channel: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: true,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: true,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  conjure_auto: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  conjure_poison: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  conjure_command: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: true,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: true,
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  spell_proc: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: false,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: true,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  equipment_proc: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: true,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: true,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  invention_proc: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  attached: {
    playerAttack: true,
    directHit: false,
    onHitGear: true,
    blessingRider: false,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: true,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  botlg_perfect_equilibrium: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: false,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: true,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: true,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: true,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
  blessing: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: true,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  derived_bounce: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: true,
    blessingOnHit: true,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: true,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  derived_tail: {
    playerAttack: true,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  reflected: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: true,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: true,
    canApplyEvolvingToxin: false,
  },
  target_status: {
    playerAttack: false,
    directHit: false,
    onHitGear: false,
    blessingRider: false,
    cindersOnHit: false,
    blessingOnHit: false,
    canCrit: false,
    canGeneratePerfectEquilibrium: false,
    canApplyAmmunition: false,
    canGenerateResources: false,
    canTriggerProcs: false,
    recursiveDamage: false,
    prayerMods: false,
    canApplyAbyssalParasite: false,
    canApplyWeaponPoison: false,
    canApplyEvolvingToxin: false,
  },
};

describe("damage eligibility matrix (capabilitiesOf)", () => {
  for (const kind of Object.keys(MATRIX) as DamageProvenanceKind[]) {
    it(`kind ${kind}: every capability cell matches the matrix`, () => {
      const expected = MATRIX[kind];
      const actual = capabilitiesOf({ kind });
      for (const key of CAP_KEYS) {
        expect(actual[key], `${kind}.${key}`).toBe(expected[key]);
      }
    });
  }

  it("separates inherited Critual triggers from independent crit rolls", () => {
    expect(capabilitiesOf({ kind: "derived_bounce" })).toMatchObject({
      canCrit: false,
      canTriggerCritual: true,
    });
    const tail = capabilitiesOf({ kind: "derived_tail" });
    expect(tail.canCrit).toBe(false);
    expect(tail.canTriggerCritual).toBeUndefined();
  });
});

describe("blessingHitEligibility from capabilities", () => {
  it("mirrors capability columns for legacy sources", () => {
    expect(blessingHitEligibility("direct", false)).toEqual({
      rider: true,
      cinders: true,
      onHit: true,
    });
    expect(blessingHitEligibility("dot", false)).toEqual({
      rider: true,
      cinders: false,
      onHit: false,
    });
    expect(blessingHitEligibility("command", false)).toEqual({
      rider: true,
      cinders: false,
      onHit: false,
    });
    expect(blessingHitEligibility("conjure", false)).toEqual({
      rider: true,
      cinders: false,
      onHit: false,
    });
    expect(blessingHitEligibility("proc", false)).toEqual({
      rider: true,
      cinders: false,
      onHit: false,
    });
    expect(blessingHitEligibility("blessing", false)).toEqual({
      rider: true,
      cinders: false,
      onHit: false,
    });
  });

  it("attached excludes all sources", () => {
    for (const source of ["direct", "dot", "command", "conjure"] as const) {
      expect(blessingHitEligibility(source, true)).toEqual({
        rider: false,
        cinders: false,
        onHit: false,
      });
    }
  });

  it("accepts DamageProvenance objects", () => {
    expect(blessingHitEligibility({ kind: "player_auto" }, false)).toEqual({
      rider: true,
      cinders: true,
      onHit: true,
    });
    expect(blessingHitEligibility({ kind: "equipment_proc" }, false)).toEqual({
      rider: true,
      cinders: false,
      onHit: false,
    });
  });

  it("Light and Inferno host Big Boned without Cinders", () => {
    expect(
      blessingHitEligibility({ kind: "blessing", detail: "light-of-saradomin" }, false),
    ).toEqual({ rider: true, cinders: false, onHit: false });
    expect(
      blessingHitEligibility({ kind: "blessing", detail: "inferno-of-zamorak" }, false),
    ).toEqual({ rider: true, cinders: false, onHit: false });
    expect(blessingHitEligibility({ kind: "blessing", detail: "big-boned" }, false)).toEqual({
      rider: false,
      cinders: false,
      onHit: false,
    });
    expect(blessingHitEligibility({ kind: "blessing", detail: "grasp-of-guthix" }, false)).toEqual({
      rider: true,
      cinders: false,
      onHit: false,
    });
  });
});

describe("Lightning Surge + Slayer Helmet (bug fix)", () => {
  it("equipment_proc provenance does not apply helm mult", () => {
    const r = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: true,
      style: "magic",
    });
    const mod = slayerHelmetDamageModifier(r)!;
    expect(mod).toBeTruthy();
    const direct = runPipeline({ damage: 1000 }, [mod], {
      style: "magic",
      damageSource: "direct",
      provenance: { kind: "player_direct" },
    }).damage;
    expect(direct).toBe(mulFloor(1000, 1.075));

    const surge = runPipeline({ damage: 1000 }, [mod], {
      style: "magic",
      damageSource: "proc",
      provenance: { kind: "equipment_proc", detail: "lightning_surge" },
    }).damage;
    expect(surge).toBe(1000);
    expect(
      isOnHitPlayerDamage({
        style: "magic",
        provenance: { kind: "equipment_proc", detail: "lightning_surge" },
      }),
    ).toBe(false);
  });
});

describe("attached on-hit gear follows parent", () => {
  it("attached kind has onHitGear true (direct-parent path)", () => {
    expect(capabilitiesOf({ kind: "attached", detail: "searing_winds" }).onHitGear).toBe(true);
  });

  it("DoT parent provenance still blocks helm (SW under Corruption Shot)", () => {
    const r = resolveSlayerHelmet({
      equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
      onSlayerTask: true,
      style: "ranged",
    });
    const mod = slayerHelmetDamageModifier(r)!;
    // Live castHit uses parent provenance when parent.onHitGear is false.
    const underDot = runPipeline({ damage: 1000 }, [mod], {
      style: "ranged",
      damageSource: "dot",
      provenance: { kind: "player_dot", detail: "corruption_shot" },
    }).damage;
    expect(underDot).toBe(1000);

    const underDirect = runPipeline({ damage: 1000 }, [mod], {
      style: "ranged",
      damageSource: "direct",
      provenance: { kind: "attached", detail: "searing_winds" },
    }).damage;
    expect(underDirect).toBe(mulFloor(1000, 1.075));
  });
});

describe("command analysis parity", () => {
  it("conjure_command is not onHitGear and not blessing onHit", () => {
    const c = capabilitiesOf({ kind: "conjure_command" });
    expect(c.onHitGear).toBe(false);
    expect(c.blessingRider).toBe(true);
    expect(c.blessingOnHit).toBe(false);
    expect(blessingHitEligibility({ kind: "conjure_command" }, false)).toEqual({
      rider: true,
      cinders: false,
      onHit: false,
    });
  });
});

describe("matrix column labels (documentation)", () => {
  it("exposes the product gate columns used by analysis", () => {
    // Hit counters ~ canTriggerProcs; Vulnerability is target-stage (not gated here);
    // Prayer/window ~ prayerMods; Crit ~ canCrit; Invention proc gen ~ canTriggerProcs;
    // Resource gen ~ canGenerateResources; Blessing riders/on-hit ~ blessingRider/OnHit.
    const sample: DamageProvenance = { kind: "player_direct" };
    const caps = capabilitiesOf(sample);
    expect(Object.keys(caps).sort()).toEqual([...CAP_KEYS].sort());
  });
});
