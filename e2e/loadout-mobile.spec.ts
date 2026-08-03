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
  await expect(page.getByRole("heading", { name: "Loadout" })).toBeVisible();

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
    const weapons = document.querySelector('[aria-label="Weapon and body slots"]');
    const doll = document.querySelector('[aria-label="Equipment slots"]');
    if (!weapons || !doll) return { ok: false, reason: "missing gear groups" };
    const w = weapons.getBoundingClientRect();
    const d = doll.getBoundingClientRect();
    // Content must not be entirely outside the setup box (overflow:hidden collapse).
    const weaponsInView = w.bottom > rootRect.top + 8 && w.height > 24;
    const dollInView = d.bottom > rootRect.top + 8 && d.height > 24;
    return {
      ok: weaponsInView && dollInView,
      setupH: Math.round(rootRect.height),
      weaponsH: Math.round(w.height),
      dollH: Math.round(d.height),
      overflow: getComputedStyle(root).overflow,
      flex: getComputedStyle(root).flex,
    };
  });
  expect(clipped.ok, JSON.stringify(clipped)).toBe(true);
  expect(clipped.overflow).toMatch(/visible|auto/);

  await page.getByRole("button", { name: "Gear", exact: true }).click();
  const weapons = page.getByRole("group", { name: "Weapon and body slots" });
  await expect(weapons.getByRole("button", { name: /^Main-hand/ })).toBeVisible();
  await expect(weapons.getByRole("button", { name: /^Main-hand/ })).toBeEnabled();

  // Sub-nav still switches sections without re-collapsing.
  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await expect(page.locator(".buffs-panel, .loadout-panel-wide").first()).toBeVisible();
  const after = await setup.boundingBox();
  expect(after!.height).toBeGreaterThan(200);
});

test("Loadout summary metrics remain reachable under the stage on phone", async ({ page }) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  const summary = page.getByRole("complementary", { name: "Loadout summary" });
  await expect(summary).toBeVisible();
  // Scroll the page so the summary is in the viewport if it stacks below.
  await summary.scrollIntoViewIfNeeded();
  const box = await summary.boundingBox();
  expect(box!.height).toBeGreaterThan(40);
  await expect(summary.getByRole("group", { name: "Damage Potential", exact: true })).toBeVisible();
});
