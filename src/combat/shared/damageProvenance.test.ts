import { describe, expect, it } from "vitest";
import { isOnHitPlayerDamage } from "./onHitEligibility";
import {
  assertProvenance,
  capabilitiesOf,
  contextWithProvenance,
  originKindOf,
  outgoingSourceOf,
  provenanceForCastHit,
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

  it("throws on unknown kind", () => {
    expect(() =>
      assertProvenance({ kind: "not_a_real_kind" as DamageProvenanceKind }),
    ).toThrow(/unknown kind/);
  });
});

describe("provenanceForCastHit", () => {
  it("command wins over other flags", () => {
    expect(
      provenanceForCastHit({
        isCommand: true,
        isDot: true,
        convertedChannel: true,
        autoAttack: true,
      }),
    ).toEqual({ kind: "conjure_command" });
  });

  it("converted channel before plain DoT", () => {
    expect(
      provenanceForCastHit({ isCommand: false, isDot: true, convertedChannel: true }),
    ).toEqual({ kind: "player_converted_channel" });
  });

  it("DoT with detail from dotKind or bleedId", () => {
    expect(
      provenanceForCastHit({ isCommand: false, isDot: true, dotKind: "bleed" }),
    ).toEqual({ kind: "player_dot", detail: "bleed" });
    expect(
      provenanceForCastHit({ isCommand: false, isDot: true, bleedId: "corruption_shot" }),
    ).toEqual({ kind: "player_dot", detail: "corruption_shot" });
    expect(provenanceForCastHit({ isCommand: false, isDot: true })).toEqual({
      kind: "player_dot",
    });
  });

  it("auto and direct", () => {
    expect(
      provenanceForCastHit({ isCommand: false, isDot: false, autoAttack: true }),
    ).toEqual({ kind: "player_auto" });
    expect(provenanceForCastHit({ isCommand: false, isDot: false })).toEqual({
      kind: "player_direct",
    });
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
    expect(provenanceFromLegacy({ convertedChannel: true }).kind).toBe("player_converted_channel");
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
    ["player_converted_channel", "dot"],
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

  it("originKindOf matches outgoingSourceOf", () => {
    const p: DamageProvenance = { kind: "player_converted_channel" };
    expect(originKindOf(p)).toBe(outgoingSourceOf(p));
    expect(originKindOf(p)).toBe("dot");
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
