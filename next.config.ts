import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root; a stray lockfile above this dir otherwise wins inference.
  turbopack: { root: import.meta.dirname },
};

export default config;
