import { expect, test } from "@playwright/test";

test("uses the real world-map raster in both renderer paths", async ({ page }) => {
  const raster = page.waitForResponse((response) =>
    /\/map\/world-surface-wiki\.webp$/.test(new URL(response.url()).pathname),
  );
  await page.goto("/map");
  expect((await raster).ok()).toBe(true);
  await expect(
    page.locator("canvas, svg image[href='/map/world-surface-wiki.webp']").first(),
  ).toBeVisible();
});
