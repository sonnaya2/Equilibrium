import { describe, expect, it } from "vitest";
import { equipmentById } from "../../data";
import type { ItemPassiveId } from "../../data/records";
import {
  activeEquipmentEffects,
  type ActiveEquipmentEffects,
  type EquipmentEnchantmentId,
  type WeaponClass,
} from "../../shared/equipment";
import { MAGIC_ABILITIES } from "../../styles/magic/abilities";
import {
  BLAST_INFUSED_DURATION_TICKS,
  TSUNAMI_CRIT_ADREN_DURATION_TICKS,
  TSUNAMI_CRIT_ADREN_PCT,
} from "../../styles/magic/effects";
import { rotationOf } from "./contracts";
import { createCastContext } from "./context";
import { simulate, type SimulateInput } from "./simulate";
import {
  expandTsunamiCritAdrenOnLand,
  tsunamiCritChanceFromDamage,
} from "./tsunamiCritBranch";
import { createRuntime } from "../runtime/runtime";
import { gainAdrenaline, patchMagic } from "../runtime/state";
import { packageCritical } from "../resolution/types";
import { buildBranchKey } from "./branchKey";

function rankingSlice(summary: {
  ok: boolean;
  error?: string;
  horizonTicks?: number;
  totalExpected: number;
  damageByTick: Record<number, number>;
  rng?: {
    failedWeight?: number;
    residualWeight?: number;
    exactness?: string;
    concreteMass?: number;
    probabilityMass?: number;
  };
}) {
  const tickKeys = Object.keys(summary.damageByTick)
    .map(Number)
    .sort((a, b) => a - b);
  return {
    ok: summary.ok,
    error: summary.error,
    horizonTicks: summary.horizonTicks,
    totalExpected: summary.totalExpected,
    damageByTick: Object.fromEntries(tickKeys.map((t) => [t, summary.damageByTick[t]])),
    rng: summary.rng
      ? {
          failedWeight: summary.rng.failedWeight ?? 0,
          residualWeight: summary.rng.residualWeight ?? 0,
          exactness: summary.rng.exactness,
          concreteMass: summary.rng.concreteMass ?? summary.rng.probabilityMass,
        }
      : undefined,
  };
}

const magicBase: Omit<SimulateInput, "rotation"> = {
  base: 1000,
  level: 99,
  accuracy: 1,
  crit: { chance: 0 },
  abilities: MAGIC_ABILITIES,
  context: { style: "magic" },
  startingAdrenaline: 100,
};

function itemEffects(
  passiveIds: ItemPassiveId[],
  enchantments: EquipmentEnchantmentId[] = [],
  weaponClass: WeaponClass | null = null,
): ActiveEquipmentEffects {
  return {
    ...activeEquipmentEffects({ style: "magic" }),
    passiveIds,
    enchantments,
    weaponClass,
    passage: {
      active: false,
      agonyActive: false,
    },
  };
}

