import { describe, expect, it } from "vitest";
import { secondsToTicks, STANDARD_ATTACK_TICKS, TICK_SECONDS, ticksToSeconds } from "./ticks";

describe("ticks", () => {
  it("runs on a 0.6 second tick", () => {
    expect(TICK_SECONDS).toBe(0.6);
    expect(secondsToTicks(19.8)).toBe(33);
    expect(ticksToSeconds(3)).toBeCloseTo(1.8);
  });

  it("pins the modernised standard attack timing", () => {
    expect(STANDARD_ATTACK_TICKS).toBe(3);
  });
});
