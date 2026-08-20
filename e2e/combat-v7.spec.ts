import { expect, test, type Locator, type Page } from "@playwright/test";

function installFailureCapture(page: Page) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() === 404) failures.push(`404: ${response.url()}`);
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  return failures;
}

async function openCombat(page: Page) {
  await page.addInitScript(() => {
    const marker = "combat-v7-storage-cleared";
    if (window.sessionStorage.getItem(marker) === null) {
      window.localStorage.clear();
      window.sessionStorage.setItem(marker, "true");
    }
  });
  await page.goto("/combat");
  await page.waitForFunction(() => window.localStorage.getItem("eq:combat:setups:v1") !== null);
}

async function closeLoadoutEditor(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Close loadout editor" }).click();
  await expect(dialog).toBeHidden();
}

async function expectCenteredDialog(page: Page, dialog: Locator) {
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  if (!box || !viewport) return;
  expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThan(8);
  expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThan(8);
}

async function occupyLoadout(page: Page) {
  await page.getByRole("button", { name: /^Helmet:/ }).click();
  const dialog = page.getByRole("dialog", { name: "Change equipment" });
  const malevolence = dialog
    .getByTestId("prayer-picker")
    .getByRole("button", { name: /Malevolence/ });
  await expect(malevolence).toHaveAttribute("aria-pressed", "true");
  await closeLoadoutEditor(page);

  await page.getByRole("button", { name: "Show all active effects", exact: true }).click();
  const effects = page.getByRole("dialog", { name: "Active effects" });
  await expect(effects.getByRole("checkbox", { name: /Vulnerability/ })).toBeChecked();
  await closeLoadoutEditor(page);

  await page
    .getByRole("button", { name: /^(Set|Change) Weapon 1/ })
    .first()
    .click();
  const perks = page.getByRole("dialog", { name: "Change perks" });
  await expect(perks).toBeVisible();
  await closeLoadoutEditor(page);

  await page
    .getByRole("button", { name: "Click here to update relic", exact: true })
    .first()
    .click();
  const relics = page.getByRole("dialog", { name: "Archaeology" });
  const availableRelics = relics.locator("button.arch-relic-tile:not([disabled])");
  await expect(availableRelics.first()).toBeVisible();
  await availableRelics.nth(0).click();
  await availableRelics.nth(1).click();
  await availableRelics.nth(2).click();
  await closeLoadoutEditor(page);

  await page.getByRole("button", { name: "Edit target", exact: true }).click();
  const target = page.getByRole("dialog", { name: "Edit target" });
  await target.getByRole("checkbox", { name: "Use NPC target" }).check();
  await target.getByRole("checkbox", { name: "Dragon (Dragon Slayer perk)" }).check();
  await target.getByRole("checkbox", { name: /On Slayer task/ }).check();
  await closeLoadoutEditor(page);

  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  const paletteButtons = page.locator(".rotation-settings button:has(img):not([disabled])");
  await expect(paletteButtons.first()).toBeVisible();
  const paletteCount = await paletteButtons.count();
  for (const index of [0, 1, 2]) {
    await paletteButtons.nth(index % paletteCount).click();
  }
  await page.getByRole("button", { name: "revolution", exact: true }).click();
  const duration = page.getByTestId("revo-run-duration");
  await duration.fill("6");
  await page.getByTestId("revo-run-button").click();
  await expect(page.locator(".revo-status-rail")).toContainText("Complete", { timeout: 60000 });
  await expect(page.locator(".revo-damage")).toBeVisible();
}

async function expectHealthy(page: Page, failures: string[]) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(
    await page
      .locator("img")
      .evaluateAll((images) =>
        images
          .filter(
            (image): image is HTMLImageElement =>
              image instanceof HTMLImageElement && image.complete && image.naturalWidth === 0,
          )
          .map((image) => image.getAttribute("src")),
      ),
  ).toEqual([]);
  expect(failures).toEqual([]);
}

