"use client";

/**
 * The board's one heartbeat.
 *
 * `frameloop="demand"` means the loop sleeps unless something asks for a frame,
 * which is the whole reason this route is cheap. The sea is the single exception
 * — it has to move at rest — so exactly one timer exists and everything else
 * that animates rides the frames it produces.
 *
 * The throttle is a timer and not a frame accumulator. Accumulating delta inside
 * `useFrame` and invalidating when it crossed 1/30 looks equivalent and is not:
 * under demand a frame only happens because something asked for one, so the sea
 * was the only thing keeping the sea awake, and the frame its own invalidate
 * produced arrived one rAF later — far short of 1/30 on a fast panel — so it
 * returned without asking again and the loop slept for good.
 *
 * It stops for reduced motion, for an offscreen canvas, and for a hidden tab.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { mapClock } from "./materials/shared";

/** Slow water does not need 60. Held here so the whole board shares one cadence. */
export const MOTION_HZ = 30;

export function MotionDriver({ reducedMotion }: { reducedMotion: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const running = useRef(!reducedMotion);
  const onScreen = useRef(true);
  const ticks = useRef(0);

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
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [gl, invalidate, reducedMotion]);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      if (running.current) invalidate();
    }, 1000 / MOTION_HZ);
    return () => window.clearInterval(id);
  }, [invalidate, reducedMotion]);

  // Frames the timer asked for: advance the shared clock, ask for nothing.
  useFrame((_, delta) => {
    ticks.current++;
    if (running.current) mapClock.value = (mapClock.value as number) + Math.min(delta, 0.1);
  });

  // The idle budget is invisible in a screenshot and has regressed in both
  // directions — a frozen sea, and a reduced-motion path pinned at the refresh
  // rate. e2e/map-ocean.spec.ts counts these.
  useEffect(() => {
    const probe = () => ({ ticks: ticks.current, running: running.current });
    (window as unknown as { __mapDiag?: typeof probe }).__mapDiag = probe;
    return () => {
      delete (window as unknown as { __mapDiag?: typeof probe }).__mapDiag;
    };
  }, []);

  return null;
}
