/**
 * Own a WebGPURenderer per canvas: reuse on StrictMode remount, dispose on real leave.
 * R3F never disposes custom gl; WeakMap GC alone does not free GPU resources.
 *
 * Dispose is deferred (default 0ms) so a same-turn remount can cancel.
 * A generation claim + identity check prevents dispose of a renderer that a
 * remount already replaced (second getContext on the same canvas).
 */

export type DisposableRenderer = {
  dispose: () => void;
};

export type LifetimeClock = {
  setTimeout: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
};

const defaultClock: LifetimeClock = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (id) => clearTimeout(id),
};

export class WebgpuRendererLifetime<
  TCanvas extends object,
  TRenderer extends DisposableRenderer,
> {
  private readonly renderers = new WeakMap<TCanvas, Promise<TRenderer>>();
  /** Bumped on cancel/schedule; timer only acts when gen still matches. */
  private readonly disposeGen = new WeakMap<TCanvas, number>();
  private readonly disposeTimers = new WeakMap<TCanvas, ReturnType<typeof setTimeout>>();
  private readonly clock: LifetimeClock;
  private readonly delayMs: number;

  constructor(options?: { clock?: LifetimeClock; delayMs?: number }) {
    this.clock = options?.clock ?? defaultClock;
    this.delayMs = options?.delayMs ?? 0;
  }

  get(canvas: TCanvas | undefined): Promise<TRenderer> | undefined {
    if (!canvas) return undefined;
    return this.renderers.get(canvas);
  }

  set(canvas: TCanvas, pending: Promise<TRenderer>): void {
    this.cancelDispose(canvas);
    this.renderers.set(canvas, pending);
  }

  delete(canvas: TCanvas | undefined): void {
    if (!canvas) return;
    this.renderers.delete(canvas);
  }

  /** Invalidate any scheduled dispose and clear its timer. */
  cancelDispose(canvas: TCanvas | undefined): void {
    if (!canvas) return;
    this.disposeGen.set(canvas, (this.disposeGen.get(canvas) ?? 0) + 1);
    const timer = this.disposeTimers.get(canvas);
    if (timer == null) return;
    this.clock.clearTimeout(timer);
    this.disposeTimers.delete(canvas);
  }

  /**
   * After delay, dispose the canvas renderer if this claim still owns it.
   * No-op when the map no longer holds the same promise (remount replaced it).
   */
  scheduleDispose(canvas: TCanvas | undefined): void {
    if (!canvas) return;
    this.cancelDispose(canvas);
    const pending = this.renderers.get(canvas);
    if (!pending) return;

    const claimGen = this.disposeGen.get(canvas) ?? 0;
    this.disposeTimers.set(
      canvas,
      this.clock.setTimeout(() => {
        this.disposeTimers.delete(canvas);
        if ((this.disposeGen.get(canvas) ?? 0) !== claimGen) return;
        if (this.renderers.get(canvas) !== pending) return;
        this.renderers.delete(canvas);
        void pending
          .then((renderer) => {
            // Remount may have claimed the canvas after delete; skip if so.
            if ((this.disposeGen.get(canvas) ?? 0) !== claimGen) return;
            renderer.dispose();
          })
          .catch(() => {
            // Init or dispose failed; map entry already cleared under claim.
          });
      }, this.delayMs),
    );
  }

  /** Test / diagnostics: whether a dispose timer is armed for this canvas. */
  hasPendingDispose(canvas: TCanvas): boolean {
    return this.disposeTimers.has(canvas);
  }
}
