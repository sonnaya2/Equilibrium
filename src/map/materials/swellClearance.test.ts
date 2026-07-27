import { describe, expect, it } from "vitest";
import { LOCKED_DROP, REST_CLEARANCE } from "../plateHeight";
import { SWELL } from "./WaterMaterial";

describe("ocean swell vs plate clearance", () => {
  it("keeps peak crest under locked freeboard", () => {
    const freeboard = REST_CLEARANCE - LOCKED_DROP;
    expect(SWELL).toBeLessThan(freeboard - 0.001);
  });
});
