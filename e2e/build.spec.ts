import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/build");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("build shows region pick counter and Clear picks", async ({ page }) => {
  // Same contract as the map: empty electives read 0/3 once storage hydrates.
  await expect(page.getByText("0/3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear picks" })).toBeVisible();
});

test("share hash with empty storage does not crash build", async ({ page }) => {
  // Empty #b= is not a valid payload — page must still render the planner chrome.
  await page.goto("/build#b=");
  await expect(page.getByRole("button", { name: "Clear picks" })).toBeVisible();
  await expect(page.getByText(/0\/3|…\/3/)).toBeVisible();
});
