/**
 * Loadout weapon shape must gate melee ability legality for the solver pool.
 * 2H abilities never enter dual-wield / main-hand search; DW-only never enter 2H.
 */
import { describe, expect, it } from "vitest";
import { MELEE_ABILITIES } from "../styles/melee/abilities";
import { buildCandidatePool } from "./candidatePool";
import { isBarEligible } from "./eligibility";

describe("solver pool weapon-shape gates (melee catalogue)", () => {
  it("two-hand loadout excludes Flurry and includes Hurricane / Pulverise", () => {
    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: "twohand",
    });
    expect(pool.byId.has("hurricane")).toBe(true);
    expect(pool.byId.has("pulverise")).toBe(true);
    expect(pool.byId.has("adaptive_strike_2h")).toBe(true);
    expect(pool.byId.has("flurry")).toBe(false);
    expect(pool.byId.has("greater_flurry")).toBe(false);
    expect(pool.byId.has("adaptive_strike_dw")).toBe(false);
    // Shared abilities stay legal.
    expect(pool.byId.has("assault")).toBe(true);
    expect(pool.byId.has("berserk")).toBe(true);
  });

  it("dual-wield loadout excludes Hurricane / Pulverise and includes Flurry", () => {
    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: "dualwield",
    });
    expect(pool.byId.has("flurry")).toBe(true);
    expect(pool.byId.has("greater_flurry")).toBe(true);
    expect(pool.byId.has("adaptive_strike_dw")).toBe(true);
    expect(pool.byId.has("hurricane")).toBe(false);
    expect(pool.byId.has("pulverise")).toBe(false);
    expect(pool.byId.has("adaptive_strike_2h")).toBe(false);
  });

  it("main-hand (no off-hand) excludes both dual-wield-only and two-hand-only", () => {
    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: "mainhand",
    });
    expect(pool.byId.has("flurry")).toBe(false);
    expect(pool.byId.has("hurricane")).toBe(false);
    expect(pool.byId.has("pulverise")).toBe(false);
    expect(pool.byId.has("assault")).toBe(true);
  });

  it("defender counts as dual-wield for dual-only abilities", () => {
    const pool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: "defender",
    });
    expect(pool.byId.has("flurry")).toBe(true);
    expect(pool.byId.has("hurricane")).toBe(false);
  });

  it("bars with illegal weapon-shaped ids are not eligible under the loadout shape", () => {
    const dualPool = buildCandidatePool(MELEE_ABILITIES, "melee", {
      weaponConfiguration: "dualwield",
    });
    // Hurricane is not even in the dual pool — bar validation reports unknown-id
    // when someone forces it; also not eligible if we build a loose pool.
    expect(dualPool.byId.has("hurricane")).toBe(false);
    expect(isBarEligible(["assault", "flurry"], dualPool)).toBe(true);

    const loose = buildCandidatePool(MELEE_ABILITIES, "melee", {});
    expect(isBarEligible(["hurricane"], loose, { weaponConfiguration: "dualwield" })).toBe(false);
    expect(isBarEligible(["flurry"], loose, { weaponConfiguration: "twohand" })).toBe(false);
    expect(isBarEligible(["hurricane"], loose, { weaponConfiguration: "twohand" })).toBe(true);
  });
});
