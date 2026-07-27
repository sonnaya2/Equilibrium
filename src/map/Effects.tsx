"use client";

/**
 * Selective bloom, only while something actually emissives.
 *
 * MRT splits emissive from output and only the emissive channel blooms, so the
 * unlock sweep green ring can swell without washing the map. At rest every
 * plate is emissive zero — so the whole post stack is gated by mapBloomWanted()
 * (RegionPlate pokes during unlock). No vignette, no aberration, no full-screen
 * blur. Map readability wins every argument.
 *
 * Disposal is manual and complete: RenderPipeline.dispose() frees only the
 * output quad's material, so the scene pass render target and the bloom pass
 * would leak GPU textures on every route change without this.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { emissive, mrt, output, pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { mapBloomWanted } from "./mapPerf";

/** Mount the bloom pipeline only while an unlock (or other poke) wants it. */
export function BloomWhenNeeded() {
  const [on, setOn] = useState(false);
  const last = useRef(false);
  useFrame(() => {
    const want = mapBloomWanted();
    if (want !== last.current) {
      last.current = want;
      setOn(want);
    }
  });
  return on ? <Effects /> : null;
}

function Effects() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const pipeline = useMemo(() => {
    const renderer = gl as unknown as THREE.WebGPURenderer;
    const rp = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    scenePass.setMRT(mrt({ output, emissive }));
    // High threshold: only unlock-sweep / marker gem emissive should bloom.
    // A lower floor picks up MRT noise and reads as full-board sparkle.
    const bloomPass = bloom(scenePass.getTextureNode("emissive"), 0.28, 0.45, 0.96);
    rp.outputNode = scenePass.getTextureNode("output").add(bloomPass);
    return { rp, scenePass, bloomPass };
  }, [gl, scene, camera]);

  useEffect(
    () => () => {
      pipeline.bloomPass.dispose();
      pipeline.scenePass.renderTarget.dispose();
      pipeline.rp.dispose();
    },
    [pipeline],
  );

  useFrame(() => {
    pipeline.rp.render();
  }, 1);

  return null;
}