for (const viewport of [
  { name: "wide", width: 1536, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "phone", width: 390, height: 844 },
]) {
  test(`Combat V7 has no horizontal overflow or broken images at ${viewport.name}`, async ({
    page,
  }) => {
    const failures = installFailureCapture(page);
    await page.setViewportSize(viewport);
    await openCombat(page);

    await expect(page.locator(".setup-layout")).toBeVisible();
    await expect(page.locator("#combat-inputs")).toHaveCount(0);
    await expect(page.getByText("No saved abilities yet.", { exact: true })).toHaveCount(0);
    await expect(page.getByText("No NPC target.", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Resolved breakdown", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Levels", exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Passives & Set Effects", exact: true }),
    ).toBeVisible();
    const summary = page.getByRole("region", { name: "Combat Results" });
    await expect(summary.getByRole("heading", { name: "Combat Results" })).toBeVisible();
    await expect(summary.getByRole("group", { name: "Total Armour Value" })).toBeVisible();
    await expect(summary.getByRole("group", { name: "Prayer Bonus" })).toBeVisible();
    await expect(summary.getByText("100% assumption", { exact: true })).toHaveCount(0);
    await expect(summary.getByText(/Block level/i)).toHaveCount(0);
    await expect(page.locator(".setup-workbench-column > .setup-rotation-card")).toBeVisible();
    await expect(page.locator(".compact-rotation-list li").first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(
      await page
        .locator("img")
        .evaluateAll((images) =>
          images
            .filter(
              (image): image is HTMLImageElement =>
                image instanceof HTMLImageElement && image.complete && image.naturalWidth === 0,
            )
            .map((image) => image.getAttribute("src")),
        ),
    ).toEqual([]);
    await page.screenshot({
      path: `.shots/combat-v7-final-${viewport.width}x${viewport.height}.png`,
      fullPage: true,
    });
    expect(failures).toEqual([]);
  });
}

test("saved setup header supports defaults, scrollable overflow, and CRUD", async ({ page }) => {
  const failures = installFailureCapture(page);
  await page.setViewportSize({ width: 1536, height: 1024 });
  await openCombat(page);

  const manage = page.getByRole("toolbar", { name: "Manage saved setups" });
  const deleteButton = manage.getByRole("button", { name: "Delete", exact: true });
  const header = page.locator(".combat-screen > .combat-header");
  await expect(header).toHaveCount(1);
  await expect(header.locator(".combat-toolbar")).toHaveCount(1);
  await expect(header.locator(".saved-setup-ribbon")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Melee", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(manage.locator(".saved-setup-ribbon__label strong")).toHaveText("4");
  await expect(deleteButton).not.toHaveAttribute("aria-disabled", "true");
  for (const name of ["Melee", "Ranged", "Magic", "Necromancy"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);

  for (let index = 0; index < 4; index += 1) {
    await manage.getByRole("button", { name: "New setup", exact: true }).click();
  }
  await expect(manage.locator(".saved-setup-ribbon__label strong")).toHaveText("8");
  const rail = manage.locator(".saved-setup-ribbon__tabs");
  expect(await rail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  const actionsFit = await manage.locator(".saved-setup-ribbon__actions").evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.right <= window.innerWidth;
  });
  expect(actionsFit).toBe(true);
  await page.screenshot({
    path: ".shots/combat-v7-header-overflow-1536x1024.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Setup 8", exact: true }).click();

  await manage.getByRole("button", { name: "Rename", exact: true }).click();
  const rename = page.getByRole("dialog", { name: "Rename setup" });
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expectCenteredDialog(page, rename);
  await rename.getByRole("textbox", { name: "Name" }).fill("Raksha melee");
  await rename.getByRole("button", { name: "Save name" }).click();
  await expect(page.getByRole("button", { name: "Raksha melee", exact: true })).toBeVisible();

  await manage.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Raksha melee copy", exact: true })).toBeVisible();
  await manage.getByRole("button", { name: "Delete", exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "Delete setup" });
  await expectCenteredDialog(page, deletion);
  await deletion.getByRole("button", { name: "Delete setup" }).click();
  await expect(page.getByRole("button", { name: "Raksha melee copy", exact: true })).toHaveCount(0);
  expect(failures).toEqual([]);
});

test("templates export and import stay inside one native dialog and report malformed JSON", async ({
  page,
}) => {
  const failures = installFailureCapture(page);
  await openCombat(page);
  const strength = page.getByRole("spinbutton", { name: "Strength" });
  await strength.fill("80");
  await strength.press("Tab");
  await expect(strength).toHaveValue("80");

  await page.getByRole("button", { name: "Presets / Templates" }).click();
  const dialog = page.getByRole("dialog", { name: "Presets and templates" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expectCenteredDialog(page, dialog);
  await expect(dialog.getByLabel("Saved setup export JSON")).toContainText('"activeSetupId"');
  await dialog.getByRole("button", { name: "Reset presets" }).click();
  await expect(dialog.getByText("Four built-in presets restored.")).toBeVisible();
  await expect(strength).toHaveValue("120");
  await page.screenshot({ path: ".shots/combat-v7-presets-dialog-1536x1024.png" });

  const input = dialog.getByLabel("Setup JSON to import");
  await input.fill("{broken");
  await dialog.getByRole("button", { name: "Import JSON" }).click();
  await expect(
    dialog.getByText("That JSON is malformed. Check the pasted text and try again."),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Use template" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Default loadout", exact: true })).toBeVisible();
  expect(failures).toEqual([]);
});

for (const viewport of [
  { width: 1536, height: 1024 },
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`occupied Combat V7 tabs remain dense and usable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    const failures = installFailureCapture(page);
    await page.setViewportSize(viewport);
    await openCombat(page);
    await occupyLoadout(page);

    for (const tab of ["Rotation", "Loadout", "Analysis"] as const) {
      await page.getByRole("tab", { name: tab, exact: true }).click();
      await expectHealthy(page, failures);
      await page.screenshot({
        path: `.shots/combat-v7-${tab.toLowerCase()}-occupied-${viewport.width}x${viewport.height}.png`,
        fullPage: true,
      });
    }
  });
}

test("contextual owners open one loadout editor for equipment, effects, perks, relics, and target", async ({
  page,
}) => {
  const failures = installFailureCapture(page);
  await openCombat(page);

  await page.getByRole("button", { name: /^Helmet:/ }).click();
  const equipmentDialog = page.getByRole("dialog", { name: "Change equipment" });
  await expect(equipmentDialog).toBeVisible();
  await expectCenteredDialog(page, equipmentDialog);
  await expect(equipmentDialog.getByText("Loadout", { exact: true })).toBeVisible();
  await page.screenshot({ path: ".shots/combat-v7-equipment-dialog-1536x1024.png" });
  await closeLoadoutEditor(page);

  await page.getByRole("button", { name: "Show all active effects", exact: true }).click();
  const effectsDialog = page.getByRole("dialog", { name: "Active effects" });
  await expect(effectsDialog).toBeVisible();
  await expectCenteredDialog(page, effectsDialog);
  await expect(effectsDialog.getByRole("group", { name: "Combat values" })).toBeVisible();
  await expect(effectsDialog.getByRole("spinbutton", { name: "Current Hitpoints" })).toBeVisible();
  await expect(effectsDialog.getByRole("checkbox", { name: "Hit cap" })).toBeVisible();
  await page.screenshot({ path: ".shots/combat-v7-active-effects-dialog-1536x1024.png" });
  await closeLoadoutEditor(page);

  const cases = [
    [/^(Set|Change) Weapon 1/, "Change perks", "Invention"],
    ["Click here to update relic", "Archaeology", "Arch"],
    ["Edit target", "Edit target", "Target"],
  ] as const;

  for (const [action, title, content] of cases) {
    await page
      .getByRole("button", { name: action, exact: typeof action === "string" })
      .first()
      .click();
    const dialog = page.getByRole("dialog", { name: title });
    await expect(dialog).toBeVisible();
    await expectCenteredDialog(page, dialog);
    await expect(page.locator("dialog[open]")).toHaveCount(1);
    await expect(dialog.getByText(content, { exact: true })).toBeVisible();
    await closeLoadoutEditor(page);
  }

  const breakdown = page.getByRole("region", { name: "Combat results" });
  const baseDamage = breakdown.getByRole("group", { name: "Base ability damage" });
  await baseDamage.locator("summary").click();
  await expect(baseDamage).toHaveAttribute("open", "");
  expect(failures).toEqual([]);
});

test("prayer state, native weapon special, and resolved engine values remain wired", async ({
  page,
}) => {
  const failures = installFailureCapture(page);
  await openCombat(page);

  const summary = page.getByRole("region", { name: "Combat results" });
  await expect(summary.getByText("Accuracy", { exact: true })).toBeVisible();
  await expect(summary.getByRole("group", { name: "Damage Potential" })).toBeVisible();
  expect(
    Number(
      (
        await summary
          .getByRole("group", { name: "Base ability damage" })
          .locator(".summary-metric__result strong")
          .innerText()
      ).replaceAll(",", ""),
    ),
  ).toBeGreaterThan(0);

  await page.getByRole("button", { name: /^Helmet:/ }).click();
  const equipment = page.getByRole("dialog", { name: "Change equipment" });
  const turmoil = equipment.getByTestId("prayer-picker").getByRole("button", { name: /Turmoil/ });
  await turmoil.click();
  await expect(turmoil).toHaveAttribute("aria-pressed", "true");
  await closeLoadoutEditor(page);

  await page.getByRole("button", { name: "Show all active effects", exact: true }).click();
  const effects = page.getByRole("dialog", { name: "Active effects" });
  await expect(effects.getByTestId("prayer-picker")).toHaveCount(0);
  await closeLoadoutEditor(page);

  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  const special = page.getByRole("button", { name: /^Weapon special (on|off)$/ });
  await expect(special).toHaveAttribute("aria-pressed", "false");
  await special.click();
  await expect(special).toHaveAttribute("aria-pressed", "true");
  await expect(special).toHaveAttribute("aria-label", "Weapon special on");
  await page.reload();
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Weapon special (on|off)$/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(failures).toEqual([]);
});

test("manual rotation queue persists into the compact loadout rotation", async ({ page }) => {
  await openCombat(page);
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await page
    .getByRole("button", { name: /^Attack/ })
    .first()
    .click();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await expect(page.locator(".compact-rotation-list li")).toHaveCount(1);
  await expect(page.locator(".compact-rotation-list li").first()).toHaveAttribute(
    "aria-label",
    "1. Attack",
  );
  await page.reload();
  await expect(page.locator(".compact-rotation-list li")).toHaveCount(1);
});

test("Revolution keeps the active bar and run results across reload", async ({ page }) => {
  await openCombat(page);
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  const editor = page.getByTestId("revo-bar-editor");
  const bar = page.getByRole("group", { name: "Revolution bar" });
  const initialCount = await bar.getByRole("button").count();
  expect(initialCount).toBeGreaterThan(1);

  await bar.getByRole("button").nth(1).click();
  const slotTwo = editor.getByRole("combobox", { name: "Ability in slot 2" });
  const movedAbility = await slotTwo.inputValue();
  await editor.getByRole("button", { name: "Move selected ability left" }).click();
  await expect(editor.getByRole("combobox", { name: "Ability in slot 1" })).toHaveValue(
    movedAbility,
  );

  await editor.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(bar.getByRole("button")).toHaveCount(initialCount - 1);
  await editor.getByRole("button", { name: "Add slot", exact: true }).click();
  await expect(bar.getByRole("button")).toHaveCount(initialCount);
  const editedNames = await bar
    .getByRole("button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("title")));

  const duration = page.getByTestId("revo-run-duration");
  await duration.fill("6");
  await page.getByTestId("revo-run-button").click();
  await expect(page.locator(".revo-status-rail")).toContainText("Complete", { timeout: 60000 });
  const activeIcons = page.getByTestId("revo-active-bar").locator(".revo-bar-library__icon");
  const activeCount = await activeIcons.count();
  expect(activeCount).toBeGreaterThan(0);

  await page.reload();
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await expect(page.locator(".revo-status-rail")).toContainText("Complete");
  await expect(page.getByRole("group", { name: "Revolution bar" }).getByRole("button")).toHaveCount(
    initialCount,
  );
  expect(
    await page
      .getByRole("group", { name: "Revolution bar" })
      .getByRole("button")
      .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("title"))),
  ).toEqual(editedNames);
  await expect(page.getByTestId("revo-active-bar").locator(".revo-bar-library__icon")).toHaveCount(
    activeCount,
  );

  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await expect(page.locator(".compact-rotation-list li")).toHaveCount(activeCount);
});

test("a shield Revolution bar loads the new Defence ability icons", async ({ page }) => {
  await openCombat(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "eq:loadout:v1",
      JSON.stringify({
        style: "melee",
        equipmentSlots: {
          mainhand: "item:drygore-mace",
          offhand: "item:malevolent-kiteshield",
        },
        target: {
          defenceLevel: 80,
          affinity: 70,
          incomingHitIntervalSeconds: 2.4,
        },
      }),
    );
  });
  await page.reload();
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();

  const slot = page
    .getByTestId("revo-bar-editor")
    .getByRole("combobox", { name: "Ability in slot 1" });
  for (const [id, name] of [
    ["bash", "Bash"],
    ["preparation", "Preparation"],
    ["revenge", "Revenge"],
    ["debilitate", "Debilitate"],
  ] as const) {
    await slot.selectOption(id);
    await expect(slot).toHaveValue(id);
    await expect(slot.locator(`option[value="${id}"]`)).toHaveText(name);
    const icon = page
      .getByRole("group", { name: "Revolution bar" })
      .getByRole("button", { name: new RegExp(name) })
      .locator("img");
    await expect(icon).toHaveAttribute("src", new RegExp(`/abilities/defence/${id}\\.webp$`));
    expect(await icon.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  }
});

test("Revenge raises damage through the editable shield bar", async ({ page }) => {
  await openCombat(page);
  await page.evaluate(() => {
    localStorage.setItem(
      "eq:build:v1",
      JSON.stringify({
        elective: [],
        relics: {},
        blessingPicks: ["Order", "Order", "Order"],
        blessingSelections: [],
        blessingResetsUsed: 0,
      }),
    );
    localStorage.setItem(
      "eq:loadout:v1",
      JSON.stringify({
        style: "melee",
        startingAdrenaline: 100,
        equipmentSlots: {
          mainhand: "item:drygore-mace",
          offhand: "item:malevolent-kiteshield",
        },
        target: {
          defenceLevel: 80,
          affinity: 70,
          incomingHitIntervalSeconds: 2.4,
        },
      }),
    );
    localStorage.setItem(
      "eq:rotation-workspace:v1",
      JSON.stringify({
        version: 1,
        mode: "revolution",
        activeBars: { "melee|shield": ["revenge", "attack"] },
        runDurationSeconds: 24,
        limitToRegions: false,
      }),
    );
  });
  await page.reload();
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByTestId("revo-run-button").click();
  await expect(page.getByTestId("revo-damage")).toBeVisible({ timeout: 120_000 });
  const withRevenge = Number((await page.getByTestId("revo-damage").innerText()).replace(/,/g, ""));
  await page.getByRole("button", { name: "Analyze damage" }).click();
  const analysis = page.getByRole("dialog", { name: "Damage analysis" });
  await expect(analysis.getByText("Revenge peak", { exact: true })).toBeVisible();
  await expect(analysis.locator(".rotation-analysis-metrics").getByText("10 stacks")).toBeVisible();
  await expect(
    analysis.locator(".rotation-analysis-metrics").getByText("+50% damage"),
  ).toBeVisible();
  await expect(analysis.getByText(/Revenge · \d+ stacks · \+\d+% damage/).first()).toBeVisible();
  await analysis.getByRole("button", { name: "Close damage analysis" }).click();

  await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem("eq:rotation-workspace:v1") ?? "{}");
    workspace.activeBars = { "melee|shield": ["attack"] };
    localStorage.setItem("eq:rotation-workspace:v1", JSON.stringify(workspace));
  });
  await page.reload();
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByTestId("revo-run-button").click();
  await expect(page.getByTestId("revo-damage")).toBeVisible({ timeout: 120_000 });
  const withoutRevenge = Number(
    (await page.getByTestId("revo-damage").innerText()).replace(/,/g, ""),
  );

  expect(withRevenge).toBeGreaterThan(withoutRevenge);
});

test("inline loadout edits persist and refresh engine-backed summary values", async ({ page }) => {
  await openCombat(page);
  const summary = page.getByRole("region", { name: "Combat results" });
  const baseDamage = summary
    .getByRole("group", { name: "Base ability damage" })
    .locator(".summary-metric__result strong");
  const before = await baseDamage.innerText();
  const strength = page.getByRole("spinbutton", { name: "Strength" });
  await strength.fill("80");
  await strength.press("Tab");
  await expect(baseDamage).not.toHaveText(before);
  await page.reload();
  await expect(page.getByRole("spinbutton", { name: "Strength" })).toHaveValue("80");
});

test("focus treatment and reduced motion are explicit", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openCombat(page);

  const create = page.getByRole("button", { name: "New setup", exact: true });
  await create.focus();
  expect(await create.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    "none",
  );
  const transitionSeconds = Number.parseFloat(
    await create.evaluate((element) => getComputedStyle(element).transitionDuration),
  );
  expect(transitionSeconds).toBeGreaterThanOrEqual(0);
  expect(transitionSeconds).toBeLessThanOrEqual(0.001);
});
