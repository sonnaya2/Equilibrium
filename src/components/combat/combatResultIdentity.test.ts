import { describe, expect, it } from "vitest";
import { emptyBuild, type RegionId } from "@/league";
import { archaeologySelectBlockReason } from "@/combat/shared/archaeologyRelics";
import { FULL_SLAYER_HELMET_ITEM_ID } from "@/combat/shared/slayerHelmet";
import { stableStringify } from "@/combat/solver/fingerprint";
import {
  canonicalSimulationIdentity,
  isVerifiedCacheableResult,
  resultMatchesRequestIdentity,
  solveIdentityFromRequest,
} from "@/combat/solver/identity";
import { packSolverRequest } from "@/combat/solver/packRequest";
import { isSerializableSimBase } from "@/combat/solver/worker/serializable";
import type { SolverResultDTO } from "@/combat/solver/worker/serializable";
import {
  emptyBarLibrary,
  isScoreVerifiedForContext,
  withPermanentBar,
  withRecentBar,
} from "./revoBarLibrary";
import { DEFAULT_LOADOUT, type Loadout } from "./loadout/model";
import { loadoutStats } from "./loadoutStats";
import { solverSnapshotFromResolvedModel } from "./solverSnapshot";
import { toResolvedCombatModel } from "./toResolvedCombatModel";
import { uiRunFingerprint } from "./uiSimFingerprint";

const NOW = 1_700_000_000_000;

const TARGET_DEFAULTS = { defenceLevel: 80, affinity: "same" as const };

function withLoadout(patch: Partial<Loadout>): Loadout {
  return {
    ...DEFAULT_LOADOUT,
    ...patch,
    buffs: { ...DEFAULT_LOADOUT.buffs, ...patch.buffs },
    perks: { ...DEFAULT_LOADOUT.perks, ...patch.perks },
    archaeology: patch.archaeology
      ? { ...DEFAULT_LOADOUT.archaeology, ...patch.archaeology }
      : DEFAULT_LOADOUT.archaeology,
    equipmentSlots: { ...DEFAULT_LOADOUT.equipmentSlots, ...patch.equipmentSlots },
    baseDamage: patch.baseDamage ?? DEFAULT_LOADOUT.baseDamage,
    target:
      patch.target === undefined
        ? DEFAULT_LOADOUT.target
        : patch.target === null
          ? null
          : { ...TARGET_DEFAULTS, ...patch.target },
  };
}

function packFromLoadout(
  loadout: Loadout,
  options: { now?: number; unlockedRegions?: readonly RegionId[] } = {},
) {
  const now = options.now ?? NOW;
  const unlockedRegions = options.unlockedRegions;
  const stats = loadoutStats(loadout, {
    now,
    ...(unlockedRegions ? { unlockedRegions: [...unlockedRegions] } : {}),
  });
  const combatModel = toResolvedCombatModel(
    loadout,
    {
      now,
      ...(unlockedRegions ? { unlockedRegions: [...unlockedRegions] } : {}),
    },
    stats,
  );
  const snapshot = solverSnapshotFromResolvedModel(combatModel);
  const request = packSolverRequest({
    model: combatModel,
    style: combatModel.style,
    build: emptyBuild(),
    now,
    ...(unlockedRegions ? { useBuildRegions: false, unlockedRegions } : {}),
  });
  return { stats, snapshot, request, combatModel };
}

function simIdentityString(request: ReturnType<typeof packFromLoadout>["request"]): string {
  if (!isSerializableSimBase(request.loadout)) throw new Error("expected sim base");
  return stableStringify(canonicalSimulationIdentity(request.loadout));
}

function verifiedDto(overrides: Partial<SolverResultDTO> = {}): SolverResultDTO {
  return {
    bar: ["a", "b", "c", "d", "e", "f"],
    score: 12_000,
    windowDpms: 0,
    evaluations: 100,
    uniqueCandidates: 40,
    seed: 1,
    profileId: "balanced",
    tier: "thorough",
    durationTicks: 500,
    solveIdentity: "",
    proofLabel: "heuristic-best-found",
    bestFullScore: 12_000,
    proof: { label: "heuristic-best-found" },
    top: [],
    ...overrides,
  };
}