describe("Tsunami crit-adren window", () => {
  it("arms the window on Tsunami land and grants nothing on zero-crit path", () => {
    const ctx = createCastContext({
      ...magicBase,
      crit: { chance: 0 },
    });
    const tsunami = ctx.byId.get("tsunami")!;
    const attack = ctx.byId.get("magic_attack")!;
    ctx.performCast(tsunami, 0, false);
    const afterT = ctx.getState();
    expect(afterT.magic.tsunamiCritAdrenUntilTick).toBe(TSUNAMI_CRIT_ADREN_DURATION_TICKS);
    const adrenAfterTsunami = afterT.adrenaline;
    ctx.performCast(attack, ctx.getState().tick, false);
    // magic_attack listed +9; zero crit → no Tsunami grant.
    expect(ctx.getState().adrenaline).toBe(adrenAfterTsunami + 9);
    expect(ctx.getState().magic.tsunamiCritAdrenUntilTick).toBe(TSUNAMI_CRIT_ADREN_DURATION_TICKS);
  });

  it("Tsunami own guaranteed crit grants +8 on the same land", () => {
    const ctx = createCastContext({
      ...magicBase,
      crit: { chance: 1, guaranteed: true },
      startingAdrenaline: 100,
    });
    ctx.performCast(ctx.byId.get("tsunami")!, 0, false);
    // Ultimate spend 100; own crit grant +8 → adren 8 (cap-aware).
    expect(ctx.getState().adrenaline).toBe(TSUNAMI_CRIT_ADREN_PCT);
    expect(ctx.getState().magic.tsunamiCritAdrenUntilTick).toBe(TSUNAMI_CRIT_ADREN_DURATION_TICKS);
  });

  it("guaranteed multi-hit Smoke Tendrils grants +8 per hit deterministically", () => {
    const ctx = createCastContext({
      ...magicBase,
      crit: { chance: 0 },
      startingAdrenaline: 100,
    });
    ctx.performCast(ctx.byId.get("tsunami")!, 0, false);
    expect(ctx.getState().adrenaline).toBe(0);
    expect(ctx.getState().magic.tsunamiCritAdrenUntilTick).toBeGreaterThan(0);
    // Smoke: 4 guaranteed-crit hits; drain tails past GCD via a later basic.
    ctx.performCast(ctx.byId.get("smoke_tendrils")!, ctx.getState().tick, false);
    ctx.performCast(ctx.byId.get("magic_attack")!, ctx.getState().tick + 20, false);
    // 4 * 8 (smoke) + 9 (basic) = 41
    expect(ctx.getState().adrenaline).toBe(4 * TSUNAMI_CRIT_ADREN_PCT + 9);
  });

  it("Natural Instinct doubles Tsunami crit grants to 16", () => {
    const s = simulate({
      ...magicBase,
      crit: { chance: 1, guaranteed: true },
      startingAdrenaline: 100,
      naturalInstinctUntilTick: 200,
      rotation: rotationOf("tsunami"),
    });
    expect(s.ok).toBe(true);
    expect(s.casts[0].adrenalineAfter).toBe(16);
  });

  it("window expires: no grant on first tick at until", () => {
    const ctx = createCastContext({
      ...magicBase,
      crit: { chance: 1, guaranteed: true },
      startingAdrenaline: 100,
    });
    ctx.performCast(ctx.byId.get("tsunami")!, 0, false);
    const until = ctx.getState().magic.tsunamiCritAdrenUntilTick;
    expect(until).toBe(50);
    const attack = ctx.byId.get("magic_attack")!;
    const adrenBefore = ctx.getState().adrenaline;
    // Half-open: tick === until is inactive.
    ctx.performCast(attack, until, false);
    expect(ctx.getState().adrenaline).toBe(adrenBefore + 9);
  });

  it("crit-ineligible DoT ticks grant nothing while window live", () => {
    const ctx = createCastContext({
      ...magicBase,
      crit: { chance: 1, guaranteed: true },
      startingAdrenaline: 100,
    });
    ctx.performCast(ctx.byId.get("tsunami")!, 0, false);
    expect(ctx.getState().adrenaline).toBe(8);
    ctx.performCast(ctx.byId.get("combust")!, ctx.getState().tick, false);
    const afterCast = ctx.getState().adrenaline;
    const s = ctx.finish();
    expect(s.ok).toBe(true);
    // Combust hits are DoT (procEligible false): no +8 per tick.
    expect(s.casts.at(-1)!.adrenalineAfter).toBe(afterCast);
  });

  it("independent multi-hit Bernoulli preserves mass", () => {
    // After Tsunami (p=0 own hit), window is live; magic_attack lands with p=0.5.
    const s = simulate({
      ...magicBase,
      crit: { chance: 0.5 },
      startingAdrenaline: 100,
      rotation: rotationOf("tsunami", "magic_attack", "magic_attack"),
    });
    expect(s.ok).toBe(true);
    expect(s.rng).toBeDefined();
    const mass = (s.rng!.probabilityMass ?? 0) + (s.rng!.residualWeight ?? 0);
    expect(mass).toBeCloseTo(1, 8);
    expect(s.rng!.residualWeight).toBe(0);
  });

  it("branch key expires tsunami window to 0 for merge equivalence", () => {
    const input = { ...magicBase, rotation: rotationOf("magic_attack") };
    const rt = createRuntime(input);
    rt.state = patchMagic(rt.state, { tsunamiCritAdrenUntilTick: 10 });
    rt.state = { ...rt.state, tick: 10 };
    const kExpired = buildBranchKey(rt);
    rt.state = patchMagic(rt.state, { tsunamiCritAdrenUntilTick: 0 });
    const kZero = buildBranchKey(rt);
    expect(kExpired).toBe(kZero);
  });

  it("at-cap grants do not fork", () => {
    const input = { ...magicBase, rotation: rotationOf("magic_attack"), startingAdrenaline: 100 };
    const rt = createRuntime(input);
    rt.state = patchMagic(rt.state, { tsunamiCritAdrenUntilTick: 50 });
    rt.state = gainAdrenaline(rt.state, 1000);
    const set = expandTsunamiCritAdrenOnLand({ weight: 1, rt }, 0, 0.4);
    expect(set.branches).toHaveLength(1);
    expect(set.residualWeight).toBe(0);
  });

  it("expand forks mass p / 1-p without changing damage ledger", () => {
    const input = { ...magicBase, rotation: rotationOf("magic_attack"), startingAdrenaline: 0 };
    const rt = createRuntime(input);
    rt.state = patchMagic(rt.state, { tsunamiCritAdrenUntilTick: 50 });
    rt.totalExpected = 999;
    const set = expandTsunamiCritAdrenOnLand({ weight: 1, rt }, 0, 0.25);
    expect(set.branches).toHaveLength(2);
    const mass = set.branches.reduce((s, b) => s + b.weight, 0);
    expect(mass).toBeCloseTo(1, 12);
    const crit = set.branches.find((b) => b.rt.state.adrenaline === 8)!;
    const non = set.branches.find((b) => b.rt.state.adrenaline === 0)!;
    expect(crit.weight).toBeCloseTo(0.25, 12);
    expect(non.weight).toBeCloseTo(0.75, 12);
    expect(crit.rt.totalExpected).toBe(999);
    expect(non.rt.totalExpected).toBe(999);
  });

  it("tsunamiCritChanceFromDamage reads critical package", () => {
    expect(
      tsunamiCritChanceFromDamage({
        min: 0,
        max: 1,
        expected: 0.5,
        critical: packageCritical(0.3, 1, 0),
      }),
    ).toBeCloseTo(0.3);
  });

  it("score-only matches full-analysis ranking under mid-crit Tsunami rotation", () => {
    const input = {
      ...magicBase,
      crit: { chance: 0.4 },
      startingAdrenaline: 100,
      rotation: rotationOf("tsunami", "magic_attack", "magic_attack", "sonic_wave"),
    };
    const full = simulate(input, { detailLevel: "full-analysis" });
    const scoreOnly = simulate(input, { detailLevel: "score-only" });
    expect(full.ok && scoreOnly.ok).toBe(true);
    expect(scoreOnly.totalExpected).toBe(full.totalExpected);
    expect(rankingSlice(scoreOnly)).toEqual(rankingSlice(full));
    expect(scoreOnly.events).toEqual([]);
    expect(scoreOnly.casts).toEqual([]);
    if (scoreOnly.rng) {
      const mass =
        (scoreOnly.rng.probabilityMass ?? 0) + (scoreOnly.rng.residualWeight ?? 0);
      expect(mass).toBeCloseTo(1, 8);
      expect(scoreOnly.rng.exactness).toBe(full.rng?.exactness);
    }
  });
});

