import { defineConfig } from "@playwright/test";

/** Run e2e against an already-running `npm run dev` (port 3000). */
export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: { baseURL: "http://localhost:3000" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
