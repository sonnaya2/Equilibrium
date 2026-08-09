import { describe, expect, it } from "vitest";
import { baseInput } from "../../test/fixtures/inputs";
import { MELEE_ABILITIES } from "../../styles/melee/abilities";
import { CONSERVATION_OF_ENERGY_REFUND } from "../../shared/conservationOfEnergy";
import { rotationOf } from "./contracts";
import {
  buildCastTrace,
  compareVigourManual,
  compareVigourRevolution,
  formatTraceTimeline,
  specsById,
} from "./vigourForensic";

const melee = {
  base: baseInput.base,
  level: baseInput.level,
  accuracy: baseInput.accuracy,
  crit: baseInput.crit,
  abilities: MELEE_ABILITIES,
  style: "melee" as const,
};

function bar(...ids: string[]) {
  return specsById(MELEE_ABILITIES, ids);
}

describe("vigourForensic", () => {
  it("buildCastTrace records tick, adren, spend, weight, cumulative expected", () => {
    const report = compareVigourManual({
      ...baseInput,
      startingAdrenaline: 100,
      rotation: rotationOf("berserk"),
      autoWeave: false,
    });
    const rows = buildCastTrace(report.off.summary);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      index: 0,
      tick: 0,
      abilityId: "berserk",
      adrenalineBefore: 100,
      actualSpend: 100,
      adrenalineAfter: 0,
      historyWeight: 1,
      ringOfVigourRefund: 0,
    });

    const onRows = report.on.rows;
    expect(onRows[0]!.adrenalineAfter).toBe(10);
    expect(onRows[0]!.ringOfVigourRefund).toBe(10);
    expect(onRows[0]!.historyWeight).toBe(1);
  });

  it("controlled revo bar without ultimates: Vigour is a no-op (equal damage, equal sequence)", () => {
    const report = compareVigourRevolution({
      ...melee,
      bar: bar("assault", "dismember"),
      durationTicks: 80,
      startingAdrenaline: 50,
    });
    expect(report.off.summary.ok, report.off.summary.error).toBe(true);
    expect(report.on.summary.ok, report.on.summary.error).toBe(true);
    expect(report.sequenceEqual).toBe(true);
    expect(report.sequenceDiagnostic).toBeNull();
    expect(report.firstDivergenceIndex).toBeNull();
    expect(report.damageDelta).toBeCloseTo(0, 9);
    expect(report.off.totalExpected).toBeGreaterThan(0);
  });

  it("controlled revo bar with ultimate: Vigour permanent flag cannot lose damage (equipment ids fixed)", () => {
    // Sole managed ultimate + auto basic fill: residual only advances the rebuild.
    // No mid-priority spenders to reorder against the ultimate.
    const report = compareVigourRevolution({
      ...melee,
      bar: bar("overpower"),
      durationTicks: 120,
      startingAdrenaline: 100,
      equipmentIds: [],
    });
    expect(report.off.summary.ok, report.off.summary.error).toBe(true);
    expect(report.on.summary.ok, report.on.summary.error).toBe(true);
    expect(report.on.totalExpected).toBeGreaterThanOrEqual(report.off.totalExpected - 1e-9);
    expect(report.damageDelta).toBeGreaterThanOrEqual(-1e-9);

    const ultOff = report.off.rows.find((r) => r.abilityId === "overpower");
    const ultOn = report.on.rows.find((r) => r.abilityId === "overpower");
    expect(ultOff).toBeDefined();
    expect(ultOn).toBeDefined();
    expect(ultOn!.ringOfVigourRefund).toBe(10);
    expect(ultOff!.ringOfVigourRefund).toBe(0);
    expect(ultOn!.adrenalineAfter).toBe(ultOff!.adrenalineAfter + 10);
  });

  it("CoE + Vigour stack on ultimate residual (manual + revo)", () => {
    const manual = compareVigourManual({
      ...baseInput,
      startingAdrenaline: 100,
      rotation: rotationOf("berserk"),
      autoWeave: false,
      adrenaline: { conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND },
    });
    expect(manual.off.rows[0]!.conservationOfEnergyRefund).toBe(10);
    expect(manual.off.rows[0]!.ringOfVigourRefund).toBe(0);
    expect(manual.off.rows[0]!.adrenalineAfter).toBe(10);
    expect(manual.on.rows[0]!.conservationOfEnergyRefund).toBe(10);
    expect(manual.on.rows[0]!.ringOfVigourRefund).toBe(10);
    expect(manual.on.rows[0]!.adrenalineAfter).toBe(20);
    expect(manual.diagnostic?.kind).toBe("adrenaline-ledger-differs");

    const revo = compareVigourRevolution({
      ...melee,
      bar: bar("berserk", "assault"),
      durationTicks: 40,
      startingAdrenaline: 100,
      adrenaline: { conservationOfEnergyRefund: CONSERVATION_OF_ENERGY_REFUND },
    });
    expect(revo.off.summary.ok, revo.off.summary.error).toBe(true);
    expect(revo.on.summary.ok, revo.on.summary.error).toBe(true);
    const bOff = revo.off.rows.find((r) => r.abilityId === "berserk")!;
    const bOn = revo.on.rows.find((r) => r.abilityId === "berserk")!;
    expect(bOff.adrenalineAfter).toBe(10);
    expect(bOn.adrenalineAfter).toBe(20);
    expect(bOn.conservationOfEnergyRefund).toBe(10);
    expect(bOn.ringOfVigourRefund).toBe(10);
  });

  it("bad strict-priority bar: sequence diverges with diagnostic naming the spender", () => {
    // berserk first; residual 0 vs 10 changes how soon assault (25) is affordable.
    const report = compareVigourRevolution({
      ...melee,
      bar: bar("berserk", "assault"),
      durationTicks: 60,
      startingAdrenaline: 100,
    });
    expect(report.off.summary.ok, report.off.summary.error).toBe(true);
    expect(report.on.summary.ok, report.on.summary.error).toBe(true);
    expect(report.sequenceEqual).toBe(false);
    // Ultimate residual always hits first on the adren ledger.
    expect(report.diagnostic?.kind).toBe("adrenaline-ledger-differs");
    expect(report.sequenceDiagnostic?.kind).toBe("strict-priority-sequence-differs");
    if (report.sequenceDiagnostic?.kind !== "strict-priority-sequence-differs") {
      throw new Error(
        `off: ${formatTraceTimeline(report.off.rows)}\non: ${formatTraceTimeline(report.on.rows)}`,
      );
    }
    const d = report.sequenceDiagnostic;
    expect(d.namedAbility).toBe("assault");
    expect([d.abilityOff, d.abilityOn]).toContain("assault");
    expect(d.message).toContain("assault");
    expect(d.message).not.toMatch(/reduces damage/i);
    expect(report.firstDivergenceIndex).not.toBeNull();
    expect(report.firstDivergenceTick).not.toBeNull();
  });

  it("manual rotation path: fixed sequence, adren ledger diverges on ultimate", () => {
    // 0 residual + 3 basics = 27 >= assault 25; Vigour side is 10 ahead throughout.
    const report = compareVigourManual({
      ...baseInput,
      startingAdrenaline: 100,
      rotation: rotationOf("berserk", "attack", "attack", "attack", "assault"),
      autoWeave: false,
    });
    expect(report.mode).toBe("manual");
    expect(report.off.summary.ok, report.off.summary.error).toBe(true);
    expect(report.on.summary.ok, report.on.summary.error).toBe(true);
    expect(report.sequenceEqual).toBe(true);
    expect(report.sequenceDiagnostic).toBeNull();
    expect(report.firstDivergenceIndex).toBe(0);
    expect(report.diagnostic?.kind).toBe("adrenaline-ledger-differs");
    if (report.diagnostic?.kind === "adrenaline-ledger-differs") {
      expect(report.diagnostic.abilityId).toBe("berserk");
      expect(report.diagnostic.field).toBe("adrenalineAfter");
      expect(report.diagnostic.off).toBe(0);
      expect(report.diagnostic.on).toBe(10);
    }
    expect(report.off.sequence).toEqual(["berserk", "attack", "attack", "attack", "assault"]);
    expect(report.on.sequence).toEqual(report.off.sequence);
    expect(report.on.rows[4]!.adrenalineBefore).toBe(report.off.rows[4]!.adrenalineBefore + 10);
  });

  it("rows carry historyWeight and cumulative expected damage monotonically", () => {
    const report = compareVigourRevolution({
      ...melee,
      bar: bar("assault", "dismember"),
      durationTicks: 40,
      startingAdrenaline: 100,
    });
    const rows = report.off.rows;
    expect(rows.length).toBeGreaterThan(2);
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i]!.historyWeight).toBe(1);
      if (i > 0) {
        expect(rows[i]!.cumulativeExpectedDamage).toBeGreaterThanOrEqual(
          rows[i - 1]!.cumulativeExpectedDamage - 1e-12,
        );
      }
    }
    expect(rows[rows.length - 1]!.cumulativeExpectedDamage).toBeGreaterThan(0);
  });
});
