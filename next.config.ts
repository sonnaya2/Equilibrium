import type { NextConfig } from "next";

// React dev tooling uses eval() for stack reconstruction; production does not.
// Keep 'unsafe-eval' out of prod CSP; allow it only when NODE_ENV is development.
const isDev = process.env.NODE_ENV === "development";
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  "'wasm-unsafe-eval'",
  ...(isDev ? ["'unsafe-eval'"] : []),
].join(" ");

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://runescape.wiki https://*.runescape.wiki",
  "font-src 'self'",
  "connect-src 'self' https://runescape.wiki",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const config: NextConfig = {
  // R3F WebGPU loses pointer bindings during StrictMode's dev-only remount.
  // Re-enable after the upstream fix, then rerun the map texture probe and hover check.
  reactStrictMode: false,
  // Pin the workspace root; a stray lockfile above this dir otherwise wins inference.
  turbopack: { root: import.meta.dirname },
  // Browsing via 127.0.0.1 instead of localhost is normal on this machine.
  allowedDevOrigins: ["127.0.0.1"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default config;
