"use client";

/**
 * Selective bloom, and nothing else.
 *
 * MRT splits emissive from output and only the emissive channel blooms, so the
 * gem on a selected marker and the sweep across a region that just unlocked can
 * swell without washing the map texture out. Everything on the board rests at
 * emissive zero, which is what makes this pass free at rest and the reason there
 * is no vignette, no aberration and no full-screen blur here. Map readability
 * wins every argument.
 *
 * Disposal is manual and complete: RenderPipeline.dispose() frees only the
 * output quad's material, so the scene pass render target and the bloom pass
 * would leak GPU textures on every route change without this.
 */

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { emissive, mrt, output, pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

export function Effects() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const pipeline = useMemo(() => {
    const renderer = gl as unknown as THREE.WebGPURenderer;
    const rp = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    scenePass.setMRT(mrt({ output, emissive }));
    const bloomPass = bloom(scenePass.getTextureNode("emissive"), 0.36, 0.5, 0.9);
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
