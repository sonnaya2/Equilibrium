import { defineConfig } from "@playwright/test";

/**
 * Default local E2E (Chromium, headless). Port 3100 by default - 3000 is used
 * by another app on this machine. Map/WebGPU board assertions skip without a
 * GPU adapter; use playwright.webgpu.config.ts for a headed Edge pass.

 *   npm run playwright:install   # browsers (once per machine / package bump)
 *   npm run test:e2e             # full e2e/
 *   npm run test:e2e:combat      # combat-only (no map suite)
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  throw new Error("PLAYWRIGHT_PORT must be an integer between 1024 and 65535.");
}
const WORKERS = Number(process.env.PLAYWRIGHT_WORKERS ?? 1);
if (!Number.isInteger(WORKERS) || WORKERS < 1 || WORKERS > 64) {
  throw new Error("PLAYWRIGHT_WORKERS must be an integer between 1 and 64.");
}
const URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  workers: WORKERS,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : "list",
  outputDir: "test-results",
  use: {
    baseURL: URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  webServer: {
    // Same-directory second `next dev` is rejected (lockfile). Stop any local
    // `npm run dev` for this repo before CI-like runs; 3000 is EverSense.
    command: `npm run dev -- --port ${PORT}`,
    url: URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