describe("combat result identity (stale-result product rule)", () => {
  describe("material sim input changes shared simulation identity", () => {
    it("base damage change invalidates packed sim identity and ui fingerprint", () => {
      const loadoutA = withLoadout({ baseDamage: { mode: "manual", manualValue: 2_000 } });
      const loadoutB = withLoadout({ baseDamage: { mode: "manual", manualValue: 2_500 } });
      const a = packFromLoadout(loadoutA);
      const b = packFromLoadout(loadoutB);
      expect(a.stats.base).toBe(2_000);
      expect(b.stats.base).toBe(2_500);
      expect(simIdentityString(a.request)).not.toBe(simIdentityString(b.request));
      expect(solveIdentityFromRequest(a.request)).not.toBe(solveIdentityFromRequest(b.request));

      const revoA = {
        mode: "revolution" as const,
        stats: a.stats,
        combatModel: a.combatModel,
        barIds: ["slice", "fury"] as const,
        durationSeconds: 60,
        style: "melee",
      };
      expect(uiRunFingerprint(revoA)).not.toBe(
        uiRunFingerprint({
          ...revoA,
          stats: b.stats,
          combatModel: b.combatModel,
        }),
      );
    });

    it("powerburst remaining ticks (exact) change packed sim identity", () => {
      const loadout = withLoadout({
        buffs: {
          ...DEFAULT_LOADOUT.buffs,
          powerburstOfVitalityUntil: NOW + 6_000,
        },
      });
      const active = packFromLoadout(loadout, { now: NOW });
      const expired = packFromLoadout(loadout, { now: NOW + 6_000 });
      expect(active.stats.league.powerburstUntilTick).toBe(10);
      expect(expired.stats.league.powerburstUntilTick).toBe(0);
      expect(active.snapshot.league.powerburstUntilTick).toBe(10);
      expect(expired.snapshot.league.powerburstUntilTick).toBe(0);
      expect(simIdentityString(active.request)).not.toBe(simIdentityString(expired.request));
      if (!isSerializableSimBase(active.request.loadout)) throw new Error("sim");
      if (!isSerializableSimBase(expired.request.loadout)) throw new Error("sim");
      expect(active.request.loadout.league.powerburstUntilTick).toBe(10);
      expect(expired.request.loadout.league.powerburstUntilTick).toBe(0);
    });

    it("target race flags flow through packed snapshot into sim identity", () => {
      const neutral = packFromLoadout(
        withLoadout({
          target: { defenceLevel: 80, affinity: "same" },
        }),
      );
      const demon = packFromLoadout(
        withLoadout({
          target: { defenceLevel: 80, affinity: "same", demon: true },
        }),
      );
      expect(neutral.snapshot.target?.demon).not.toBe(true);
      expect(demon.snapshot.target?.demon).toBe(true);
      if (!isSerializableSimBase(neutral.request.loadout)) throw new Error("sim");
      if (!isSerializableSimBase(demon.request.loadout)) throw new Error("sim");
      expect(neutral.request.loadout.modifierSources.target.demon).not.toBe(true);
      expect(demon.request.loadout.modifierSources.target.demon).toBe(true);
      expect(simIdentityString(neutral.request)).not.toBe(simIdentityString(demon.request));
      expect(solveIdentityFromRequest(neutral.request)).not.toBe(
        solveIdentityFromRequest(demon.request),
      );
    });

    it("berserkers fury bonus via life changes packed sim identity", () => {
      const baseArch = {
        archaeology: { selectedIds: ["berserkers_fury"], energyCap: 500 as const },
        buffs: { ...DEFAULT_LOADOUT.buffs, berserkersFury: false },
      };
      const full = packFromLoadout(
        withLoadout({
          ...baseArch,
          currentLife: null,
          currentHealthPercent: 100,
        }),
      );
      const half = packFromLoadout(
        withLoadout({
          ...baseArch,
          currentLife: null,
          currentHealthPercent: 50,
        }),
      );
      expect(full.stats.berserkersFury.bonus).toBe(0);
      expect(half.stats.berserkersFury.bonus).toBe(0.03);
      expect(full.snapshot.berserkersFuryBonus).toBe(0);
      expect(half.snapshot.berserkersFuryBonus).toBe(0.03);
      if (!isSerializableSimBase(full.request.loadout)) throw new Error("sim");
      if (!isSerializableSimBase(half.request.loadout)) throw new Error("sim");
      expect(full.request.loadout.modifierSources.berserkersFuryBonus).toBe(0);
      expect(half.request.loadout.modifierSources.berserkersFuryBonus).toBe(0.03);
      expect(simIdentityString(full.request)).not.toBe(simIdentityString(half.request));
    });

    it("Kal-Ket cape changes solve identity and uiRunFingerprint with barIds fixed", () => {
      const bare = packFromLoadout(withLoadout({ equipmentSlots: {} }));
      const withKet = packFromLoadout(
        withLoadout({ equipmentSlots: { cape: "item:igneous-kal-ket" } }),
      );
      expect(withKet.stats.equipmentEffects.passiveIds).toContain("igneous-overpower");
      expect(bare.stats.equipmentEffects.passiveIds).not.toContain("igneous-overpower");
      expect(simIdentityString(bare.request)).not.toBe(simIdentityString(withKet.request));
      expect(solveIdentityFromRequest(bare.request)).not.toBe(
        solveIdentityFromRequest(withKet.request),
      );

      const barIds = ["overpower"] as const;
      const revoBare = {
        mode: "revolution" as const,
        stats: bare.stats,
        combatModel: bare.combatModel,
        barIds,
        durationSeconds: 60,
        style: "melee",
      };
      expect(uiRunFingerprint(revoBare)).not.toBe(
        uiRunFingerprint({
          ...revoBare,
          stats: withKet.stats,
          combatModel: withKet.combatModel,
        }),
      );
    });
  });

  describe("bar library score verification is context-bound", () => {
    it("verified under loadout context A is not verified under context B", () => {
      const contextA = solveIdentityFromRequest(
        packFromLoadout(withLoadout({ baseDamage: { mode: "manual", manualValue: 2_000 } }))
          .request,
      );
      const contextB = solveIdentityFromRequest(
        packFromLoadout(withLoadout({ baseDamage: { mode: "manual", manualValue: 3_000 } }))
          .request,
      );
      expect(contextA).not.toBe(contextB);
      expect(contextA.length).toBeGreaterThan(0);

      const bar = ["slice", "fury", "assault", "destroy", "pulverise"] as const;
      const entry = withPermanentBar(emptyBarLibrary(), {
        bar,
        style: "melee",
        score: 50_000,
        now: 1,
        verified: true,
        scoreContext: contextA,
      }).saved[0]!;

      expect(entry.verified).toBe(true);
      expect(entry.scoreContext).toBe(contextA);
      expect(isScoreVerifiedForContext(entry, contextA)).toBe(true);
      expect(isScoreVerifiedForContext(entry, contextB)).toBe(false);
      expect(isScoreVerifiedForContext(entry, null)).toBe(false);

      const recent = withRecentBar(emptyBarLibrary(), {
        bar,
        style: "melee",
        score: 40_000,
        now: 2,
        verified: true,
        scoreContext: contextA,
      }).recents[0]!;
      expect(isScoreVerifiedForContext(recent, contextA)).toBe(true);
      expect(isScoreVerifiedForContext(recent, contextB)).toBe(false);
    });
  });

  describe("solveIdentity mismatch rejects verified cache", () => {
    it("resultMatchesRequestIdentity and isVerifiedCacheableResult gate stale stamps", () => {
      const request = packFromLoadout(
        withLoadout({ baseDamage: { mode: "manual", manualValue: 2_000 } }),
      ).request;
      const identity = solveIdentityFromRequest(request);
      const otherIdentity = solveIdentityFromRequest(
        packFromLoadout(withLoadout({ baseDamage: { mode: "manual", manualValue: 2_100 } }))
          .request,
      );
      expect(identity).not.toBe(otherIdentity);

      expect(resultMatchesRequestIdentity(request, verifiedDto({ solveIdentity: identity }))).toBe(
        true,
      );
      expect(
        resultMatchesRequestIdentity(request, verifiedDto({ solveIdentity: otherIdentity })),
      ).toBe(false);
      expect(resultMatchesRequestIdentity(request, verifiedDto({ solveIdentity: "" }))).toBe(false);

      expect(isVerifiedCacheableResult(request, verifiedDto({ solveIdentity: identity }))).toBe(
        true,
      );
      expect(
        isVerifiedCacheableResult(request, verifiedDto({ solveIdentity: otherIdentity })),
      ).toBe(false);
      expect(
        isVerifiedCacheableResult(request, verifiedDto({ solveIdentity: identity + "stale" })),
      ).toBe(false);
    });
  });

  describe("archaeology region gate for berserkers_fury", () => {
    it("region_locked without morytania; allowed with morytania", () => {
      expect(
        archaeologySelectBlockReason({
          relicId: "berserkers_fury",
          selectedIds: [],
          energyCap: 500,
          unlockedRegions: ["misthalin", "kandarin"],
        }),
      ).toBe("region_locked");
      expect(
        archaeologySelectBlockReason({
          relicId: "berserkers_fury",
          selectedIds: [],
          energyCap: 500,
          unlockedRegions: ["morytania"],
        }),
      ).toBeNull();
    });
  });

  describe("model pack copies pre-resolved slayerHelmet without re-resolve", () => {
    it("copies pre-resolved descriptor through model pack", () => {
      const loadout = withLoadout({
        equipmentSlots: { helmet: FULL_SLAYER_HELMET_ITEM_ID },
        target: {
          defenceLevel: 80,
          affinity: "same",
          onSlayerTask: true,
        },
      });
      const { stats, snapshot, request, combatModel } = packFromLoadout(loadout);
      expect(stats.slayerHelmet).toMatchObject({
        tierId: "full",
        source: "equipped",
        damageMult: 1.075,
      });
      expect(snapshot.slayerHelmet).toEqual(stats.slayerHelmet);
      expect(combatModel.modifierSources.slayerHelmet).toEqual(stats.slayerHelmet);
      if (!isSerializableSimBase(request.loadout)) throw new Error("sim");
      expect(request.loadout.modifierSources.slayerHelmet).toEqual(stats.slayerHelmet);

      const inactive = packFromLoadout(
        withLoadout({
          buffs: { ...DEFAULT_LOADOUT.buffs, slayerHelmetStand: "corrupted" },
          target: { defenceLevel: 80, affinity: "same", onSlayerTask: true },
        }),
        { unlockedRegions: ["misthalin"] },
      );
      expect(inactive.stats.slayerHelmet).toBeNull();
      expect(inactive.snapshot.slayerHelmet).toBeNull();
      expect(inactive.combatModel.modifierSources.slayerHelmet).toBeNull();
      if (!isSerializableSimBase(inactive.request.loadout)) throw new Error("sim");
      expect(inactive.request.loadout.modifierSources.slayerHelmet).toBeNull();
    });
  });
});

