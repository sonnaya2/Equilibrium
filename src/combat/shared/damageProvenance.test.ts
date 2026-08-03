import { describe, expect, it } from "vitest";
import { isOnHitPlayerDamage } from "./onHitEligibility";
import {
  assertProvenance,
  capabilitiesOf,
  contextWithProvenance,
  outgoingSourceOf,
  provenanceFromLegacy,
  resolveCombatProvenance,
  type DamageProvenance,
  type DamageProvenanceKind,
} from "./damageProvenance";

describe("assertProvenance", () => {
  it("returns valid provenance", () => {
    const p: DamageProvenance = { kind: "player_direct" };
    expect(assertProvenance(p)).toEqual(p);
  });

  it("throws on missing provenance", () => {
    expect(() => assertProvenance(null)).toThrow(/missing DamageProvenance/);
    expect(() => assertProvenance(undefined)).toThrow(/missing DamageProvenance/);
  });
});

describe("provenanceFromLegacy / resolveCombatProvenance", () => {
  it("maps damageSource and flags", () => {
    expect(provenanceFromLegacy({ damageSource: "direct" }).kind).toBe("player_direct");
    expect(provenanceFromLegacy({ damageSource: "direct", autoAttack: true }).kind).toBe(
      "player_auto",
    );
    expect(provenanceFromLegacy({ damageSource: "dot" }).kind).toBe("player_dot");
    expect(provenanceFromLegacy({ dotKind: "bleed" }).kind).toBe("player_dot");
    expect(provenanceFromLegacy({ damageSource: "command" }).kind).toBe("conjure_command");
    expect(provenanceFromLegacy({ damageSource: "conjure" }).kind).toBe("conjure_auto");
    expect(provenanceFromLegacy({ damageSource: "conjure", dotKind: "poison" }).kind).toBe(
      "conjure_poison",
    );
    expect(provenanceFromLegacy({ damageSource: "proc" }).kind).toBe("equipment_proc");
    expect(provenanceFromLegacy({ damageSource: "blessing" }).kind).toBe("blessing");
    expect(provenanceFromLegacy({ blessingGenerated: true }).kind).toBe("blessing");
  });

  it("defaults bare style-only context to player_direct", () => {
    expect(resolveCombatProvenance({ style: "melee" }).kind).toBe("player_direct");
  });

  it("strict mode throws when ambiguous", () => {
    expect(() => resolveCombatProvenance({ style: "melee" }, { strict: true })).toThrow(
      /ambiguous/,
    );
    expect(() =>
      provenanceFromLegacy({ strict: true }),
    ).toThrow(/ambiguous/);
  });

  it("explicit provenance wins over legacy flags", () => {
    const p = resolveCombatProvenance({
      style: "magic",
      damageSource: "direct",
      provenance: { kind: "equipment_proc", detail: "lightning_surge" },
    });
    expect(p).toEqual({ kind: "equipment_proc", detail: "lightning_surge" });
  });

  it("contextWithProvenance projects damageSource", () => {
    const ctx = contextWithProvenance(
      { style: "magic" },
      { kind: "equipment_proc", detail: "lightning_surge" },
    );
    expect(ctx.provenance?.kind).toBe("equipment_proc");
    expect(ctx.damageSource).toBe("proc");
  });
});

describe("outgoingSourceOf", () => {
  const cases: [DamageProvenanceKind, string][] = [
    ["player_direct", "direct"],
    ["player_auto", "direct"],
    ["player_dot", "dot"],
    ["conjure_auto", "conjure"],
    ["conjure_poison", "conjure"],
    ["conjure_command", "command"],
    ["equipment_proc", "proc"],
    ["invention_proc", "proc"],
    ["blessing", "blessing"],
    ["attached", "direct"],
    ["derived_bounce", "direct"],
    ["derived_tail", "dot"],
    ["reflected", "proc"],
  ];
  it.each(cases)("%s -> %s", (kind, source) => {
    expect(outgoingSourceOf({ kind })).toBe(source);
  });
});

describe("isOnHitPlayerDamage via capabilities", () => {
  it("allows player direct and auto", () => {
    expect(isOnHitPlayerDamage({ style: "melee", damageSource: "direct" })).toBe(true);
    expect(
      isOnHitPlayerDamage({
        style: "melee",
        provenance: { kind: "player_auto" },
      }),
    ).toBe(true);
  });

  it("rejects DoT, command, conjure, proc, blessing", () => {
    expect(isOnHitPlayerDamage({ style: "melee", damageSource: "dot", dotKind: "bleed" })).toBe(
      false,
    );
    expect(isOnHitPlayerDamage({ style: "melee", damageSource: "command" })).toBe(false);
    expect(isOnHitPlayerDamage({ style: "melee", damageSource: "conjure" })).toBe(false);
    expect(isOnHitPlayerDamage({ style: "melee", damageSource: "proc" })).toBe(false);
    expect(isOnHitPlayerDamage({ style: "melee", blessingGenerated: true })).toBe(false);
  });

  it("Lightning Surge equipment_proc never gets onHitGear", () => {
    expect(
      isOnHitPlayerDamage({
        style: "magic",
        damageSource: "proc",
        provenance: { kind: "equipment_proc", detail: "lightning_surge" },
      }),
    ).toBe(false);
    expect(capabilitiesOf({ kind: "equipment_proc", detail: "lightning_surge" }).onHitGear).toBe(
      false,
    );
  });

  it("explicit provenance wins over bare omit=direct", () => {
    // Pre-fix Lightning Surge path: bare context defaulted to player_direct.
    expect(isOnHitPlayerDamage({ style: "magic" })).toBe(true);
    expect(
      isOnHitPlayerDamage({
        style: "magic",
        provenance: { kind: "equipment_proc", detail: "lightning_surge" },
      }),
    ).toBe(false);
  });
});