describe("Chain primary non-inflation", () => {
  it("Chain then Sonic does not add secondary damage on primary", () => {
    const withChain = simulate({
      ...magicBase,
      startingAdrenaline: 0,
      rotation: rotationOf("chain", "sonic_wave"),
    });
    const sonicOnly = simulate({
      ...magicBase,
      startingAdrenaline: 0,
      rotation: rotationOf("sonic_wave"),
    });
    expect(withChain.ok && sonicOnly.ok).toBe(true);
    const sonicWith = withChain.casts.find((c) => c.abilityId === "sonic_wave")!;
    const sonicBare = sonicOnly.casts.find((c) => c.abilityId === "sonic_wave")!;
    expect(sonicWith.result.expected).toBeCloseTo(sonicBare.result.expected, 10);
    expect(sonicWith.result.hits).toHaveLength(sonicBare.result.hits.length);
  });
});

describe("Claws of Guthix support honesty", () => {
  it("keeps cast band only and is partially-modeled", () => {
    const cog = MAGIC_ABILITIES.find((a) => a.id === "claws_of_guthix")!;
    expect(cog.supportStatus).toBe("partially-modeled");
    const s = simulate({
      ...magicBase,
      startingAdrenaline: 100,
      rotation: rotationOf("claws_of_guthix"),
    });
    expect(s.ok).toBe(true);
    // 200-240% @ base 1000 accuracy 1 → mid 2200 without other layers.
    expect(s.casts[0].result.expected).toBeCloseTo(2200, 5);
  });
});

