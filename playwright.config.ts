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
    command: `npm run dev -- --port ${PORT}`,
    url: URL,
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
