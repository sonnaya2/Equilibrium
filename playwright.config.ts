import { defineConfig } from "@playwright/test";

// Port 3100: 3000 is permanently occupied by the EverSense dev server on this
// machine — reusing it serves the wrong app and every test 404s.
const PORT = 3100;
const URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: { baseURL: URL },
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
