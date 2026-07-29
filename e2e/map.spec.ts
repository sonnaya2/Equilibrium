import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/map");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("region planner lists all 11 regions", async ({ page }) => {
  for (const name of [
    "Misthalin",
    "Havenhythe",
    "Karamja",
    "Asgarnia",
    "Kandarin",
    "Fremennik Province",
    "Wilderness",
    "Kharidian Desert",
    "Morytania",
    "Tirannwn",
    "Anachronia",
  ]) {
    await expect(page.getByRole("button", { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  // The first counter may be in either the navigation or ledger.
  await expect(page.getByText("0/3").first()).toBeVisible();
});

test("elective picks cap at three and persist", async ({ page }) => {
  for (const name of ["Kharidian Desert", "Morytania", "Tirannwn"]) {
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  }
  await expect(page.getByText("3/3").first()).toBeVisible();

  // Cap blocks pick, not focus — we use aria-disabled, not the native disabled
  // attribute (Playwright treats aria-disabled as not "enabled").
  const fourth = page.getByRole("button", { name: /^Asgarnia/ });
  await expect(fourth).toHaveAttribute("aria-disabled", "true");
  await expect(fourth).not.toHaveAttribute("disabled");
  await fourth.focus();
  await expect(fourth).toBeFocused();

  await page.reload();
  await expect(page.getByText("3/3").first()).toBeVisible();

  await page.getByRole("button", { name: "Clear picks" }).click();
  await expect(page.getByText("0/3").first()).toBeVisible();
});

test("region detail joins against verified data", async ({ page }) => {
  await page.getByRole("button", { name: /^Asgarnia/ }).click();
  // Interactive chrome lives outside the live region; structural content is
  // under the labelled panel. Live status still carries the sources line.
  const panel = page.locator('section[aria-label="Region detail"]');
  // Structural only — named content rows move with data sync; do not pin them.
  // Bosses is the default detail tab.
  await expect(panel.locator(".panel-head")).toContainText("Asgarnia");
  await expect(panel.getByRole("columnheader", { name: "Boss" })).toBeVisible();
  await expect(panel.locator("tbody tr").first()).toBeVisible();
  // Date stays a pattern: pinning it makes every data sync fail this test.
  // RegionInspector is section[aria-label="Region detail"][aria-live] under the board stack.
  await expect(
    page.locator("section[aria-live]").getByText(/sources? · verified \d{4}-\d{2}-\d{2}/),
  ).toBeVisible();
});

test("wilderness shows the Daemonheim hard rule", async ({ page }) => {
  await page.getByRole("button", { name: /^Wilderness/ }).click();
  const panel = page.locator('section[aria-label="Region detail"]');
  // Soft pin scoped to the inspector: area chips can also say Daemonheim.
  await expect(panel.getByText(/Daemonheim/).first()).toBeVisible();
});
