import { expect, test } from "@playwright/test";

test("map mounts the 3D scene or the honest unsupported state", async ({ page }) => {
  await page.goto("/map");
  const canvas = page.locator("canvas").first();
  const mounted = await canvas
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (mounted) {
    await expect(canvas).toBeVisible();
  } else {
    await expect(page.getByText(/no WebGPU/).first()).toBeVisible({ timeout: 15_000 });
  }
});