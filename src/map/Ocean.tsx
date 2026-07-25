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
import { OCEAN_DEEP, OCEAN_FOAM, OCEAN_SHALLOW } from "./palette";

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
    const a = p.x.mul(2.7).add(p.y.mul(1.1)).add(clock.mul(0.35)).sin();
    const b = p.y.mul(3.4).sub(p.x.mul(0.8)).sub(clock.mul(0.22)).sin();
    const swell = a.mul(0.6).add(b.mul(0.4));

    const base = mix(linear(OCEAN_DEEP), linear(OCEAN_SHALLOW), swell.mul(0.5).add(0.5));
    // Thin crests where the two waves agree, rather than a full foam layer.
    const ridge = smoothstep(float(0.72), float(0.95), swell.abs());
    m.colorNode = mix(base, linear(OCEAN_FOAM), ridge.mul(0.3));
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

  // Throttled to ~30Hz. The sea does not need 165 frames a second, and every
  // frame it asks for is a full-viewport repaint of the whole scene.
  const accum = useRef(0);
  useFrame((_, delta) => {
    if (!running.current) return;
    material.clock.value += delta;
    accum.current += delta;
    if (accum.current < 1 / 30) return;
    accum.current = 0;
    invalidate();
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.028, 0]} material={material.m}>
      <planeGeometry args={[MAP_WORLD.width * 2.2, MAP_WORLD.height * 2.4]} />
    </mesh>
  );
}
