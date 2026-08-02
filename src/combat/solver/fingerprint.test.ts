import { describe, expect, it } from "vitest";
import { SOLVER_SCHEMA_VERSION } from "./contracts";
import {
  fingerprintBar,
  fingerprintEvaluationKey,
  stableStringify,
} from "./fingerprint";
import { EvalCache } from "./cache";

describe("fingerprintBar", () => {
  it("joins in order with NUL separators", () => {
    expect(fingerprintBar(["wrack", "sonic_wave", "asphyxiate"])).toBe(
      "wrack\0sonic_wave\0asphyxiate",
    );
  });

  it("is order-sensitive", () => {
    expect(fingerprintBar(["a", "b"])).not.toBe(fingerprintBar(["b", "a"]));
  });

  it("distinguishes empty vs singleton empty-id edge carefully", () => {
    expect(fingerprintBar([])).toBe("");
    expect(fingerprintBar([""])).toBe("");
    // multi-slot empties still differ by separator count
    expect(fingerprintBar(["", ""])).toBe("\0");
  });
});

describe("stableStringify", () => {
  it("sorts object keys", () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
    expect(stableStringify({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("is nested-key stable", () => {
    expect(stableStringify({ z: { y: 1, x: 2 }, a: [3, { b: 1, a: 0 }] })).toBe(
      '{"a":[3,{"a":0,"b":1}],"z":{"x":2,"y":1}}',
    );
  });
});

describe("fingerprintEvaluationKey", () => {
  it("includes schema version and bar order", () => {
    const key = fingerprintEvaluationKey({
      bar: ["a", "b"],
      profileId: "balanced",
      horizonTicks: 500,
      context: { level: 120 },
    });
    expect(key.startsWith(`v${SOLVER_SCHEMA_VERSION}\0`)).toBe(true);
    expect(key).toContain("a\0b");
    expect(
      fingerprintEvaluationKey({ bar: ["a", "b"], profileId: "balanced" }),
    ).not.toBe(fingerprintEvaluationKey({ bar: ["b", "a"], profileId: "balanced" }));
  });

  it("changes when context changes", () => {
    const a = fingerprintEvaluationKey({ bar: ["x"], context: { gear: "t90" } });
    const b = fingerprintEvaluationKey({ bar: ["x"], context: { gear: "t95" } });
    expect(a).not.toBe(b);
  });
});

describe("EvalCache", () => {
  it("tracks hits and misses and optional LRU eviction", () => {
    const cache = new EvalCache<number>(2);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.misses).toBe(1);
    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.get("a")).toBe(1);
    expect(cache.hits).toBe(1);
    cache.set("c", 3); // evicts least-recent (b), a was refreshed
    expect(cache.has("b")).toBe(false);
    expect(cache.get("a")).toBe(1);
    expect(cache.get("c")).toBe(3);
  });
});
