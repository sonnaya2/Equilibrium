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
  await expect(page.getByText("0/3").first()).toBeVisible();
});

test("elective picks cap at three and persist", async ({ page }) => {
  for (const name of ["Kharidian Desert", "Morytania", "Tirannwn"]) {
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  }
  await expect(page.getByText("3/3").first()).toBeVisible();

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
  const panel = page.locator('section[aria-label="Region detail"]');
  await expect(panel.locator(".panel-head")).toContainText("Asgarnia");
  await expect(panel.getByRole("columnheader", { name: "Boss" })).toBeVisible();
  await expect(panel.locator("tbody tr").first()).toBeVisible();
  await expect(
    page.locator("section[aria-live]").getByText(/sources? · verified \d{4}-\d{2}-\d{2}/),
  ).toBeVisible();
});

test("wilderness shows the Daemonheim hard rule", async ({ page }) => {
  await page.getByRole("button", { name: /^Wilderness/ }).click();
  const panel = page.locator('section[aria-label="Region detail"]');
  await expect(panel.getByText(/Daemonheim/).first()).toBeVisible();
});
