import { defineConfig } from "@playwright/test";

/**
 * The WebGPU pass — the one that actually renders the board.
 *
 * Headless Chromium has no GPU adapter, so every 3D assertion in the default
 * config takes its honest skip and the board goes unverified. This runs the same
 * specs in a headed Edge parked off-screen, where the adapter is real.
 *
 *   npx playwright test -c playwright.webgpu.config.ts e2e/map-board.spec.ts
 *
 * Local only, like the rest of e2e (see docs/map-rendering.md) — CI has no GPU either.
 */
const PORT = 3101;
const URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  // One at a time: several WebGPU contexts on one adapter is how a passing suite
  // starts flaking on device-lost.
  workers: 1,
  use: {
    baseURL: URL,
    browserName: "chromium",
    channel: "msedge",
    headless: false,
    launchOptions: { args: ["--window-position=32000,32000"] },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
