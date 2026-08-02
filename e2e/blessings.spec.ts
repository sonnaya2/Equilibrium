import { expect, test } from "@playwright/test";

test("Build blessing picks feed the combat workspace", async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await page.getByRole("combobox", { name: "Blessing tier 1" }).selectOption("Balance");
  await page.getByRole("combobox", { name: "Blessing tier 2" }).selectOption("Chaos");
  await page.getByRole("combobox", { name: "Blessing tier 3" }).selectOption("Chaos");

  await expect(page.getByText("God Tier One · Demon's Mark (Chaos)")).toBeVisible();
  await expect(page.getByText("Big Boned · Modeled · mechanics unverified")).toBeVisible();
  await expect(page.getByText("Abyssal Cinders · Modeled · mechanics unverified")).toBeVisible();
  await expect(page.getByText("Avernic Rampage · Modeled · mechanics unverified")).toBeVisible();
  await expect(page.getByText("Demon's Mark · Partial · mechanics unverified")).toBeVisible();

  await page.getByRole("button", { name: "Abilities", exact: true }).click();
  await page.getByText("Assumptions", { exact: true }).click();
  await expect(page.getByText("Equilibrium blessings", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Big Boned, Abyssal Cinders, Avernic Rampage, Demon's Mark/),
  ).toBeVisible();
});
