import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng (mulberry32)", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("diverges for different seeds", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(Array.from({ length: 5 }, () => a.next())).not.toEqual(
      Array.from({ length: 5 }, () => b.next()),
    );
  });

  it("int is in [0, maxExclusive)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = rng.int(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  it("pick and shuffle are deterministic and shuffle is order-sensitive to seed", () => {
    const items = ["a", "b", "c", "d", "e"] as const;
    expect(createRng(99).shuffle(items)).toEqual(createRng(99).shuffle(items));
    expect(createRng(99).shuffle(items)).not.toEqual(createRng(100).shuffle(items));
    expect(createRng(99).pick(items)).toBe(createRng(99).pick(items));
  });

  it("fork yields an independent deterministic stream", () => {
    const parent = createRng(123);
    const childA = parent.fork();
    const childB = createRng(123).fork();
    expect(Array.from({ length: 8 }, () => childA.next())).toEqual(
      Array.from({ length: 8 }, () => childB.next()),
    );
    // parent advanced once for the fork seed - further draws stay defined
    expect(typeof parent.next()).toBe("number");
  });

  it("does not mutate the input on shuffle", () => {
    const items = [1, 2, 3, 4];
    const copy = items.slice();
    createRng(5).shuffle(items);
    expect(items).toEqual(copy);
  });
});
