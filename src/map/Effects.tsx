"use client";

/**
 * Selective bloom, and nothing else.
 *
 * MRT splits emissive from output and only the emissive channel blooms. At rest
 * every plate is emissive zero, so the pass is cheap — but the RenderPipeline
 * still owns presentation. Skipping `rp.render()` leaves a blank canvas (the
 * demand loop's default path is not a safe substitute once the pipeline exists).
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

/** Route mount name kept stable for MapScene. */
export function BloomWhenNeeded() {
  return <Effects />;
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

  // Always present — never gate this call. See file header.
  useFrame(() => {
    pipeline.rp.render();
  }, 1);

  return null;
}
