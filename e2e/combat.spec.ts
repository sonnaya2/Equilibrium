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
  await page.getByRole("button", { name: "manual", exact: true }).click();

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
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await expect(page.getByText("Queue · 2 casts")).toBeVisible();
});

test("rotation reports adrenaline starvation honestly in manual mode", async ({ page }) => {
  await page.getByRole("button", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await page.getByRole("checkbox", { name: "Auto-weave basics" }).uncheck();
  await page.getByRole("button", { name: /^Overpower 60%$/ }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText(/Rotation fails: overpower needs 60% adrenaline/)).toBeVisible();
});

test("auto-weave fills basics to afford a queued ultimate", async ({ page }) => {
  await page.getByRole("button", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Auto-weave basics" })).toBeChecked();

  await page.getByRole("button", { name: /^Overpower 60%$/ }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("DPS")).toBeVisible();
  await expect(page.getByText("24 ticks · 14.4s")).toBeVisible();
  await expect(page.getByText("auto").first()).toBeVisible();
});

test("setup gear filters equipment by region", async ({ page }) => {
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Setup" })).toBeVisible();
  await page.getByRole("button", { name: "Gear", exact: true }).click();

  await page.getByRole("combobox", { name: "Region" }).selectOption("misthalin");
  await expect(page.getByRole("button", { name: /Omni guard/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Seismic wand/ })).toBeHidden();
});

test("analysis tab compares two stat lines", async ({ page }) => {
  await page.getByRole("button", { name: "Analysis", exact: true }).click();
  await expect(page.getByText("A · Setup loadout")).toBeVisible();
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

test("rotation defaults to the shared setup loadout", async ({ page }) => {
  await page.getByRole("button", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  const toggle = page.getByRole("checkbox", { name: "Use Setup loadout" });
  await expect(toggle).toBeChecked();

  await page.getByRole("button", { name: /^Attack \+9%$/ }).click();
  await page.getByRole("button", { name: /^Attack \+9%$/ }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("DPS")).toBeVisible();
  await expect(page.getByText("6 ticks · 3.6s")).toBeVisible();
});

test("setup exposes gear doll, perks, buffs, and target", async ({ page }) => {
  await page.getByRole("button", { name: "Setup", exact: true }).click();
  await page.getByRole("button", { name: "Gear", exact: true }).click();
  await expect(page.getByText("Main-hand")).toBeVisible();
  await expect(page.getByText("Empty").first()).toBeVisible();

  await page.getByRole("button", { name: "Perks", exact: true }).click();
  await expect(page.getByText("Perks & sets")).toBeVisible();
  await expect(page.getByText(/Equilibrium rank \(\+6% \+2%\/rank/)).toBeVisible();

  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Vulnerability/ })).toBeVisible();

  await page.getByRole("button", { name: "Target", exact: true }).click();
  await page.getByRole("checkbox", { name: "Use NPC target model" }).check();
  await expect(page.getByText("Affinity")).toBeVisible();
});

test("revolution is the default mode with the wiki bar graphic", async ({ page }) => {
  await page.getByRole("button", { name: "Rotation", exact: true }).click();

  // Default melee dual-wield bar is fully engine-mapped post-audit.
  await expect(page.getByText(/10 of 10 slots modelled/)).toBeVisible();
  await expect(page.getByText("Meteor Strike")).toBeVisible();
  await expect(page.getByText("Chaos Roar")).toBeVisible();

  await page.getByRole("button", { name: "Run revolution" }).click();
  await expect(page.getByText("DPS")).toBeVisible();
  await expect(page.getByText("Casts")).toBeVisible();
});
