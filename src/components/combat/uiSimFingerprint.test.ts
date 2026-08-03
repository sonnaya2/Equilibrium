import { describe, expect, it } from "vitest";
import { DEFAULT_LOADOUT, normalizeLoadout } from "./loadout/model";
import { loadoutStats } from "./loadoutStats";
import { uiRunFingerprint } from "./uiSimFingerprint";

describe("uiRunFingerprint", () => {
  const baseLoadout = normalizeLoadout(DEFAULT_LOADOUT);
  const stats = loadoutStats(baseLoadout);

  const manualParts = {
    mode: "manual" as const,
    stats,
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

  it("changing startingAdrenaline invalidates fingerprint", () => {
    const other = {
      ...manualParts,
      stats: { ...stats, startingAdrenaline: stats.startingAdrenaline + 10 },
    };
    expect(uiRunFingerprint(other)).not.toBe(uiRunFingerprint(manualParts));
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
});