describe("end-to-end: stale score never verifies after material change", () => {
  it("bar verified for request A fails isScoreVerifiedForContext under request B identity", () => {
    const reqA = packFromLoadout(
      withLoadout({
        target: { defenceLevel: 80, affinity: "same", demon: false },
        baseDamage: { mode: "manual", manualValue: 1_800 },
      }),
    ).request;
    const reqB = packFromLoadout(
      withLoadout({
        target: { defenceLevel: 80, affinity: "same", demon: true },
        baseDamage: { mode: "manual", manualValue: 1_800 },
      }),
    ).request;
    const idA = solveIdentityFromRequest(reqA);
    const idB = solveIdentityFromRequest(reqB);
    expect(idA).not.toBe(idB);

    const library = withPermanentBar(emptyBarLibrary(), {
      bar: ["slice", "fury", "assault", "destroy", "pulverise"],
      style: "melee",
      score: 99_999,
      now: 10,
      verified: true,
      scoreContext: idA,
    });
    const entry = library.saved[0]!;
    expect(isScoreVerifiedForContext(entry, idA)).toBe(true);
    expect(isScoreVerifiedForContext(entry, idB)).toBe(false);

    const dto = verifiedDto({ solveIdentity: idA, bar: entry.bar, score: 99_999 });
    expect(isVerifiedCacheableResult(reqA, dto)).toBe(true);
    expect(isVerifiedCacheableResult(reqB, dto)).toBe(false);
    expect(resultMatchesRequestIdentity(reqB, dto)).toBe(false);
  });
});
