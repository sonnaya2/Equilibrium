import { describe, expect, it } from "vitest";
import { DEFAULT_LOADOUT, normalizeLoadout, type Loadout } from "./loadout/model";
import { loadoutStats } from "./loadoutStats";
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

describe("uiRunFingerprint", () => {
  const baseLoadout = normalizeLoadout(DEFAULT_LOADOUT);
  const stats = loadoutStats(baseLoadout);

  const manualParts = {
    mode: "manual" as const,
    stats,
    loadout: baseLoadout,
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
    const withHigherBase = {
      ...manualParts,
      stats: { ...stats, base: stats.base + 100 },
    };
    expect(uiRunFingerprint(withHigherBase)).not.toBe(uiRunFingerprint(manualParts));
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
      loadout: baseLoadout,
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
      loadout: baseLoadout,
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
    const offStats = loadoutStats(offLoadout, { now });
    const onStats = loadoutStats(onLoadout, { now });
    expect(onStats.league.powerburstUntilTick).toBe(10);
    expect(offStats.league.powerburstUntilTick).toBe(0);

    const base = {
      mode: "manual" as const,
      queue: ["attack"] as const,
      autoWeave: false,
      ammo: "none",
      useBuild: true,
    };
    const a = uiRunFingerprint({ ...base, stats: offStats, loadout: offLoadout });
    const b = uiRunFingerprint({ ...base, stats: onStats, loadout: onLoadout });
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
    expect(
      uiRunFingerprint({
        ...parts,
        stats: loadoutStats(undeadLoadout),
        loadout: undeadLoadout,
      }),
    ).not.toBe(
      uiRunFingerprint({
        ...parts,
        stats: loadoutStats(livingLoadout),
        loadout: livingLoadout,
      }),
    );
    expect(
      uiRunFingerprint({
        ...parts,
        stats: loadoutStats(demonLoadout),
        loadout: demonLoadout,
      }),
    ).not.toBe(
      uiRunFingerprint({
        ...parts,
        stats: loadoutStats(nonDemonLoadout),
        loadout: nonDemonLoadout,
      }),
    );
  });
});
