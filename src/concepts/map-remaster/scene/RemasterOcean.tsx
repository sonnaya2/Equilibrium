"use client";

/**
 * Lit multi-swell sea for concept remasters — skin-tuned TSL via remasterOcean factory.
 * Timer-driven 30Hz idle; rides IntersectionObserver + reduced motion.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MAP_WORLD } from "@/map/data/regionAnchors";
import { createDaylitOceanMaterial } from "./materials/daylitOcean";
import { createRemasterOceanMaterial } from "./materials/remasterOcean";
import { useRemaster } from "./remasterState";

export function RemasterOcean({ reducedMotion }: { reducedMotion: boolean }) {
  const { skin } = useRemaster();
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const running = useRef(!reducedMotion);

  const material = useMemo(
    () => (skin.id === "daylit" ? createDaylitOceanMaterial() : createRemasterOceanMaterial(skin)),
    [skin],
  );

  useEffect(() => () => material.dispose(), [material]);

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

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      if (running.current) invalidate();
    }, 1000 / 30);
    return () => window.clearInterval(id);
  }, [invalidate, reducedMotion]);

  useFrame((_, delta) => {
    if (!running.current) return;
    // uniform(0) value is typed unknown under r185 — advance as number.
    material.clock.value = (material.clock.value as number) + delta;
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.03, 0]}
      material={material.m}
      receiveShadow
    >
      <planeGeometry args={[MAP_WORLD.width * 4.2, MAP_WORLD.width * 4.2]} />
    </mesh>
  );
}