describe("Blast Infused equipment", () => {
  it("Wild Magic arms window when boots passive present; basics scale +8%", () => {
    const boots = itemEffects(["blast-diffusion-inner-wrath"]);
    const withBoots = simulate({
      ...magicBase,
      equipmentEffects: boots,
      startingAdrenaline: 100,
      rotation: rotationOf("wild_magic", "sonic_wave"),
    });
    const bare = simulate({
      ...magicBase,
      startingAdrenaline: 100,
      rotation: rotationOf("wild_magic", "sonic_wave"),
    });
    expect(withBoots.ok && bare.ok).toBe(true);
    expect(withBoots.casts[0]).toBeDefined();
    // Window armed on WM cast.
    const ctx = createCastContext({
      ...magicBase,
      equipmentEffects: boots,
      startingAdrenaline: 100,
    });
    ctx.performCast(ctx.byId.get("wild_magic")!, 0, false);
    expect(ctx.getState().magic.blastInfusedUntilTick).toBe(BLAST_INFUSED_DURATION_TICKS);
    const sonicWith = withBoots.casts.find((c) => c.abilityId === "sonic_wave")!;
    const sonicBare = bare.casts.find((c) => c.abilityId === "sonic_wave")!;
    // Intermediate floor in the modifier pipeline → ratio ≈ 1.08, not exact.
    expect(sonicWith.result.expected / sonicBare.result.expected).toBeCloseTo(1.08, 2);
    expect(sonicWith.result.expected).toBeGreaterThan(sonicBare.result.expected);
  });

  it("no window without passive", () => {
    const ctx = createCastContext({
      ...magicBase,
      startingAdrenaline: 100,
    });
    ctx.performCast(ctx.byId.get("wild_magic")!, 0, false);
    expect(ctx.getState().magic.blastInfusedUntilTick).toBe(0);
  });

  it("loads passive from equipment records into activeEquipmentEffects and arms Blast Infused", () => {
    const boots = equipmentById("item:blast-diffusion-boots");
    const enhanced = equipmentById("item:enhanced-blast-diffusion-boots");
    expect(boots?.passiveId).toBe("blast-diffusion-inner-wrath");
    expect(enhanced?.passiveId).toBe("blast-diffusion-inner-wrath");

    const fromBoots = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: { boots: "item:blast-diffusion-boots" },
    });
    expect(fromBoots.passiveIds).toContain("blast-diffusion-inner-wrath");

    const fromEnhanced = activeEquipmentEffects({
      style: "magic",
      equipmentSlots: { boots: "item:enhanced-blast-diffusion-boots" },
    });
    expect(fromEnhanced.passiveIds).toContain("blast-diffusion-inner-wrath");

    const ctx = createCastContext({
      ...magicBase,
      equipmentEffects: fromBoots,
      startingAdrenaline: 100,
    });
    ctx.performCast(ctx.byId.get("wild_magic")!, 0, false);
    expect(ctx.getState().magic.blastInfusedUntilTick).toBe(BLAST_INFUSED_DURATION_TICKS);

    const withBoots = simulate({
      ...magicBase,
      equipmentEffects: fromBoots,
      startingAdrenaline: 100,
      rotation: rotationOf("wild_magic", "sonic_wave"),
    });
    const bare = simulate({
      ...magicBase,
      startingAdrenaline: 100,
      rotation: rotationOf("wild_magic", "sonic_wave"),
    });
    expect(withBoots.ok && bare.ok).toBe(true);
    const sonicWith = withBoots.casts.find((c) => c.abilityId === "sonic_wave")!;
    const sonicBare = bare.casts.find((c) => c.abilityId === "sonic_wave")!;
    expect(sonicWith.result.expected / sonicBare.result.expected).toBeCloseTo(1.08, 2);
  });
});

describe("Support labels", () => {
  it("marks chain / greater_chain / claws / tsunami partial", () => {
    for (const id of ["chain", "greater_chain", "claws_of_guthix", "tsunami"]) {
      const a = MAGIC_ABILITIES.find((x) => x.id === id)!;
      expect(a.supportStatus, id).toBe("partially-modeled");
      expect(a.supportNote, id).toBeTruthy();
    }
  });
});

describe("Tsunami branch performance (critical-heavy)", () => {
  it("long mid-crit rotation under window discloses residual without silent mass loss", () => {
    const basics = Array.from({ length: 24 }, () => "magic_attack" as const);
    const s = simulate({
      ...magicBase,
      crit: { chance: 0.4 },
      startingAdrenaline: 100,
      rotation: rotationOf("tsunami", ...basics),
      horizonTicks: 120,
    });
    expect(s.ok).toBe(true);
    const rng = s.rng;
    if (!rng) {
      // Single-branch collapse still conserves mass.
      expect(s.totalExpected).toBeGreaterThan(0);
      return;
    }
    const conserved = rng.probabilityMass + (rng.residualWeight ?? 0);
    expect(conserved).toBeCloseTo(1, 6);
    if ((rng.residualWeight ?? 0) > 1e-9) {
      expect(rng.exactness).toBe("approximated");
    }
  });
});
