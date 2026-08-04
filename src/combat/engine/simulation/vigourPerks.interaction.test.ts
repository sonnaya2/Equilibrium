/**
 * Ring of Vigour with Relentless / Impatient: refund composition and damage honesty.
 */
import { describe, expect, it } from "vitest";
import { RING_OF_VIGOUR_REFUND } from "../../shared/ringOfVigour";
import { baseInput } from "../../test/fixtures/inputs";
import { rotationOf } from "./contracts";
import { createCastContext, simulate } from "./simulate";
import { isNearOne } from "./stats";

describe("Relentless free-spend + Vigour ultimate refund", () => {
  it("Relentless free threshold then ultimate still refunds +10 once", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { relentlessRank: 5, ringOfVigour: true },
    });
    const assault = ctx.byId.get("assault")!;
    const berserk = ctx.byId.get("berserk")!;

    expect(ctx.performCast(assault, 0, false, { relentless: true }).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(100);

    // Ultimate spends full cost (no Relentless override); Vigour refund +10 once.
    expect(ctx.performCast(berserk, ctx.firstLegalTick("berserk"), false).ok).toBe(true);
    expect(ctx.getState().adrenaline).toBe(RING_OF_VIGOUR_REFUND);

    const summary = ctx.finish();
    const freeCast = summary.casts.find((c) => c.abilityId === "assault")!;
    const ult = summary.casts.find((c) => c.abilityId === "berserk")!;
    expect(freeCast.adrenalineTransaction?.spendPreventedBy).toBe("relentless");
    expect(freeCast.adrenalineTransaction?.actualSpend).toBe(0);
    expect(freeCast.adrenalineTransaction?.ringOfVigourRefund ?? 0).toBe(0);
    expect(ult.adrenalineTransaction?.actualSpend).toBe(100);
    expect(ult.adrenalineTransaction?.ringOfVigourRefund).toBe(RING_OF_VIGOUR_REFUND);
    expect(ult.adrenalineTransaction?.spendPreventedBy).toBe("none");
    // Composition is +10 once, not double-counted with Relentless free-spend.
    expect(ult.adrenalineGained).toBe(RING_OF_VIGOUR_REFUND);
  });

  it("Relentless free ultimate + Vigour still applies +10 once (not zeroed by free spend)", () => {
    const ctx = createCastContext({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { relentlessRank: 5, ringOfVigour: true },
    });
    const berserk = ctx.byId.get("berserk")!;
    expect(ctx.performCast(berserk, 0, false, { relentless: true }).ok).toBe(true);
    // Free spend keeps 100; RoV +10 clamps at cap 100.
    expect(ctx.getState().adrenaline).toBe(100);
    const cast = ctx.finish().casts.at(-1)!;
    expect(cast.adrenalineTransaction?.spendPreventedBy).toBe("relentless");
    expect(cast.adrenalineTransaction?.actualSpend).toBe(0);
    expect(cast.adrenalineTransaction?.ringOfVigourRefund).toBe(RING_OF_VIGOUR_REFUND);
    // Ledger still records the single refund even when clamp hides the net gain.
    expect(cast.adrenalineGained).toBe(RING_OF_VIGOUR_REFUND);
  });

  it("stochastic Relentless ultimate with Vigour keeps +10 on every terminal class", () => {
    const s = simulate({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { relentlessRank: 5, ringOfVigour: true },
      rotation: rotationOf("berserk"),
    });
    expect(s.ok).toBe(true);
    expect(s.rng).toBeDefined();
    expect(isNearOne(s.rng!.probabilityMass + s.rng!.residualWeight)).toBe(true);
    // Representative path: no-proc leaves 10; proc path free + refund clamps at 100.
    const after = s.casts.at(-1)?.adrenalineAfter;
    expect(after === 10 || after === 100).toBe(true);
    const rovCast = s.casts.find((c) => c.abilityId === "berserk");
    expect(rovCast?.adrenalineTransaction?.ringOfVigourRefund).toBe(RING_OF_VIGOUR_REFUND);
  });
});

describe("controlled manual rotation: Vigour does not reduce damage", () => {
  it("no-RNG rotation: same casts with/without Vigour match totalExpected", () => {
    // No Impatient/Relentless: deterministic. Vigour only refunds after ultimate;
    // it cannot enable a new spender in this queue (no follow-up threshold).
    const rotation = rotationOf(
      "attack",
      "attack",
      "attack",
      "attack",
      "assault",
      "attack",
      "attack",
      "attack",
      "attack",
      "assault",
    );
    const plain = simulate({ ...baseInput, rotation });
    const withVigour = simulate({
      ...baseInput,
      adrenaline: { ringOfVigour: true },
      rotation,
    });
    expect(plain.ok).toBe(true);
    expect(withVigour.ok).toBe(true);
    expect(plain.rng).toBeUndefined();
    expect(withVigour.rng).toBeUndefined();
    expect(withVigour.totalExpected).toBeCloseTo(plain.totalExpected, 10);
    expect(withVigour.totalMin).toBeCloseTo(plain.totalMin, 10);
    expect(withVigour.totalMax).toBeCloseTo(plain.totalMax, 10);
    expect(withVigour.casts.map((c) => c.abilityId)).toEqual(plain.casts.map((c) => c.abilityId));
  });

  it("ultimate-only no-RNG: Vigour refunds adren but does not cut damage", () => {
    const rotation = rotationOf("berserk");
    const plain = simulate({
      ...baseInput,
      startingAdrenaline: 100,
      rotation,
    });
    const withVigour = simulate({
      ...baseInput,
      startingAdrenaline: 100,
      adrenaline: { ringOfVigour: true },
      rotation,
    });
    expect(plain.ok).toBe(true);
    expect(withVigour.ok).toBe(true);
    expect(plain.rng).toBeUndefined();
    expect(withVigour.rng).toBeUndefined();
    expect(withVigour.totalExpected).toBeCloseTo(plain.totalExpected, 10);
    expect(plain.casts[0]!.adrenalineAfter).toBe(0);
    expect(withVigour.casts[0]!.adrenalineAfter).toBe(RING_OF_VIGOUR_REFUND);
    expect(withVigour.casts[0]!.adrenalineTransaction?.ringOfVigourRefund).toBe(
      RING_OF_VIGOUR_REFUND,
    );
  });

  it("Impatient only does not change damage vs plain (adren-only perk)", () => {
    const rotation = rotationOf("attack", "attack", "attack");
    const plain = simulate({ ...baseInput, rotation });
    const impatient = simulate({
      ...baseInput,
      adrenaline: { impatientRank: 4 },
      rotation,
    });
    expect(impatient.ok).toBe(true);
    expect(impatient.totalExpected).toBeCloseTo(plain.totalExpected, 8);
    expect(isNearOne(impatient.rng!.probabilityMass + impatient.rng!.residualWeight)).toBe(true);
  });
});
