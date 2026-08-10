import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WebgpuRendererLifetime,
  type DisposableRenderer,
} from "./webgpuRendererLifetime";

type FakeCanvas = { id: string };
type FakeRenderer = DisposableRenderer & {
  dispose: (() => void) & ReturnType<typeof vi.fn>;
};

function makeRenderer(): FakeRenderer {
  const dispose = vi.fn(() => {}) as (() => void) & ReturnType<typeof vi.fn>;
  return { dispose };
}

describe("WebgpuRendererLifetime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedule then cancel never disposes and keeps the map entry", async () => {
    vi.useFakeTimers();
    const life = new WebgpuRendererLifetime<FakeCanvas, FakeRenderer>();
    const canvas = { id: "c1" };
    const renderer = makeRenderer();
    const pending = Promise.resolve(renderer);
    life.set(canvas, pending);

    life.scheduleDispose(canvas);
    expect(life.hasPendingDispose(canvas)).toBe(true);
    life.cancelDispose(canvas);
    expect(life.hasPendingDispose(canvas)).toBe(false);

    await vi.runAllTimersAsync();
    await pending;

    expect(renderer.dispose).not.toHaveBeenCalled();
    expect(life.get(canvas)).toBe(pending);
  });

  it("schedule + flush disposes once and drops the entry", async () => {
    vi.useFakeTimers();
    const life = new WebgpuRendererLifetime<FakeCanvas, FakeRenderer>();
    const canvas = { id: "c2" };
    const renderer = makeRenderer();
    const pending = Promise.resolve(renderer);
    life.set(canvas, pending);

    life.scheduleDispose(canvas);
    await vi.runAllTimersAsync();
    await pending;
    // Allow the dispose then-chain.
    await Promise.resolve();

    expect(renderer.dispose).toHaveBeenCalledTimes(1);
    expect(life.get(canvas)).toBeUndefined();
    expect(life.hasPendingDispose(canvas)).toBe(false);
  });

  it("remount after schedule reclaims the same promise without dispose", async () => {
    vi.useFakeTimers();
    const life = new WebgpuRendererLifetime<FakeCanvas, FakeRenderer>();
    const canvas = { id: "c3" };
    const renderer = makeRenderer();
    const pending = Promise.resolve(renderer);
    life.set(canvas, pending);

    life.scheduleDispose(canvas);
    // Remount path: cancel then read existing entry.
    life.cancelDispose(canvas);
    const reused = life.get(canvas);
    expect(reused).toBe(pending);

    await vi.runAllTimersAsync();
    await pending;
    await Promise.resolve();

    expect(renderer.dispose).not.toHaveBeenCalled();
    expect(life.get(canvas)).toBe(pending);
  });

  it("does not dispose a replaced renderer after the timer claim is stale", async () => {
    vi.useFakeTimers();
    const life = new WebgpuRendererLifetime<FakeCanvas, FakeRenderer>();
    const canvas = { id: "c4" };
    const first = makeRenderer();
    const second = makeRenderer();
    let resolveFirst!: (renderer: FakeRenderer) => void;
    const firstPending = new Promise<FakeRenderer>((resolve) => {
      resolveFirst = resolve;
    });
    const secondPending = Promise.resolve(second);
    life.set(canvas, firstPending);

    life.scheduleDispose(canvas);
    // Timer fires while init is still pending: claim deletes entry, attaches then.
    await vi.advanceTimersByTimeAsync(0);
    expect(life.get(canvas)).toBeUndefined();

    // Remount replaces entry before first init resolves.
    life.cancelDispose(canvas);
    life.set(canvas, secondPending);
    resolveFirst(first);

    await firstPending;
    await secondPending;
    await Promise.resolve();
    await Promise.resolve();

    expect(first.dispose).not.toHaveBeenCalled();
    expect(second.dispose).not.toHaveBeenCalled();
    expect(life.get(canvas)).toBe(secondPending);
  });

  it("set cancels a pending dispose for that canvas", async () => {
    vi.useFakeTimers();
    const life = new WebgpuRendererLifetime<FakeCanvas, FakeRenderer>();
    const canvas = { id: "c5" };
    const first = makeRenderer();
    const second = makeRenderer();
    life.set(canvas, Promise.resolve(first));
    life.scheduleDispose(canvas);
    life.set(canvas, Promise.resolve(second));

    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    expect(first.dispose).not.toHaveBeenCalled();
    expect(life.get(canvas)).toBeDefined();
  });
});
