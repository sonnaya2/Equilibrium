import { expect, test } from "@playwright/test";

/**
 * /data Major unlocks → /map deep links.
 * Place names are structural anchors, not scraped dates.
 */

test("data location link opens the map on the place", async ({ page }) => {
  await page.goto("/data");

  const digSite = page
    .locator(".data-region-content-table tbody tr")
    .filter({ hasText: "Varrock Dig Site" });
  const link = digSite.getByRole("link", { name: /Open .+ on map/i });
  await expect(link).toBeVisible();

  await link.click();
  await expect(page).toHaveURL(/\/map#region=misthalin&place=/);

  // Map hydrates and inspector subject is Misthalin.
  const panel = page.locator('section[aria-label="Region detail"]');
  await expect(panel.locator(".panel-head")).toContainText("Misthalin", { timeout: 20_000 });
});

test("asgarnia boss location links to a GWD place pin", async ({ page }) => {
  await page.goto("/data");
  await page.getByRole("option", { name: /^Asgarnia,/ }).click();

  const graardor = page
    .locator(".data-region-content-table tbody tr")
    .filter({ hasText: "General Graardor" });
  const link = graardor.getByRole("link", { name: /Open .+ on map/i });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", /\/map#region=asgarnia&place=/);
});
