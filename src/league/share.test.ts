import { describe, expect, it } from "vitest";
import { emptyBuild, toggleElective, toggleRelic, pickBlessing } from "./index";
import { decodeBuild, encodeBuild, MAX_SHARE_PAYLOAD_CHARS } from "./share";

describe("encodeBuild / decodeBuild", () => {
  it("round-trips a full build through URL-safe text", () => {
    let state = toggleElective(emptyBuild(), "desert");
    state = toggleElective(state, "morytania");
    state = toggleRelic(state, 1, "Survivalist");
    state = pickBlessing(state, 1, "Order");
    state = pickBlessing(state, 2, "Chaos");

    const encoded = encodeBuild(state);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeBuild(encoded)).toEqual(state);
  });

  it("rejects garbage, foreign payloads, and shapeless objects", () => {
    expect(decodeBuild("not-base64!!!")).toBeNull();
    expect(decodeBuild(encodeBuild(emptyBuild()).slice(0, 4))).toBeNull();
    expect(decodeBuild(btoa(JSON.stringify("hello")))).toBeNull();
    expect(decodeBuild(btoa(JSON.stringify({ unrelated: true })))).toBeNull();
  });

  it("rejects oversized base64 payloads", () => {
    expect(decodeBuild("A".repeat(MAX_SHARE_PAYLOAD_CHARS + 1))).toBeNull();
  });

  it("normalizes through the same rules as storage hydration", () => {
    const dirty = btoa(
      JSON.stringify({
        elective: ["desert", "not-a-region"],
        blessingPicks: ["Order", "junk"],
        blessingResetsUsed: 99,
      }),
    );
    expect(decodeBuild(dirty)).toEqual({
      elective: ["desert"],
      relics: {},
      blessingPicks: ["Order"],
      blessingSelections: [{ progressionSlot: 1, tier: 1, blessingId: "teragards-aegis" }],
      blessingResetsUsed: 3,
    });
  });

  it("migrates old interspersed-slot share selections without renumbering the picked cards", () => {
    const legacy = btoa(
      JSON.stringify({
        blessingPicks: ["Order", "Balance", "Chaos", "Balance", "Order", "Order"],
        blessingSelections: [
          { tier: 1, blessingId: "teragards-aegis" },
          { tier: 2, blessingId: "barkscales" },
          { tier: 3, blessingId: "avernic-rampage" },
          { tier: 5, blessingId: "true-equilibrium" },
          { tier: 6, blessingId: "lord-of-light" },
          { tier: 7, blessingId: "tempered-heart" },
        ],
      }),
    );
    expect(decodeBuild(legacy)?.blessingSelections).toEqual([
      { progressionSlot: 1, tier: 1, blessingId: "teragards-aegis" },
      { progressionSlot: 2, tier: 2, blessingId: "barkscales" },
      { progressionSlot: 3, tier: 3, blessingId: "avernic-rampage" },
      { progressionSlot: 5, tier: 4, blessingId: "true-equilibrium" },
      { progressionSlot: 6, tier: 5, blessingId: "lord-of-light" },
      { progressionSlot: 7, tier: 6, blessingId: "tempered-heart" },
    ]);
  });
});
