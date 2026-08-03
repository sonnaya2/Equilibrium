import { defineConfig } from "@playwright/test";

/**
 * Run e2e against an already-running Equilibrium dev server (no webServer spawn).
 * Default port 3100 - same as playwright.config.ts (3000 is EverSense on this machine).

 *   npm run dev -- --port 3100
 *   npx playwright test -c playwright.reuse.config.ts
 */
const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
if (!Number.isInteger(PORT) || PORT < 1024 || PORT > 65535) {
  throw new Error("PLAYWRIGHT_PORT must be an integer between 1024 and 65535.");
}
const URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  workers: 1,
  use: {
    baseURL: URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
