import { expect, test } from "@playwright/test";

test("map mounts the 3D scene or the honest unsupported state", async ({ page }) => {
  await page.goto("/map");
  // Prefer canvas when WebGPU works. Fallback copy may match more than once
  // (visible paragraph + sr-only), so pin the first match only.
  const canvas = page.locator("canvas").first();
  if ((await page.locator("canvas").count()) > 0) {
    await expect(canvas).toBeVisible({ timeout: 15_000 });
  } else {
    await expect(page.getByText(/no WebGPU/).first()).toBeVisible({ timeout: 15_000 });
  }
});