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
  await expect(page.getByText("0/3")).toBeVisible();
});

test("elective picks cap at three and persist", async ({ page }) => {
  for (const name of ["Kharidian Desert", "Morytania", "Tirannwn"]) {
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
  }
  await expect(page.getByText("3/3")).toBeVisible();

  const fourth = page.getByRole("button", { name: /^Asgarnia/ });
  await expect(fourth).toBeDisabled();

  await page.reload();
  await expect(page.getByText("3/3")).toBeVisible();

  await page.getByRole("button", { name: "Clear picks" }).click();
  await expect(page.getByText("0/3")).toBeVisible();
});

test("region detail joins against verified data", async ({ page }) => {
  await page.getByRole("button", { name: /^Asgarnia/ }).click();
  const panel = page.locator("section[aria-live]");
  await expect(panel.getByText("General Graardor")).toBeVisible();
  await expect(panel.getByText(/sources? · verified 2026-07-24/)).toBeVisible();
});

test("wilderness shows the Daemonheim hard rule", async ({ page }) => {
  await page.getByRole("button", { name: /^Wilderness/ }).click();
  await expect(page.getByText(/Daemonheim \(Dungeoneering\) is only available with this region/)).toBeVisible();
});
