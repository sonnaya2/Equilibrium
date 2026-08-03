import { defineConfig } from "@playwright/test";

/**
 * Stable combat/browser E2E only — no map / WebGPU board.
 * Use for local focused runs and optional CI; map coverage stays in the
 * full playwright.config.ts and headed WebGPU config.
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
  testMatch: ["**/combat*.spec.ts", "**/solver-smoke.spec.ts", "**/combat/**/*.spec.ts"],
  testIgnore: ["**/map*.spec.ts", "**/map-board*.spec.ts"],
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
    command: `npm run dev -- --port ${PORT}`,
    url: URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
