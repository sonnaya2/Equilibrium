import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WebgpuRendererLifetime,
  type DisposableRenderer,
} from "./webgpuRendererLifetime";

type FakeCanvas = { id: string };

/** Real DisposableRenderer + separate mock so vi.fn never enters the type param. */
function makeRenderer(): { renderer: DisposableRenderer; dispose: ReturnType<typeof vi.fn> } {
  const dispose = vi.fn(() => {});
  const renderer: DisposableRenderer = {
    dispose() {
      dispose();
    },
  };
  return { renderer, dispose };
}

describe("WebgpuRendererLifetime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedule then cancel never disposes and keeps the map entry", async () => {
    vi.useFakeTimers();
    const life = new WebgpuRendererLifetime<FakeCanvas, DisposableRenderer>();
    const canvas = { id: "c1" };
    const { renderer, dispose } = makeRenderer();
    const pending = Promise.resolve(renderer);
    life.set(canvas, pending);

    life.scheduleDispose(canvas);
    expect(life.hasPendingDispose(canvas)).toBe(true);
    life.cancelDispose(canvas);
    expect(life.hasPendingDispose(canvas)).toBe(false);

    await vi.runAllTimersAsync();
    await pending;

    expect(dispose).not.toHaveBeenCalled();
    expect(life.get(canvas)).toBe(pending);
  });

  it("schedule + flush disposes once and drops the entry", async () => {
    vi.useFakeTimers();
    const life = new WebgpuRendererLifetime<FakeCanvas, DisposableRenderer>();
    const canvas = { id: "c2" };
    const { renderer, dispose } = makeRenderer();
    const pending = Promise.resolve(renderer);
    life.set(canvas, pending);

    life.scheduleDispose(canvas);
    await vi.runAllTimersAsync();
    await pending;
    // Allow the dispose then-chain.
    await Promise.resolve();

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(life.get(canvas)).toBeUndefined();
    expect(life.hasPendingDispose(canvas)).toBe(false);
  });

  it("remount after schedule reclaims the same promise without dispose", async () => {
    vi.useFakeTimers();
    const life = new WebgpuRendererLifetime<FakeCanvas, DisposableRenderer>();
    const canvas = { id: "c3" };
    const { renderer, dispose } = makeRenderer();
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

    expect(dispose).not.toHaveBeenCalled();
    expect(life.get(canvas)).toBe(pending);
  });

  it("does not dispose a replaced renderer after the timer claim is stale", async () => {
    vi.useFakeTimers();
    const life = new WebgpuRendererLifetime<FakeCanvas, DisposableRenderer>();
    const canvas = { id: "c4" };
    const first = makeRenderer();
    const second = makeRenderer();
    let resolveFirst!: (renderer: DisposableRenderer) => void;
    const firstPending = new Promise<DisposableRenderer>((resolve) => {
      resolveFirst = resolve;
    });
    const secondPending = Promise.resolve(second.renderer);
    life.set(canvas, firstPending);

    life.scheduleDispose(canvas);
    // Timer fires while init is still pending: claim deletes entry, attaches then.
    await vi.advanceTimersByTimeAsync(0);
    expect(life.get(canvas)).toBeUndefined();

    // Remount replaces entry before first init resolves.
    life.cancelDispose(canvas);
    life.set(canvas, secondPending);
    resolveFirst(first.renderer);

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
    const life = new WebgpuRendererLifetime<FakeCanvas, DisposableRenderer>();
    const canvas = { id: "c5" };
    const first = makeRenderer();
    const second = makeRenderer();
    life.set(canvas, Promise.resolve(first.renderer));
    life.scheduleDispose(canvas);
    life.set(canvas, Promise.resolve(second.renderer));

    await vi.runAllTimersAsync();
    await Promise.resolve();
    await Promise.resolve();

    expect(first.dispose).not.toHaveBeenCalled();
    expect(life.get(canvas)).toBeDefined();
  });
});
