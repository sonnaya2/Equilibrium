"use client";

/**
 * Selective bloom while unlock emissive is live — no React state.
 *
 * MRT + bloom only run when mapBloomWanted() (RegionPlate pokes during unlock).
 * At rest this component is a no-op and the normal demand-loop render stands.
 * Avoiding setState here killed a Cascading Update measure on every unlock edge.
 *
 * Disposal is manual: RenderPipeline.dispose() frees only the output quad's
 * material, so the scene pass render target and bloom pass would leak on route
 * change without the cleanup below.
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three/webgpu";
import { emissive, mrt, output, pass } from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { mapBloomWanted } from "./mapPerf";

/** Stable mount — gates GPU work inside useFrame, never re-mounts the tree. */
export function BloomWhenNeeded() {
  return <Effects />;
}

function Effects() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const built = useRef(false);

  const pipeline = useMemo(() => {
    const renderer = gl as unknown as THREE.WebGPURenderer;
    const rp = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    scenePass.setMRT(mrt({ output, emissive }));
    // High threshold: only unlock-sweep emissive should bloom.
    const bloomPass = bloom(scenePass.getTextureNode("emissive"), 0.28, 0.45, 0.96);
    rp.outputNode = scenePass.getTextureNode("output").add(bloomPass);
    built.current = true;
    return { rp, scenePass, bloomPass };
  }, [gl, scene, camera]);

  useEffect(
    () => () => {
      pipeline.bloomPass.dispose();
      pipeline.scenePass.renderTarget.dispose();
      pipeline.rp.dispose();
      built.current = false;
    },
    [pipeline],
  );

  useFrame(() => {
    // Idle: skip MRT path entirely (default R3F demand render already ran).
    if (!mapBloomWanted()) return;
    pipeline.rp.render();
  }, 1);

  return null;
}
