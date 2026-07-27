import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("quick calculator runs the real pipeline", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Abilities" })).toBeVisible();
  await expect(page.getByText("Damage Potential")).toBeVisible();

  await page.getByRole("option", { name: /Rend/ }).click();
  await expect(page.getByRole("heading", { name: "Rend" })).toBeVisible();
  await expect(page.getByText("+2 stacks")).toBeVisible();
});

test("rotation planner queues, simulates, and persists", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();

  const attack = page.getByRole("button", { name: /^Attack.*\+9%$/ });
  await attack.click();
  await attack.click();
  await expect(page.getByText("Queue · 2 casts")).toBeVisible();

  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("DPS")).toBeVisible();
  await expect(page.getByText("6 ticks · 3.6s")).toBeVisible();
  await expect(page.getByText("18%")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await expect(page.getByText("Queue · 2 casts")).toBeVisible();
});

test("rotation reports adrenaline starvation honestly in manual mode", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await page.getByRole("checkbox", { name: "Auto-weave basics" }).uncheck();
  await page.getByRole("button", { name: "Overpower ultimate 60%", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText(/Rotation fails: overpower needs 60% adrenaline/)).toBeVisible();
});

test("auto-weave fills basics to afford a queued ultimate", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Auto-weave basics" })).toBeChecked();

  await page.getByRole("button", { name: "Overpower ultimate 60%", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("DPS")).toBeVisible();
  await expect(page.getByText("24 ticks · 14.4s")).toBeVisible();
  await expect(page.getByText("auto").first()).toBeVisible();
});

test("setup gear filters equipment by region", async ({ page }) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Loadout" })).toBeVisible();
  await page.getByRole("button", { name: "Gear", exact: true }).click();

  await page.getByRole("checkbox", { name: "Match style" }).uncheck();
  await page.getByRole("combobox", { name: "Region" }).selectOption("misthalin");
  await expect(page.getByRole("button", { name: /Omni guard/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Seismic wand/ })).toBeHidden();
});

test("the main-hand picker accepts two-handed weapons and locks off-hand", async ({ page }) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  const weapons = page.getByRole("group", { name: "Weapon and body slots" });

  await expect(weapons.getByRole("button", { name: /^Two-hand/ })).toHaveCount(0);
  await weapons.getByRole("button", { name: /^Main-hand/ }).click();
  await page.getByRole("button", { name: /Masterwork 2h sword/ }).click();

  await expect(weapons.getByRole("button", { name: /^Main-hand.*Masterwork 2h sword/ })).toBeVisible();
  await expect(weapons.getByRole("button", { name: /^Off-hand/ })).toBeDisabled();
  await expect(weapons.getByText("Locked")).toBeVisible();
});

test("analysis tab compares two stat lines", async ({ page }) => {
  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  await expect(page.getByText("A · Loadout")).toBeVisible();
  await expect(page.getByText("B · Comparison")).toBeVisible();
  await expect(page.getByText("B − A")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Damage Potential" })).toBeVisible();
});

test("quick tab offers necromancy's sourced volley", async ({ page }) => {
  await page.getByRole("button", { name: "Necromancy" }).click();
  await page.getByRole("option", { name: /Volley of Souls/ }).click();
  await expect(page.getByRole("heading", { name: "Volley of Souls" })).toBeVisible();
  await expect(page.getByText("Residual Souls")).toBeVisible();
  await expect(page.getByText("Damage Potential")).toBeVisible();
});

test("rotation defaults to the shared setup loadout", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  const toggle = page.getByRole("checkbox", { name: "Use Loadout" });
  await expect(toggle).toBeChecked();

  await page.getByRole("button", { name: /^Attack.*\+9%$/ }).click();
  await page.getByRole("button", { name: /^Attack.*\+9%$/ }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("DPS")).toBeVisible();
  await expect(page.getByText("6 ticks · 3.6s")).toBeVisible();
});

test("setup exposes gear doll, perks, buffs, and target", async ({ page }) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Gear", exact: true }).click();
  // Scoped to the doll: every item row in the picker also names its slot, so
  // an unscoped "Main-hand" matches seven elements and fails strict mode.
  const doll = page.getByRole("group", { name: "Equipment slots" });
  await expect(doll.getByText("Main-hand")).toBeVisible();
  await expect(doll.getByText("Empty").first()).toBeVisible();

  await page.getByRole("button", { name: "Perks", exact: true }).click();
  await expect(page.getByText("Perks & sets")).toBeVisible();
  await expect(page.getByText(/Equilibrium rank \(R1 \+8% AD/)).toBeVisible();

  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Vulnerability/ })).toBeVisible();

  await page.getByRole("button", { name: "Target", exact: true }).click();
  await page.getByRole("checkbox", { name: "Use NPC target model" }).check();
  await expect(page.getByRole("combobox", { name: "Affinity" })).toBeVisible();
});

test("revolution is the default mode with the wiki bar graphic", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();

  // Revolution is the default Rotation mode — no need to switch away from manual.
  await expect(page.getByRole("button", { name: "Run bar" })).toBeVisible();
  await expect(page.getByText("Hit Run to see how the bar plays out.")).toBeVisible();
  await expect(page.getByTestId("revo-horizon-plan")).toHaveText(/100 ticks/);

  // Default melee dual-wield bar is fully engine-mapped post-audit.
  // Count is variable; assert the full-bar ready line rather than a hard slot total.
  await expect(page.getByText(/All \d+ revo slots ready/)).toBeVisible();
  await expect(page.getByText("Meteor Strike")).toBeVisible();
  await expect(page.getByText("Chaos Roar")).toBeVisible();

  await page.getByRole("button", { name: "Run bar" }).click();
  await expect(page.getByText("DPS", { exact: true })).toBeVisible();
  await expect(page.getByTestId("revo-horizon")).toHaveText(/^100$/);
  await expect(page.getByTestId("revo-casts")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  // Basics are auto-woven into the horizon; at least one basic row or the timeline table.
  const basics = page.locator("[data-basic='true']");
  const timeline = page.getByTestId("revo-cast-timeline");
  await expect(timeline).toBeVisible();
  await expect(basics.or(timeline.locator("tbody tr")).first()).toBeVisible();
});

test("manual rotation still exposes necromancy abilities", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await page.getByRole("button", { name: "Necromancy", exact: true }).click();
  await expect(page.getByRole("button", { name: /Volley of Souls/ })).toBeVisible();
});
