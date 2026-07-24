import { chromium } from "@playwright/test";

const browser = await chromium.launch({
  channel: "msedge",
  headless: false,
  args: ["--window-position=32000,32000"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") errors.push(`${m.type()}: ${m.text()}`);
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
await page.goto(`http://localhost:${process.argv[2] ?? "3100"}/map`, { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
const hasCanvas = await page.locator("canvas").count();
const hasFallback = await page.getByText(/no WebGPU/).count();
console.log(`canvas: ${hasCanvas}, fallback-note: ${hasFallback}`);
await page.screenshot({ path: ".shots/map-3d.png", fullPage: false });
console.log(errors.length ? errors.join("\n") : "console clean");
await browser.close();
