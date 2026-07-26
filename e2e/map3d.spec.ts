import { expect, test } from "@playwright/test";

test("map mounts the 3D scene or the honest unsupported state", async ({ page }) => {
  await page.goto("/map");
  // Prefer canvas when WebGPU works. The canvas mounts only after an async
  // adapter probe and the dynamic 3D chunk, so counting immediately reports 0
  // even on a capable browser and sends this into the fallback branch — where
  // "no WebGPU" never appears, because WebGPU is fine. Wait, then decide.
  const canvas = page.locator("canvas").first();
  const mounted = await canvas
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (mounted) {
    await expect(canvas).toBeVisible();
  } else {
    // Fallback copy may match more than once (visible paragraph + sr-only).
    await expect(page.getByText(/no WebGPU/).first()).toBeVisible({ timeout: 15_000 });
  }
});