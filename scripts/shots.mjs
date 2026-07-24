import { chromium } from "@playwright/test";

const routes = ["/", "/map", "/tasks", "/build", "/combat", "/data", "/sources"];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
for (const r of routes) {
  await page.goto(`http://localhost:3100${r}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `.shots${r === "/" ? "/home" : r}.png`, fullPage: true });
}
await browser.close();
console.log("done");
