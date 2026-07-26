import { expect, test } from "@playwright/test";

test("tasks shows provisional banner or loaded count", async ({ page }) => {
  await page.goto("/tasks");
  // Equilibrium list is empty pre-launch — Catalyst stand-in shows Provisional.
  // When real tasks ship, the count line is enough. Never pin task names.
  const provisional = page.getByText(/Provisional/i);
  const loaded = page.getByText(/\d+ tasks loaded/);
  await expect(provisional.or(loaded).first()).toBeVisible();
});

test("tasks points section is present", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { name: "Points" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Task list" })).toBeVisible();
});
