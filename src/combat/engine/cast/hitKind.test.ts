import { describe, expect, it } from "vitest";
import type { AbilityHit } from "../../pipeline/calculateAbility";
import {
  firstEligibleDirectHitIndex,
  hasFuryConsumingHit,
  isBleedHit,
  isCritEligibleHit,
  isDamagingHit,
  isDirectHit,
  isDotHit,
} from "./hitKind";

const direct: AbilityHit = { band: { minPct: 110, maxPct: 130 } };
const nonCritDirect: AbilityHit = { band: { minPct: 75, maxPct: 85 }, critEligible: false };
const bleed: AbilityHit = {
  band: { minPct: 20, maxPct: 30 },
  critEligible: false,
  dot: true,
  dotKind: "bleed",
  bleedId: "dismember",
};

describe("hitKind predicates", () => {
  it("does not classify a noncritical direct hit as a bleed", () => {
    expect(isDirectHit(nonCritDirect)).toBe(true);
    expect(isBleedHit(nonCritDirect)).toBe(false);
    expect(isDotHit(nonCritDirect)).toBe(false);
    expect(isCritEligibleHit(nonCritDirect)).toBe(false);
    expect(isDamagingHit(nonCritDirect)).toBe(true);
  });
  it("recognizes a bleed independently of crit eligibility", () => {
    expect(isBleedHit(bleed)).toBe(true);
    expect(isBleedHit({ ...bleed, critEligible: true })).toBe(true);
    expect(isDirectHit(bleed)).toBe(false);
  });
  it("Fury consumption ignores bleed-only casts but accepts non-crit directs", () => {
    expect(hasFuryConsumingHit([bleed])).toBe(false);
    expect(hasFuryConsumingHit([nonCritDirect])).toBe(true);
    expect(hasFuryConsumingHit([direct])).toBe(true);
  });
  it("first eligible direct hit skips bleeds and non-crit-eligible directs", () => {
    expect(firstEligibleDirectHitIndex([bleed, nonCritDirect, direct])).toBe(2);
  });
});
