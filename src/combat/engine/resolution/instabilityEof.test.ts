import { describe, expect, it } from "vitest";
import { activeEquipmentEffects } from "../../shared/equipment";
import { resolveLeagueRules } from "../../league/ruleset";
import {
  INSTABILITY_DURATION_TICKS,
  instabilityActive,
} from "../../styles/magic/effects";
import { fsoaMagicInput, magicInput } from "../../test/fixtures/inputs";
import { performCast } from "../cast";
import { advanceTo } from "../runtime/clock";
import { createRuntime } from "../runtime/runtime";
import { createCastContext } from "../simulation/context";
import { rotationOf } from "../simulation/contracts";
import { simulate } from "../simulation/simulate";

const EOF = "item:essence-of-finality";
const STAFF = "item:staff-of-light";
const FSOA = "item:fractured-staff-of-armadyl";

function staffWithEofEffects() {
  return activeEquipmentEffects({
    style: "magic",
    equipmentSlots: {
      twohand: STAFF,
      amulet: EOF,
    },
  });
}

function staffOnlyEffects() {
  return activeEquipmentEffects({
    style: "magic",
    equipmentSlots: { twohand: STAFF },
  });
}

function fsoaWithEofEffects() {
  return activeEquipmentEffects({
    style: "magic",
    equipmentSlots: {
      twohand: FSOA,
      amulet: EOF,
    },
  });
}

/** EoF store of Instability on a non-FSoA magic staff (no native special). */
const eofInstabilityInput = {
  ...magicInput,
  startingAdrenaline: 100,
  weaponConfiguration: "twohand" as const,
  equipmentIds: [STAFF, EOF],
  equipmentEffects: staffWithEofEffects(),
  eofStoredSpecialId: "instability",
};

describe("EoF Instability + Lightning Surge", () => {
  it("casts Instability from EoF store without FSoA and arms the buff", () => {
    const effects = staffWithEofEffects();
    expect(effects.activeWeapon?.specialAttackId).toBeNull();
    expect(effects.activeWeapon?.style).toBe("magic");

    const ctx = createCastContext(eofInstabilityInput);
    const attempt = ctx.performCast(ctx.byId.get("instability")!, 0, false);

    expect(attempt.ok).toBe(true);
    expect(ctx.getState().magic.instability.expiresAtTick).toBe(INSTABILITY_DURATION_TICKS);
    expect(instabilityActive(ctx.getState().magic.instability, 0)).toBe(true);
    expect(instabilityActive(ctx.getState().magic.instability, INSTABILITY_DURATION_TICKS - 1)).toBe(
      true,
    );
    expect(instabilityActive(ctx.getState().magic.instability, INSTABILITY_DURATION_TICKS)).toBe(
      false,
    );
  });

  it("after EoF Instability, a magic hit with crit chance 1 schedules Lightning Surge", () => {
    const summary = simulate({
      ...eofInstabilityInput,
      crit: { chance: 1 },
      rotation: rotationOf("instability", "magic_attack"),
    });

    expect(summary.ok).toBe(true);
    const instabilitySeq = summary.casts.findIndex((c) => c.abilityId === "instability");
    const followSeq = summary.casts.findIndex((c, i) => i > instabilitySeq);
    expect(instabilitySeq).toBe(0);
    expect(followSeq).toBe(1);

    const followEvents = summary.events.filter((e) => e.sourceCast === followSeq);
    expect(followEvents.map((e) => e.family)).toEqual(["hit", "proc"]);
    const sourceHit = followEvents[0]!;
    const surge = followEvents[1]!;
    expect(sourceHit.lightningSurge).toBe(true);
    expect(sourceHit.damage.critical?.chance).toBe(1);
    expect(surge.provenance).toEqual({ kind: "equipment_proc", detail: "lightning_surge" });
    expect(surge.procEligible).toBe(false);
    expect(surge.recursionAllowed).toBe(false);
    expect(surge.tick).toBe(summary.casts[followSeq]!.tick + 1);
    expect(surge.expectedActivations).toBe(1);
    expect(surge.expectedSeparateHits).toBe(1);
  });

  it("lists FSoA Instability first and EoF store second for nativeSpecials", () => {
    const effects = fsoaWithEofEffects();
    expect(effects.activeWeapon?.specialAttackId).toBe("instability");

    const rt = createRuntime({
      ...magicInput,
      startingAdrenaline: 100,
      weaponConfiguration: "twohand",
      equipmentIds: [FSOA, EOF],
      equipmentEffects: effects,
      eofStoredSpecialId: "soulfire",
      nativeSpecialPolicy: { useEquippedWeaponSpecial: true },
    });

    expect(rt.nativeSpecial?.id).toBe("instability");
    expect(rt.nativeSpecials.map((s) => s.id)).toEqual(["instability", "soulfire"]);
  });

  it("fail-closes Instability when store is set without Essence of Finality", () => {
    const ctx = createCastContext({
      ...magicInput,
      startingAdrenaline: 100,
      weaponConfiguration: "twohand",
      equipmentIds: [STAFF],
      equipmentEffects: staffOnlyEffects(),
      eofStoredSpecialId: "instability",
    });

    const attempt = ctx.performCast(ctx.byId.get("instability")!, 0, false);
    expect(attempt.ok).toBe(false);
    expect(attempt.ok === false && attempt.error).toMatch(/Essence of Finality|special/i);
    expect(ctx.getState().magic.instability.expiresAtTick).toBe(0);
    expect(instabilityActive(ctx.getState().magic.instability, 0)).toBe(false);
  });

  it("Critual-capped source chance still samples concrete Crit/No crit for Lightning Surge", () => {
    const league = resolveLeagueRules({
      ruleset: "equilibrium",
      blessingPicks: ["Order", "Order", "Order", "Order", "Chaos"],
    });
    expect(league.blessingIds.has("unholy-critual")).toBe(true);

    let sawCrit = false;
    let sawNon = false;
    for (let laneIndex = 0; laneIndex < 128; laneIndex++) {
      const rt = createRuntime(
        {
          ...fsoaMagicInput,
          crit: { chance: 0.8 },
          startingAdrenaline: 50,
          league,
          context: { style: "magic", ruleset: "equilibrium" },
        },
        { laneIndex, laneCount: 128 },
      );
      expect(performCast(rt, rt.byId.get("instability")!, 0, false).ok).toBe(true);
      expect(performCast(rt, rt.byId.get("magic_attack")!, rt.state.tick, false).ok).toBe(true);
      advanceTo(rt, rt.endTick);

      const source = rt.events.find((e) => e.abilityId === "magic_attack" && e.family === "hit")!;
      expect(source.damage.critical?.chance).toBeCloseTo(0.5, 10);
      const parentSurge = rt.events.find(
        (e) =>
          e.family === "proc" &&
          e.provenance.detail === "lightning_surge" &&
          e.derivedFrom === source.seq,
      );
      if (source.damage.critical?.outcome === true) {
        sawCrit = true;
        expect(parentSurge).toBeDefined();
        expect(parentSurge!.expectedActivations).toBe(1);
        expect(parentSurge!.expectedSeparateHits).toBe(1);
      } else {
        sawNon = true;
        expect(parentSurge).toBeUndefined();
      }
      if (sawCrit && sawNon) break;
    }
    expect(sawCrit).toBe(true);
    expect(sawNon).toBe(true);
  });
});
