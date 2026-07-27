import { expect, test } from "@playwright/test";

const routes: Array<[string, string]> = [
  ["home", "/"],
  ["map", "/map"],
  ["tasks", "/tasks"],
  ["build", "/build"],
  ["combat", "/combat"],
  ["data", "/data"],
  ["sources", "/sources"],
];

for (const [name, path] of routes) {
  test(name, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page).toHaveScreenshot(`${name}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
  });
}
