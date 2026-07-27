"use client";

/**
 * The board's one heartbeat.
 *
 * `frameloop="demand"` means the loop sleeps unless something asks for a frame,
 * which is the whole reason this route is cheap. The sea is the single exception
 * — it has to move at rest — so exactly one timer exists and everything else
 * that animates rides the frames it produces.
 *
 * Idle holds at MAP_IDLE_HZ (30). Pointer / camera / unlock pokes raise the
 * band to MAP_ACTIVE_HZ (120) for a short grace, then drop back. Never free-run
 * at panel refresh (that was the GPU pin).
 *
 * It stops for reduced motion, for an offscreen canvas, and for a hidden tab.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { mapClock } from "./materials/shared";
import {
  MAP_ACTIVE_HZ,
  MAP_IDLE_HZ,
  mapActivityHz,
  pokeMapActivity,
} from "./mapPerf";

/** @deprecated Prefer MAP_IDLE_HZ — kept for Ocean comments / external imports. */
export const MOTION_HZ = MAP_IDLE_HZ;

export function MotionDriver({ reducedMotion }: { reducedMotion: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const running = useRef(!reducedMotion);
  const onScreen = useRef(true);
  const ticks = useRef(0);
  const hzBand = useRef(MAP_IDLE_HZ);

  useEffect(() => {
    const element = gl.domElement;
    const update = () => {
      running.current = !reducedMotion && onScreen.current && !document.hidden;
      if (running.current) invalidate();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        onScreen.current = entry.isIntersecting;
        update();
      },
      { threshold: 0.02 },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    // Pointer over the board ⇒ active band (orbit prep, hover parallax).
    const onPointer = () => pokeMapActivity();
    element.addEventListener("pointerdown", onPointer);
    element.addEventListener("pointermove", onPointer, { passive: true });
    element.addEventListener("wheel", onPointer, { passive: true });
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      element.removeEventListener("pointerdown", onPointer);
      element.removeEventListener("pointermove", onPointer);
      element.removeEventListener("wheel", onPointer);
    };
  }, [gl, invalidate, reducedMotion]);

  // rAF-aligned throttle: setInterval drifts against the display and the water
  // + river shaders strobe. Period follows idle/active band each tick.
  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      raf = window.requestAnimationFrame(tick);
      if (!running.current) return;
      const hz = mapActivityHz();
      hzBand.current = hz;
      const period = 1000 / hz;
      if (now - last < period) return;
      // Catch-up: don't multi-fire after a long stall.
      last = now;
      invalidate();
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [invalidate, reducedMotion]);

  // Frames the timer asked for: advance the shared clock, ask for nothing.
  useFrame((_, delta) => {
    ticks.current++;
    if (running.current) mapClock.value = (mapClock.value as number) + Math.min(delta, 0.1);
  });

  // Idle budget probe for e2e/map-ocean.spec.ts.
  useEffect(() => {
    const probe = () => ({
      ticks: ticks.current,
      running: running.current,
      hz: hzBand.current,
      idleHz: MAP_IDLE_HZ,
      activeHz: MAP_ACTIVE_HZ,
    });
    (window as unknown as { __mapDiag?: typeof probe }).__mapDiag = probe;
    return () => {
      delete (window as unknown as { __mapDiag?: typeof probe }).__mapDiag;
    };
  }, []);

  return null;
}
