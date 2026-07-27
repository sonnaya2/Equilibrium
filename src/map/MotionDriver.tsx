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
 * raises to MAP_ACTIVE_HZ (120) briefly. Hover alone does not.
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
  const running = useRef(false);
  const onScreen = useRef(true);
  const ticks = useRef(0);
  const hzBand = useRef(MAP_IDLE_HZ);

  useEffect(() => {
    const element = gl.domElement;
    const sync = () => {
      const next = !reducedMotion && onScreen.current && !document.hidden;
      running.current = next;
      if (next) invalidate();
    };
    // Prefer "visible until proven otherwise". A 0×0 first layout must not
    // permanently freeze the demand loop before flex assigns size.
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only flip off when we have a real box and it is off-screen.
        const box = entry.boundingClientRect;
        const hasBox = box.width > 2 && box.height > 2;
        if (!hasBox) return;
        onScreen.current = entry.isIntersecting;
        sync();
      },
      { threshold: 0, rootMargin: "48px" },
    );
    observer.observe(element);
    document.addEventListener("visibilitychange", sync);
    const onDown = () => pokeMapActivity();
    const onWheel = () => pokeMapActivity();
    element.addEventListener("pointerdown", onDown);
    element.addEventListener("wheel", onWheel, { passive: true });
    sync();
    // Kick a couple of frames after layout — canvas often 0×0 on first paint.
    const t1 = window.setTimeout(sync, 50);
    const t2 = window.setTimeout(sync, 250);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
      element.removeEventListener("pointerdown", onDown);
      element.removeEventListener("wheel", onWheel);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [gl, invalidate, reducedMotion]);

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

  useFrame((_, delta) => {
    ticks.current++;
    if (running.current) mapClock.value = (mapClock.value as number) + Math.min(delta, 0.1);
  });

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
