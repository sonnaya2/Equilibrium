import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("quick calculator runs the real pipeline", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Abilities" })).toBeVisible();
  await expect(page.getByText("Damage Potential").first()).toBeVisible();

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
  await expect(page.getByText("Natural DPS", { exact: true })).toBeVisible();
  await expect(page.getByText("6 ticks · 3.6s").first()).toBeVisible();
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
  await expect(page.getByText("Natural DPS", { exact: true })).toBeVisible();
  await expect(page.getByText("24 ticks · 14.4s").first()).toBeVisible();
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

  await expect(
    weapons.getByRole("button", { name: /^Main-hand.*Masterwork 2h sword/ }),
  ).toBeVisible();
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
  await expect(page.getByText("Natural DPS", { exact: true })).toBeVisible();
  await expect(page.getByText("6 ticks · 3.6s").first()).toBeVisible();
});

test("setup exposes gear, archaeology, invention, buffs, and target", async ({ page }) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Gear", exact: true }).click();
  const doll = page.getByRole("group", { name: "Equipment slots" });
  await expect(doll.getByText("Main-hand")).toBeVisible();
  await expect(doll.getByText("Empty").first()).toBeVisible();

  await page.getByRole("button", { name: "Archaeology", exact: true }).click();
  await expect(page.getByText(/No sourced Archaeology relic/)).toBeVisible();

  await page.getByRole("button", { name: "Invention", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Invention" })).toBeVisible();
  await page
    .getByRole("combobox", { name: /Add a perk to Weapon gizmo 1/ })
    .selectOption("aftershock");
  await expect(page.getByRole("combobox", { name: "Aftershock rank" })).toHaveValue("1");
  await expect(
    page
      .getByRole("combobox", { name: /Add a perk to Armour gizmo 1/ })
      .locator("option[value=aftershock]"),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: /Vulnerability/ })).toBeVisible();
  const agony = page.getByRole("button", { name: /Agony/ });
  await expect(agony).toHaveAttribute("aria-pressed", "true");
  await agony.click();
  await expect(agony).toHaveAttribute("aria-pressed", "false");

  // Buffs are icon tiles: the name and effect survive only in the accessible name.
  const elder = page.getByRole("button", { name: /Elder overload/ });
  await expect(elder).toHaveAttribute("aria-pressed", "false");
  await elder.click();
  await expect(elder).toHaveAttribute("aria-pressed", "true");
  // Overload boosts every combat stat, so Summary reports base + boost.
  await expect(
    page
      .getByRole("definition")
      .filter({ hasText: /\(99 \+\d+\)/ })
      .first(),
  ).toBeVisible();
  await expect(page.getByText("Equip set pieces in Gear to activate their effects.")).toBeVisible();

  await page.getByRole("button", { name: "Target", exact: true }).click();
  await page.getByRole("checkbox", { name: "Use NPC target model" }).check();
  await expect(page.getByRole("combobox", { name: "Affinity" })).toBeVisible();
});

test("revolution is the default mode with the wiki bar graphic", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();

  await expect(page.getByRole("button", { name: "Run bar" })).toBeVisible();
  await expect(page.getByText("Hit Run to see how the bar plays out.")).toBeVisible();
  await expect(page.getByTestId("revo-horizon-plan")).toHaveText(/100 ticks/);

  await expect(page.getByText(/All \d+ revo slots ready/)).toBeVisible();
  await expect(page.getByText("Meteor Strike")).toBeVisible();
  await expect(page.getByText("Chaos Roar")).toBeVisible();

  await page.getByRole("button", { name: "Run bar" }).click();
  await expect(page.getByText("Fixed-window DPS", { exact: true })).toBeVisible();
  await expect(page.getByTestId("revo-horizon")).toHaveText(/^100$/);
  await expect(page.getByTestId("revo-casts")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
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

test("loadout calculation controls reset automatic base and persist into Revolution", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Stats", exact: true }).click();

  const baseMode = page.getByRole("combobox", { name: "Base damage" });
  await baseMode.selectOption("manual");
  await page.getByRole("spinbutton", { name: "Manual base override" }).fill("9999");
  await expect(page.getByText("Base AD · manual", { exact: true })).toBeVisible();

  await page.getByRole("spinbutton", { name: "Main weapon tier" }).fill("91");
  await expect(baseMode).toHaveValue("automatic");
  await page.getByRole("spinbutton", { name: "Starting adrenaline" }).fill("62");
  await page.getByRole("checkbox", { name: "30,000 hit cap" }).uncheck();

  await page.reload();
  await page.getByRole("tab", { name: "Abilities", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Use Loadout" })).toBeChecked();
  await expect(page.getByRole("spinbutton", { name: "Base ability damage" })).toHaveValue("1705");

  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "Run bar" }).click();
  const assumptions = page.locator("details").filter({ hasText: "Assumptions" }).first();
  await assumptions.getByText("Assumptions", { exact: true }).click();
  await expect(assumptions.getByText("62%", { exact: true })).toBeVisible();
  await expect(assumptions.getByText("Off", { exact: true })).toBeVisible();
});

test("rotation analysis opens the engine-owned event breakdown", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "Run bar" }).click();
  await expect(page.getByRole("heading", { name: "Resolved events" })).toBeVisible();
  await expect(page.getByText("Assumptions", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Analyze damage" }).click();
  const dialog = page.getByRole("dialog", { name: "Damage analysis" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "By source" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "By effect" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Resolved timeline" })).toBeVisible();
  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden();
});

test("set effects come only from equipped gear", async ({ page }) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await expect(page.getByText("Equip set pieces in Gear to activate their effects.")).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: /^Tectonic/ })).toHaveCount(0);
});
