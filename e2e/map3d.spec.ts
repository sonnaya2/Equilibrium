import { expect, test } from "@playwright/test";

test("map mounts the 3D scene or the honest unsupported state", async ({ page }) => {
  await page.goto("/map");
  const canvas = page.locator("canvas");
  const fallback = page.getByText(/no WebGPU/);
  await expect(canvas.or(fallback)).toBeVisible({ timeout: 15_000 });
});
