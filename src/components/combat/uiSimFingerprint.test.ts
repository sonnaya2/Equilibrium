import { describe, expect, it } from "vitest";
import { DEFAULT_LOADOUT, normalizeLoadout, type Loadout } from "./loadout/model";
import { loadoutStats } from "./loadoutStats";
import { toResolvedCombatModel } from "./toResolvedCombatModel";
import { uiRunFingerprint } from "./uiSimFingerprint";

const TARGET_DEFAULTS = { defenceLevel: 80, affinity: "same" as const };

function withLoadout(patch: Partial<Loadout>): Loadout {
  return normalizeLoadout({
    ...DEFAULT_LOADOUT,
    ...patch,
    perks: { ...DEFAULT_LOADOUT.perks, ...patch.perks },
    buffs: { ...DEFAULT_LOADOUT.buffs, ...patch.buffs },
    target:
      patch.target === undefined
        ? DEFAULT_LOADOUT.target
        : patch.target === null
          ? null
          : { ...TARGET_DEFAULTS, ...patch.target },
  });
}

function resolve(loadout: Loadout, now?: number) {
  const opts = now != null ? { now } : {};
  const stats = loadoutStats(loadout, opts);
  const combatModel = toResolvedCombatModel(loadout, opts, stats);
  return { stats, combatModel };
}

describe("uiRunFingerprint", () => {
  const baseLoadout = normalizeLoadout(DEFAULT_LOADOUT);
  const { stats, combatModel } = resolve(baseLoadout);

  const manualParts = {
    mode: "manual" as const,
    stats,
    combatModel,
    queue: ["attack", "rend"] as const,
    autoWeave: true,
    ammo: "none",
    useBuild: true,
  };

  it("same inputs produce equal fingerprints", () => {
    const a = uiRunFingerprint(manualParts);
    const b = uiRunFingerprint({ ...manualParts, queue: ["attack", "rend"] });
    expect(a).toBe(b);
  });

  it("changing base invalidates fingerprint", () => {
    const higher = withLoadout({
      baseDamage: { mode: "manual", manualValue: 2_100 },
    });
    const { stats: higherStats, combatModel: higherModel } = resolve(higher);
    expect(higherModel.base).not.toBe(combatModel.base);
    expect(
      uiRunFingerprint({
        ...manualParts,
        stats: higherStats,
        combatModel: higherModel,
      }),
    ).not.toBe(uiRunFingerprint(manualParts));
  });

  it("changing queue invalidates fingerprint", () => {
    const other = {
      ...manualParts,
      queue: ["attack", "assault"] as const,
    };
    expect(uiRunFingerprint(other)).not.toBe(uiRunFingerprint(manualParts));
  });

  it("cosmetic-unrelated fields are not part of fingerprint inputs", () => {
    // Fingerprint only reads ManualRunFingerprintParts / RevolutionRunFingerprintParts.
    // Analysis UI open state is intentionally excluded from the parts object.
    const again = uiRunFingerprint({
      mode: "manual",
      stats,
      combatModel,
      queue: ["attack", "rend"],
      autoWeave: true,
      ammo: "none",
      useBuild: true,
    });
    expect(again).toBe(uiRunFingerprint(manualParts));
  });

  it("revolution fingerprint changes with bar ids and duration", () => {
    const revo = {
      mode: "revolution" as const,
      stats,
      combatModel,
      barIds: ["attack", "rend"] as const,
      durationSeconds: 60,
      style: "melee",
    };
    expect(uiRunFingerprint(revo)).toBe(
      uiRunFingerprint({ ...revo, barIds: ["attack", "rend"] }),
    );
    expect(uiRunFingerprint({ ...revo, barIds: ["attack", "assault"] })).not.toBe(
      uiRunFingerprint(revo),
    );
    expect(uiRunFingerprint({ ...revo, durationSeconds: 90 })).not.toBe(uiRunFingerprint(revo));
  });

  it("powerburstUntilTick 10 vs 0 differs", () => {
    // Align normalize + stats freeze so remaining window is exactly 10 ticks (6s).
    const now = Date.now();
    const until = now + 6000;
    const offLoadout = normalizeLoadout(
      {
        ...DEFAULT_LOADOUT,
        buffs: { ...DEFAULT_LOADOUT.buffs, powerburstOfVitalityUntil: null },
      },
      now,
    );
    const onLoadout = normalizeLoadout(
      {
        ...DEFAULT_LOADOUT,
        buffs: { ...DEFAULT_LOADOUT.buffs, powerburstOfVitalityUntil: until },
      },
      now,
    );
    const off = resolve(offLoadout, now);
    const on = resolve(onLoadout, now);
    expect(on.stats.league.powerburstUntilTick).toBe(10);
    expect(off.stats.league.powerburstUntilTick).toBe(0);

    const base = {
      mode: "manual" as const,
      queue: ["attack"] as const,
      autoWeave: false,
      ammo: "none",
      useBuild: true,
    };
    const a = uiRunFingerprint({
      ...base,
      stats: off.stats,
      combatModel: off.combatModel,
    });
    const b = uiRunFingerprint({
      ...base,
      stats: on.stats,
      combatModel: on.combatModel,
    });
    expect(a).not.toBe(b);
    expect(b).toContain('"powerburstUntilTick":10');
    expect(a).toContain('"powerburstUntilTick":0');
  });

  it("target undead/demon changes identity when slayer perk present", () => {
    const undeadLoadout = withLoadout({
      perks: { ...DEFAULT_LOADOUT.perks, undeadSlayer: 1 },
      target: { defenceLevel: 80, affinity: "same", undead: true },
    });
    const livingLoadout = withLoadout({
      perks: { ...DEFAULT_LOADOUT.perks, undeadSlayer: 1 },
      target: { defenceLevel: 80, affinity: "same", undead: false },
    });
    const demonLoadout = withLoadout({
      perks: { ...DEFAULT_LOADOUT.perks, demonSlayer: 1 },
      target: { defenceLevel: 80, affinity: "same", demon: true },
    });
    const nonDemonLoadout = withLoadout({
      perks: { ...DEFAULT_LOADOUT.perks, demonSlayer: 1 },
      target: { defenceLevel: 80, affinity: "same", demon: false },
    });

    const parts = {
      mode: "manual" as const,
      queue: ["attack"] as const,
      autoWeave: false,
      ammo: "none",
      useBuild: true,
    };
    const undead = resolve(undeadLoadout);
    const living = resolve(livingLoadout);
    const demon = resolve(demonLoadout);
    const nonDemon = resolve(nonDemonLoadout);
    expect(
      uiRunFingerprint({
        ...parts,
        stats: undead.stats,
        combatModel: undead.combatModel,
      }),
    ).not.toBe(
      uiRunFingerprint({
        ...parts,
        stats: living.stats,
        combatModel: living.combatModel,
      }),
    );
    expect(
      uiRunFingerprint({
        ...parts,
        stats: demon.stats,
        combatModel: demon.combatModel,
      }),
    ).not.toBe(
      uiRunFingerprint({
        ...parts,
        stats: nonDemon.stats,
        combatModel: nonDemon.combatModel,
      }),
    );
  });
});
