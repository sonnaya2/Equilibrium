"use client";

/**
 * The sea the board sits in — Daylit Reliquary quality.
 *
 * Lit multi-swell water (MeshStandardNodeMaterial) with fresnel graze and foam
 * ridges. Cheap ALU only: three crossed sines, no fractal ocean. Coasts must
 * read; slabs stay the brightest thing on the board.
 *
 * This is the one thing on the route that animates at rest, which the design law
 * otherwise bans. `prefers-reduced-motion` freezes it, and it only drives the
 * frameloop while the canvas is actually on screen.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three/webgpu";
import { useFrame, useThree } from "@react-three/fiber";
import {
  float,
  mix,
  normalView,
  positionViewDirection,
  positionWorld,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";
import { MAP_WORLD } from "./data/regionAnchors";
import { SURFACE_VOID } from "./palette";

/** Daylit noon sea — brighter than the old dark teals so coasts separate at noon. */
const DEEP = 0x0a242c;
const SHALLOW = 0x1a5a52;
const FOAM = 0x6ab8a0;

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
    const m = new THREE.MeshStandardNodeMaterial({
      roughness: 0.14,
      metalness: 0.06,
    });
    // Frozen under reduced motion: the clock stops, the surface stays.
    const clock = uniform(0);

    // Deliberately sines, not noise. This plane covers most of the viewport once
    // the camera descends, so its fragment cost is paid on nearly every pixel at
    // whatever dpr the display has. A 3-octave fractal noise here locked up real
    // hardware at dpr 2 while headless dpr 1 looked fine. Three crossed waves
    // cost a handful of ALU ops and read as multi-swell at this scale.
    const p = positionWorld.xz;
    const t = clock;
    const a = p.x.mul(15).add(p.y.mul(6.5)).add(t.mul(0.9)).sin();
    const b = p.y.mul(19).sub(p.x.mul(7.5)).sub(t.mul(0.58)).sin();
    const c = p.x.mul(10).add(p.y.mul(12)).add(t.mul(0.32)).sin();
    const swell = a.mul(0.44).add(b.mul(0.36)).add(c.mul(0.2));

    const deep = linear(DEEP);
    const shallow = linear(SHALLOW);
    const foam = linear(FOAM);

    // Wider shallow band under noon so coasts separate from land.
    const base = mix(deep, shallow, swell.mul(0.26).add(0.38));
    const ridge = smoothstep(float(0.78), float(0.97), swell.abs());
    let water = mix(base, foam, ridge.mul(0.32));

    // Fresnel-ish graze: plane normal is +Y -> normalView.y high when facing camera.
    // Grazing shots have lower N.V -> brighten toward foam.
    const ndv = normalView.dot(positionViewDirection).clamp(0, 1);
    const fresnel = float(1).sub(ndv).pow(2.4);
    water = mix(water, foam.mul(0.85).add(shallow.mul(0.15)), fresnel.mul(0.28));

    // Dissolve into the void at the horizon so there is no hard black bar.
    const horizon = smoothstep(float(1.08), float(2.5), p.length());
    m.colorNode = mix(water, linear(SURFACE_VOID), horizon);
    m.emissiveNode = shallow.mul(ridge.mul(0.07)).add(foam.mul(fresnel.mul(0.04)));
    m.roughnessNode = float(0.12).add(ridge.mul(0.18)).add(fresnel.mul(0.08));
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
   * without asking again and the loop went to sleep for good.
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
