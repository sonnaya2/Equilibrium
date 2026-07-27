"use client";

/**
 * The board's one heartbeat.
 *
 * `frameloop="demand"` means the loop sleeps unless something asks for a frame,
 * which is the whole reason this route is cheap. The sea is the single exception
 * — it has to move at rest — so exactly one timer exists and everything else
 * that animates rides the frames it produces.
 *
 * Idle holds at MAP_IDLE_HZ (30). Real interaction (drag, wheel, WASD, unlock)
 * raises to MAP_ACTIVE_HZ (120) briefly. Hover alone does not — pointermove
 * activity pokes kept the refresh driver awake for no reason.
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
      const next = !reducedMotion && onScreen.current && !document.hidden;
      if (next === running.current) return;
      running.current = next;
      if (running.current) invalidate();
    };
    // Coarse observe: only care about leave/enter the viewport, not subpixel
    // intersection churn (feeds "Update intersection observations" on scroll).
    const observer = new IntersectionObserver(
      ([entry]) => {
        const hit = entry.isIntersecting && entry.intersectionRatio > 0;
        if (hit === onScreen.current) return;
        onScreen.current = hit;
        update();
      },
      { threshold: 0, rootMargin: "32px" },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", update);
    // Active band only on real intent — not every hover move.
    const onDown = () => pokeMapActivity();
    const onWheel = () => pokeMapActivity();
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("wheel", onWheel, { passive: true });
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("wheel", onWheel);
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
