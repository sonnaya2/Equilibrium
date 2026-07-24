"use client";

import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { emissive, mrt, output, pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

/**
 * RenderPipeline + MRT selective bloom: only the emissive channel blooms,
 * so unlocked gem-light swells without washing the map texture out.
 * useFrame priority 1 takes over rendering from R3F.
 */
export function Effects() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const pipeline = useMemo(() => {
    const renderer = gl as unknown as THREE.WebGPURenderer;
    const rp = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    scenePass.setMRT(mrt({ output, emissive }));
    const bloomPass = bloom(scenePass.getTextureNode("emissive"), 0.6, 0.4, 0.85);
    rp.outputNode = scenePass.getTextureNode("output").add(bloomPass);
    return rp;
  }, [gl, scene, camera]);

  useEffect(() => () => pipeline.dispose(), [pipeline]);
  useFrame(() => {
    pipeline.render();
  }, 1);

  return null;
}
