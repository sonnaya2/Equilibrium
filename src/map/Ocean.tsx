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
import { float, mix, mx_fractal_noise_float, positionWorld, smoothstep, time, uniform, vec3 } from "three/tsl";
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
    const p = positionWorld.xz.mul(1.6);
    const drift = vec3(p.x.add(clock.mul(0.03)), p.y.sub(clock.mul(0.018)), float(0));
    const swell = mx_fractal_noise_float(drift, 3);

    const base = mix(linear(OCEAN_DEEP), linear(OCEAN_SHALLOW), swell.mul(0.5).add(0.5));
    // Thin crests where the ridge crosses a band, rather than a full foam layer.
    const ridge = smoothstep(float(0.62), float(0.7), swell.abs());
    m.colorNode = mix(base, linear(OCEAN_FOAM), ridge.mul(0.35));
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

  useFrame((_, delta) => {
    if (!running.current) return;
    material.clock.value += delta;
    invalidate();
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.028, 0]} material={material.m}>
      <planeGeometry args={[MAP_WORLD.width * 3.2, MAP_WORLD.height * 3.6]} />
    </mesh>
  );
}
