import { expect, test, devices } from "@playwright/test";

/**
 * Mobile Loadout must use document scroll (not a collapsed flex fill).
 * Regression: at max-width 850px, flex:1 1 0 + overflow:hidden + height:auto parents
 * collapsed .combat-setup to ~16px and clipped the entire Gear stage.
 */
const phone = devices["iPhone 13"];

test.use({
  ...phone,
  // Keep chromium project; only viewport/UA/touch from the device profile.
  browserName: "chromium",
});

test.beforeEach(async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("Loadout gear is usable on a phone viewport", async ({ page }) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Equipment" })).toBeVisible();

  const setup = page.locator(".combat-setup");
  await expect(setup).toBeVisible();

  const box = await setup.boundingBox();
  expect(box, "Loadout setup root must lay out").not.toBeNull();
  // Real gear + doll needs hundreds of px; collapsed flex fill was ~16px.
  expect(box!.height).toBeGreaterThan(280);

  const clipped = await page.evaluate(() => {
    const root = document.querySelector(".combat-setup");
    if (!root) return { ok: false, reason: "missing .combat-setup" };
    const rootRect = root.getBoundingClientRect();
    const equipment = document.querySelector('[aria-label="Equipped equipment"]');
    if (!equipment) return { ok: false, reason: "missing equipment grid" };
    const e = equipment.getBoundingClientRect();
    // Content must not be entirely outside the setup box (overflow:hidden collapse).
    const equipmentInView = e.bottom > rootRect.top + 8 && e.height > 24;
    return {
      ok: equipmentInView,
      setupH: Math.round(rootRect.height),
      equipmentH: Math.round(e.height),
      overflow: getComputedStyle(root).overflow,
      flex: getComputedStyle(root).flex,
    };
  });
  expect(clipped.ok, JSON.stringify(clipped)).toBe(true);
  expect(clipped.overflow).toMatch(/visible|auto/);

  // Equipment column keeps gear usable without a section sub-nav.
  await expect(page.getByRole("button", { name: /Main Hand:/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Main Hand:/ })).toBeEnabled();

  // Opening a workbench editor must not re-collapse the setup root.
  await page.getByRole("button", { name: "Show all active effects", exact: true }).click();
  const effects = page.getByRole("dialog", { name: "Active effects" });
  await expect(effects).toBeVisible();
  await expect(effects.locator(".buffs-panel, .loadout-panel-wide").first()).toBeVisible();
  await effects.getByRole("button", { name: "Close loadout editor" }).click();
  await expect(effects).toBeHidden();

  const after = await setup.boundingBox();
  expect(after!.height).toBeGreaterThan(200);
});

test("Loadout summary metrics remain reachable under the stage on phone", async ({ page }) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  const summary = page.getByRole("region", { name: "Combat results" });
  await expect(summary).toBeVisible();
  // Scroll the page so the summary is in the viewport if it stacks below.
  await summary.scrollIntoViewIfNeeded();
  const box = await summary.boundingBox();
  expect(box!.height).toBeGreaterThan(40);
  await expect(summary.getByRole("group", { name: "Damage Potential", exact: true })).toBeVisible();
});
