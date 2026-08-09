import { describe, expect, it } from "vitest";
import { isAmmunitionHitEligible } from "./ammunitionEligibility";

const eligible = {
  style: "ranged" as const,
};

describe("ranged ammunition hit eligibility", () => {
  it("accepts landed direct and auto attacks", () => {
    expect(isAmmunitionHitEligible({ ...eligible, provenance: { kind: "player_direct" } })).toBe(
      true,
    );
    expect(isAmmunitionHitEligible({ ...eligible, provenance: { kind: "player_auto" } })).toBe(
      true,
    );
  });

  it("uses ammunition capability instead of the generic proc boundary", () => {
    expect(
      isAmmunitionHitEligible({
        ...eligible,
        provenance: { kind: "player_direct" },
      }),
    ).toBe(true);
  });

  it("allows BotLG's separate attack only with its explicit origin", () => {
    expect(
      isAmmunitionHitEligible({
        ...eligible,
        provenance: { kind: "botlg_perfect_equilibrium" },
      }),
    ).toBe(false);
    expect(
      isAmmunitionHitEligible({
        ...eligible,
        provenance: { kind: "botlg_perfect_equilibrium" },
        attackOrigin: "botlg",
      }),
    ).toBe(true);
  });

  it("rejects DoTs, equipment and secondary procs, reflected hits, and recursion", () => {
    for (const provenance of [
      { kind: "player_dot" as const },
      { kind: "player_converted_channel" as const },
      { kind: "conjure_command" as const },
      { kind: "equipment_proc" as const },
      { kind: "invention_proc" as const },
      { kind: "attached" as const },
      { kind: "derived_bounce" as const },
      { kind: "reflected" as const },
    ]) {
      expect(isAmmunitionHitEligible({ ...eligible, provenance })).toBe(false);
    }
    expect(
      isAmmunitionHitEligible({
        ...eligible,
        provenance: { kind: "player_direct" },
        attackOrigin: "botlg",
      }),
    ).toBe(false);
  });

  it("rejects non-ranged direct attacks", () => {
    expect(
      isAmmunitionHitEligible({
        ...eligible,
        style: "melee",
        provenance: { kind: "player_direct" },
      }),
    ).toBe(false);
  });
});
