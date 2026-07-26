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
      blessingResetsUsed: 3,
    });
  });
});
