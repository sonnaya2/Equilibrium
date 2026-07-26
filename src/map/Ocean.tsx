"use client";

/**
 * The sea the board sits in.
 *
 * Minimalist on purpose: two teals, a slow drift, and a few lighter bands where
 * a noise ridge crosses a threshold. It is not trying to look like water — it is
 * trying to make the coastlines read, which is the one job it has. Slabs stay
 * the brightest thing on the board.
 *
 * This is the one thing on the route that animates at rest, which the design law
 * otherwise bans. It ships because it was asked for, and because a still sea
 * makes the board look like a diagram. `prefers-reduced-motion` freezes it, and
 * it only drives the frameloop while the canvas is actually on screen.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useFrame, useThree } from "@react-three/fiber";
import { float, mix, positionWorld, smoothstep, uniform, vec3 } from "three/tsl";
import { MAP_WORLD } from "./data/regionAnchors";
import { OCEAN_DEEP, OCEAN_FOAM, OCEAN_SHALLOW, SURFACE_VOID } from "./palette";

/** Hex -> linear vec3, matching the decode TSL's color() would do. */
function linear(hex: number) {
  const ch = (s: number) => Math.pow(((hex >> s) & 255) / 255, 2.2);
  return vec3(ch(16), ch(8), ch(0));
}

export function Ocean({ reducedMotion }: { reducedMotion: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const running = useRef(!reducedMotion);

  const material = useMemo(() => {
    const m = new THREE.MeshBasicNodeMaterial();
    // Frozen under reduced motion: the clock stops, the surface stays.
    const clock = uniform(0);

    // Deliberately sines, not noise. This plane covers most of the viewport once
    // the camera descends, so its fragment cost is paid on nearly every pixel at
    // whatever dpr the display has. A 3-octave fractal noise here locked up real
    // hardware at dpr 2 while headless dpr 1 looked fine. Two crossed waves cost
    // a handful of ALU ops and read the same at this scale.
    const p = positionWorld.xz;
    // Short wavelengths on purpose. At the original 2.7/3.4 the crests were
    // wider than a region, so the sea read as two soft glowing blobs sitting
    // behind the board rather than as water — the "weird" in the brief.
    const a = p.x.mul(17).add(p.y.mul(7)).add(clock.mul(0.9)).sin();
    const b = p.y.mul(21).sub(p.x.mul(5)).sub(clock.mul(0.6)).sin();
    const swell = a.mul(0.6).add(b.mul(0.4));

    // Narrow band between the two teals: the sea is the ground the slabs sit
    // in, and it has to stay quieter than every slab on it.
    const base = mix(linear(OCEAN_DEEP), linear(OCEAN_SHALLOW), swell.mul(0.16).add(0.2));
    // Thin crests where the two waves agree, rather than a full foam layer.
    const ridge = smoothstep(float(0.84), float(0.99), swell.abs());
    const water = mix(base, linear(OCEAN_FOAM), ridge.mul(0.14));

    // The plane has to end somewhere, and a hard edge against the background
    // read as a black bar across the top of the canvas. Dissolve it into the
    // void instead, so the horizon is a falloff rather than a seam.
    const horizon = smoothstep(float(1.15), float(2.6), p.length());
    m.colorNode = mix(water, linear(SURFACE_VOID), horizon);
    m.fog = false;
    return { m, clock };
  }, []);

  useEffect(() => () => material.m.dispose(), [material]);

  // Only spend frames while the canvas is on screen and motion is allowed.
  useEffect(() => {
    running.current = !reducedMotion;
    const el = gl.domElement;
    const io = new IntersectionObserver(
      ([e]) => {
        running.current = !reducedMotion && e.isIntersecting;
        if (running.current) invalidate();
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [gl, invalidate, reducedMotion]);

  /**
   * The 30Hz throttle is a timer, not a frame accumulator.
   *
   * Accumulating delta inside useFrame and invalidating when it crossed 1/30
   * looked equivalent and was not: under frameloop="demand" a frame only
   * happens because something asked for one, so the sea was the only thing
   * keeping the sea awake. The frame its own invalidate produced arrived one
   * rAF later — about 6ms on a 165Hz panel, far short of 1/30 — so it returned
   * without asking again and the loop went to sleep for good. The result was a
   * frozen sea that unfroze whenever the pointer moved, and only ever looked
   * right while something else happened to be driving frames.
   *
   * A timer owns the cadence instead, so the sea drives itself at a real 30Hz.
   * Not created at all under reduced motion, and the IntersectionObserver above
   * still parks it when the canvas is off screen.
   */
  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      if (running.current) invalidate();
    }, 1000 / 30);
    return () => window.clearInterval(id);
  }, [invalidate, reducedMotion]);

  // Frames the timer asked for: advance the clock, ask for nothing.
  useFrame((_, delta) => {
    if (!running.current) return;
    material.clock.value += delta;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.028, 0]} material={material.m}>
      <planeGeometry args={[MAP_WORLD.width * 4, MAP_WORLD.width * 4]} />
    </mesh>
  );
}
