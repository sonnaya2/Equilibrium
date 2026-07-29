import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/build");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("build shows region pick counter and Clear picks", async ({ page }) => {
  // The first counter may be in either the navigation or planner.
  await expect(page.getByText("0/3").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Clear picks" })).toBeVisible();
});

test("build caps elective regions without removing the fourth pick from focus", async ({
  page,
}) => {
  for (const name of ["Asgarnia", "Kandarin", "Fremennik Province"]) {
    await page.getByRole("button", { name: new RegExp(`^${name},`) }).click();
  }

  await expect(page.getByText("3/3").first()).toBeVisible();
  const fourth = page.getByRole("button", { name: /^Wilderness,/ });
  await expect(fourth).toHaveAttribute("aria-disabled", "true");
  await fourth.focus();
  await expect(fourth).toBeFocused();
});

test("share hash with empty storage does not crash build", async ({ page }) => {
  // Empty #b= is not a valid payload — page must still render the planner chrome.
  await page.goto("/build#b=");
  await expect(page.getByRole("button", { name: "Clear picks" })).toBeVisible();
  await expect(page.getByText(/0\/3|…\/3/).first()).toBeVisible();
});

test("final loadout mirrors Combat Setup gear", async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.setItem(
      "eq:loadout:v1",
      JSON.stringify({
        style: "magic",
        weaponTier: 90,
        equipmentSlots: { mainhand: "item:seismic-wand" },
      }),
    );
  });
  await page.reload();

  const loadout = page.getByRole("complementary", { name: "Final loadout" });
  await expect(loadout).toBeVisible();
  await expect(loadout.getByText("Magic", { exact: true })).toBeVisible();
  await expect(loadout.getByLabel("Main-hand: Seismic wand")).toBeVisible();
});
