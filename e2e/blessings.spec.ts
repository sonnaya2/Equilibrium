import { expect, test } from "@playwright/test";

test("Build blessing picks feed the combat workspace", async ({ page }) => {
  await page.goto("/build");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  // Path lattice unlocks sequentially; Balance→Chaos→Chaos grants Big Boned, Cinders, Rampage + Demon's Mark.
  await page.getByRole("button", { name: /Balance, tier 1$/ }).click();
  await page.getByRole("button", { name: /Chaos, tier 2$/ }).click();
  await page.getByRole("button", { name: /Chaos, tier 3$/ }).click();

  await page.goto("/combat");
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();

  // League loadout mirror on Setup shows the active path cards.
  const league = page.locator(".setup-league-display");
  await expect(league.getByText("Big Boned")).toBeVisible();
  await expect(league.getByText("Abyssal Cinders")).toBeVisible();
  await expect(league.getByText("Avernic Rampage")).toBeVisible();
  await expect(league.getByText("Demon's Mark")).toBeVisible();

  // Analysis assumptions list the same blessings for the combat pipeline.
  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  const assumptions = page.locator("details").filter({ hasText: "Assumptions" }).first();
  await assumptions.locator("summary").click();
  await expect(assumptions.getByText("Equilibrium blessings", { exact: true })).toBeVisible();
  await expect(
    assumptions.getByText(/Big Boned, Abyssal Cinders, Avernic Rampage, Demon's Mark/),
  ).toBeVisible();
});
