import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("quick calculator runs the real pipeline", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Quick" })).toBeVisible();
  await expect(page.getByText("Damage Potential")).toBeVisible();

  await page.getByRole("button", { name: /Rend/ }).click();
  await expect(page.getByRole("heading", { name: "Rend" })).toBeVisible();
  await expect(page.getByText("+2 stacks")).toBeVisible();
});

test("rotation planner queues, simulates, and persists", async ({ page }) => {
  await page.getByRole("button", { name: "Rotation", exact: true }).click();

  const attack = page.getByRole("button", { name: /^Attack \+9%$/ });
  await attack.click();
  await attack.click();
  await expect(page.getByText("Queue · 2 casts")).toBeVisible();

  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("DPS")).toBeVisible();
  await expect(page.getByText("6 ticks · 3.6s")).toBeVisible();
  await expect(page.getByText("18%")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Rotation", exact: true }).click();
  await expect(page.getByText("Queue · 2 casts")).toBeVisible();
});

test("rotation reports adrenaline starvation honestly", async ({ page }) => {
  await page.getByRole("button", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: /^Overpower 60%$/ }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText(/Rotation fails: overpower needs 60% adrenaline/)).toBeVisible();
});

test("build tab filters equipment by region", async ({ page }) => {
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Loadout" })).toBeVisible();

  await page.getByRole("combobox", { name: "Region" }).selectOption("misthalin");
  await expect(page.getByRole("button", { name: /Omni guard/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Seismic wand/ })).toBeHidden();
});

test("analysis tab compares two stat lines", async ({ page }) => {
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await expect(page.getByText("A · Build loadout")).toBeVisible();
  await expect(page.getByText("B · Comparison")).toBeVisible();
  await expect(page.getByText("B − A")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Damage Potential" })).toBeVisible();
});

test("quick tab offers necromancy's sourced volley", async ({ page }) => {
  await page.getByRole("button", { name: "Necromancy" }).click();
  await expect(page.getByRole("heading", { name: "Volley of Souls" })).toBeVisible();
  await expect(page.getByText("Residual Souls")).toBeVisible();
  await expect(page.getByText("Damage Potential")).toBeVisible();
});

test("rotation defaults to the shared build loadout", async ({ page }) => {
  await page.getByRole("button", { name: "Rotation", exact: true }).click();
  const toggle = page.getByRole("checkbox", { name: "Use Build loadout" });
  await expect(toggle).toBeChecked();

  await page.getByRole("button", { name: /^Attack \+9%$/ }).click();
  await page.getByRole("button", { name: /^Attack \+9%$/ }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("DPS")).toBeVisible();
  await expect(page.getByText("6 ticks · 3.6s")).toBeVisible();
});

test("build tab exposes target and perk sections", async ({ page }) => {
  await page.getByRole("button", { name: "Build", exact: true }).click();
  await expect(page.getByText("Perks & sets")).toBeVisible();
  await expect(page.getByText("Equilibrium rank (+10% +1%/rank AD)")).toBeVisible();
  await page.getByRole("checkbox", { name: "Use NPC target model" }).check();
  await expect(page.getByText("Affinity")).toBeVisible();
});
