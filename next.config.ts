import type { NextConfig } from "next";

const config: NextConfig = {
  // Off deliberately, and only because of the WebGPU map.
  //
  // StrictMode's dev-only double-mount replays mount/unmount on a fresh fiber.
  // For <Canvas> that means a second WebGPURenderer is built over the same
  // canvas; its getContext('webgpu') + configure() displaces the first, so
  // frames keep drawing while R3F's event system stays bound to the root that
  // was torn down. The result is a board that renders perfectly and cannot be
  // hovered or clicked — every region unpickable, in dev only.
  //
  // Measured, not assumed: the same hover sweep over the board scores 0 hits
  // with this on and 42 with it off, and the production build has always scored
  // 42 because production never replays. The bug predates the current map work.
  //
  // Caching the renderer per canvas (src/map/MapScene.tsx) removes the duplicate
  // renderer but does not restore the event binding, so this flag is the part
  // that makes dev usable. Revisit when R3F/three fix it upstream: flip it back
  // on, then re-run scripts/probe-map-texture.mjs and a hover check.
  reactStrictMode: false,
  // Pin the workspace root; a stray lockfile above this dir otherwise wins inference.
  turbopack: { root: import.meta.dirname },
  // Browsing via 127.0.0.1 instead of localhost is normal on this machine.
  allowedDevOrigins: ["127.0.0.1"],
};

export default config;
