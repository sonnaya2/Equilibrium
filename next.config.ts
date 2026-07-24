import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root; a stray lockfile above this dir otherwise wins inference.
  turbopack: { root: import.meta.dirname },
  // Browsing via 127.0.0.1 instead of localhost is normal on this machine.
  allowedDevOrigins: ["127.0.0.1"],
};

export default config;
