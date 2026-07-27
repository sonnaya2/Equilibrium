import { defineConfig } from "@playwright/test";

const PORT = 3102;

export default defineConfig({
  testDir: "css-visual",
  timeout: 60_000,
  retries: 0,
  snapshotPathTemplate: "css-visual/baseline/{projectName}/{arg}{ext}",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm start -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "sm", use: { browserName: "chromium", viewport: { width: 640, height: 900 } } },
    { name: "md", use: { browserName: "chromium", viewport: { width: 768, height: 900 } } },
    { name: "lg", use: { browserName: "chromium", viewport: { width: 1024, height: 900 } } },
    { name: "xl", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
});
