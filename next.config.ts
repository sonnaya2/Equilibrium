import type { NextConfig } from "next";

const config: NextConfig = {
  // R3F WebGPU loses pointer bindings during StrictMode's dev-only remount.
  // Re-enable after the upstream fix, then rerun the map texture probe and hover check.
  reactStrictMode: false,
  // Pin the workspace root; a stray lockfile above this dir otherwise wins inference.
  turbopack: { root: import.meta.dirname },
  // Browsing via 127.0.0.1 instead of localhost is normal on this machine.
  allowedDevOrigins: ["127.0.0.1"],
};

export default config;
