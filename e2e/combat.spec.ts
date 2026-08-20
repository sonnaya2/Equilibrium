import { expect, test, type Locator, type Page } from "@playwright/test";

const summary = (page: Page) => page.getByRole("region", { name: "Combat results" });

const summaryMetric = (page: Page, name: string) =>
  summary(page).getByRole("group", { name, exact: true });

async function expectBreakdownToReconcile(metric: Locator) {
  const breakdown = metric.locator("[data-breakdown-total]");
  const total = Number(await breakdown.getAttribute("data-breakdown-total"));
  const values = await breakdown
    .locator("[data-breakdown-value]")
    .evaluateAll((rows) => rows.map((row) => Number(row.getAttribute("data-breakdown-value"))));
  expect(values.reduce((sum, value) => sum + value, 0)).toBeCloseTo(total, 10);
}

async function closeLoadoutEditor(page: Page) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Close loadout editor" }).click();
  await expect(dialog).toBeHidden();
}

async function openEquipmentEditor(page: Page) {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: /^Helmet:/ }).click();
  await expect(page.getByRole("dialog", { name: "Change equipment" })).toBeVisible();
}

async function openEffectsEditor(page: Page) {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Show all active effects", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Active effects" })).toBeVisible();
}

async function openPerksEditor(page: Page) {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page
    .getByRole("button", { name: /^(Set|Change) Weapon 1/ })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Change perks" })).toBeVisible();
}

async function openRelicsEditor(page: Page) {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page
    .getByRole("button", { name: "Click here to update relic", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog", { name: "Archaeology" })).toBeVisible();
}

async function openTargetEditor(page: Page) {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Edit target", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit target" })).toBeVisible();
}

/** Loadout default is 100% start adren (ultimate-friendly). Some rotation cases need 0. */
async function setStartingAdrenaline(page: Page, value: number) {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  // Combat assumptions on Equipment column; NumberField suffix "%" joins the accessible name.
  const field = page.getByRole("spinbutton", { name: /Starting adrenaline/i });
  await field.fill(String(value));
  await expect(field).toHaveValue(String(value));
}

test.beforeEach(async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("analysis ability library runs the real pipeline", async ({ page }) => {
  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  await expect(page.getByText("Ability library")).toBeVisible();
  await expect(page.getByText("A · Loadout")).toBeVisible();

  await page.getByLabel("Ability filter").fill("Rend");
  await page.getByRole("button", { name: /Rend/ }).click();
  await expect(page.getByRole("heading", { name: "Rend" })).toBeVisible();
  await expect(page.getByText("Expected primary")).toBeVisible();
  await expect(page.getByText("Damage Potential").first()).toBeVisible();
});

test("rotation planner queues, simulates, and persists", async ({ page }) => {
  // From 0: two basic Attacks bank 9% each → ending adren 18%.
  await setStartingAdrenaline(page, 0);
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();

  const attack = page.getByRole("button", { name: /^Attack.*\+9%$/ });
  await attack.click();
  await attack.click();
  await expect(page.getByText("Queue · 2 casts")).toBeVisible();

  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("DPS", { exact: true })).toBeVisible();
  await expect(page.getByText("6 ticks · 3.6s").first()).toBeVisible();
  await expect(page.getByText("18%")).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await expect(page.getByText("Queue · 2 casts")).toBeVisible();
});

test("rotation reports adrenaline starvation honestly in manual mode", async ({ page }) => {
  // Default start is 100%; force 0 so Overpower is unaffordable without weave.
  await setStartingAdrenaline(page, 0);
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await page.getByRole("checkbox", { name: "Automatically use Basic Attacks" }).uncheck();
  await page.getByRole("button", { name: "Overpower ultimate 60%", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText(/Rotation fails: overpower needs 60% adrenaline/)).toBeVisible();
});

test("auto-weave fills basics to afford a queued ultimate", async ({ page }) => {
  await setStartingAdrenaline(page, 0);
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Automatically use Basic Attacks" }),
  ).toBeChecked();

  await page.getByRole("button", { name: "Overpower ultimate 60%", exact: true }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("DPS", { exact: true })).toBeVisible();
  await expect(page.getByText("25 ticks · 15.0s").first()).toBeVisible();
  await expect(page.getByText("auto").first()).toBeVisible();
});

test("setup gear filters equipment by region", async ({ page }) => {
  await openEquipmentEditor(page);
  const dialog = page.getByRole("dialog", { name: "Change equipment" });

  await dialog.getByRole("checkbox", { name: "Match style" }).uncheck();
  await dialog.getByRole("combobox", { name: "Region" }).selectOption("misthalin");
  await expect(dialog.getByRole("button", { name: /Omni guard/ })).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Seismic wand/ })).toBeHidden();
  await closeLoadoutEditor(page);
});

test("the main-hand picker accepts two-handed weapons and locks off-hand", async ({ page }) => {
  await openEquipmentEditor(page);
  const dialog = page.getByRole("dialog", { name: "Change equipment" });
  const weapons = dialog.getByRole("group", { name: "Weapon and body slots" });

  await expect(weapons.getByRole("button", { name: /^Two-hand/ })).toHaveCount(0);
  await weapons.getByRole("button", { name: /^Main-hand/ }).click();
  await dialog.getByRole("button", { name: /Masterwork 2h sword/ }).click();

  await expect(
    weapons.getByRole("button", { name: /^Main-hand.*Masterwork 2h sword/ }),
  ).toBeVisible();
  await expect(weapons.getByRole("button", { name: /^Off-hand/ })).toBeDisabled();
  await expect(weapons.getByText("Locked")).toBeVisible();
  await closeLoadoutEditor(page);

  await expect(
    page.getByRole("button", { name: /Main Hand:.*Masterwork 2h sword/ }),
  ).toBeVisible();
  // Equipment column shows locked off-hand; the picker disables the slot inside the dialog.
  await expect(
    page.getByRole("button", { name: /Off-hand: Locked, two-handed weapon/ }),
  ).toBeVisible();
});

test("analysis tab compares two stat lines", async ({ page }) => {
  const duplicateKeyWarnings: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /same key, `(sacrifice|tuskas_wrath)`/.test(message.text())) {
      duplicateKeyWarnings.push(message.text());
    }
  });

  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  await expect(page.getByText("A · Loadout")).toBeVisible();
  await expect(page.getByText("B · Comparison")).toBeVisible();
  await expect(page.getByText("B − A")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Damage Potential" })).toBeVisible();

  const sacrificeRows = page.locator(".analysis-ability").filter({ hasText: "Sacrifice" });
  const tuskaRows = page.locator(".analysis-ability").filter({ hasText: "Tuska's Wrath" });
  await expect(sacrificeRows).toHaveCount(3);
  await expect(tuskaRows).toHaveCount(3);

  await sacrificeRows.nth(1).click();
  await expect(sacrificeRows.nth(1)).toHaveAttribute("aria-pressed", "true");
  await expect(sacrificeRows.nth(2)).toHaveAttribute("aria-pressed", "false");
  expect(duplicateKeyWarnings).toEqual([]);
});

test("analysis ability library offers necromancy's sourced volley", async ({ page }) => {
  await page.getByRole("tab", { name: "Analysis", exact: true }).click();
  await page.getByLabel("Ability filter").fill("Volley of Souls");
  await page.getByRole("button", { name: /Volley of Souls/ }).click();
  await expect(page.getByRole("heading", { name: "Volley of Souls" })).toBeVisible();
  await expect(page.getByText("Residual Souls")).toBeVisible();
  await expect(page.getByText("Damage Potential", { exact: true }).first()).toBeVisible();
});

test("rotation defaults to the shared setup loadout", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  const toggle = page.getByRole("checkbox", { name: "Use Loadout" });
  await expect(toggle).toBeChecked();

  await page.getByRole("button", { name: /^Attack.*\+9%$/ }).click();
  await page.getByRole("button", { name: /^Attack.*\+9%$/ }).click();
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(page.getByText("DPS", { exact: true })).toBeVisible();
  await expect(page.getByText("6 ticks · 3.6s").first()).toBeVisible();
});

test("combat navigation exposes tabs and workbench editors", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem("eq:build:v1", JSON.stringify({ elective: ["morytania"] }));
  });
  await page.reload();

  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs).toHaveText(["Loadout", "Rotation", "Analysis"]);
  await expect(page.getByRole("tab", { name: "Reference" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Loadout sections" })).toHaveCount(0);

  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Equipment" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Main Hand:/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active Effects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Invention" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Archaeology" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Target & Scenario" })).toBeVisible();

  await openEquipmentEditor(page);
  const equipment = page.getByRole("dialog", { name: "Change equipment" });
  const doll = equipment.getByRole("group", { name: "Equipment slots" });
  await expect(doll.getByText("Main-hand")).toBeVisible();
  await expect(doll.getByText("Empty").first()).toBeVisible();
  await closeLoadoutEditor(page);

  await openRelicsEditor(page);
  const relics = page.getByRole("dialog", { name: "Archaeology" });
  await expect(relics.getByRole("heading", { name: "Arch", exact: true })).toBeVisible();
  await expect(relics.getByText("Berserker's Fury", { exact: true }).first()).toBeVisible();
  await relics
    .getByRole("button", { name: /Berserker's Fury/i })
    .first()
    .click();
  await expect(relics.getByRole("spinbutton", { name: "Current Hitpoints" })).toBeVisible();
  await expect(relics.getByText("Damage bonus")).toBeVisible();
  await closeLoadoutEditor(page);

  await openPerksEditor(page);
  const perks = page.getByRole("dialog", { name: "Change perks" });
  await expect(perks.getByText("Invention")).toBeVisible();
  const gizmos = perks.getByRole("group", { name: "Gizmos" });
  await expect(gizmos.getByRole("button", { name: /^Weapon 1\b/ })).toBeVisible();
  await expect(gizmos.getByRole("button", { name: /^Weapon 2\b/ })).toBeVisible();
  await expect(gizmos.getByRole("button", { name: /^Armour 1\b/ })).toBeVisible();
  await expect(gizmos.getByRole("button", { name: /^Armour 2\b/ })).toBeVisible();
  await expect(gizmos.getByText("Body", { exact: true })).toBeVisible();
  await expect(gizmos.getByText("Legs", { exact: true })).toBeVisible();
  const aftershock = perks.getByRole("button", { name: /Aftershock.*Weapon/ });
  await gizmos.getByRole("button", { name: /^Armour 1\b/ }).click();
  await expect(aftershock).toHaveAttribute("aria-disabled", "true");
  await gizmos.getByRole("button", { name: /^Weapon 1\b/ }).click();
  await aftershock.click();
  await expect(perks.getByRole("status", { name: "Aftershock rank" })).toHaveText("R1");
  await perks.getByRole("button", { name: "Increase Aftershock rank" }).click();
  await expect(perks.getByRole("status", { name: "Aftershock rank" })).toHaveText("R2");
  await closeLoadoutEditor(page);

  await openEffectsEditor(page);
  const effects = page.getByRole("dialog", { name: "Active effects" });
  await expect(effects.getByRole("checkbox", { name: /Vulnerability/ })).toBeVisible();
  const agony = effects.getByRole("button", { name: /Agony/ });
  await expect(agony).toHaveAttribute("aria-pressed", "true");
  await agony.click();
  await expect(agony).toHaveAttribute("aria-pressed", "false");

  const elder = effects.getByRole("button", { name: /Elder overload/ });
  await expect(elder).toHaveAttribute("aria-pressed", "false");
  await elder.click();
  await expect(elder).toHaveAttribute("aria-pressed", "true");
  await closeLoadoutEditor(page);

  // Overload boosts Defence: elder is floor(99 × 0.17) + 5 = 21 over 99 → 120.
  const defence = summaryMetric(page, "Defence");
  await expect(defence.getByText("120")).toBeVisible();
  await defence.locator("summary").click();
  await expect(defence.getByText("99", { exact: true })).toBeVisible();

  await openEquipmentEditor(page);
  await expect(page.getByText("Equip set pieces to activate their effects.")).toBeVisible();
  await closeLoadoutEditor(page);

  await openTargetEditor(page);
  const target = page.getByRole("dialog", { name: "Edit target" });
  await target.getByRole("checkbox", { name: "Use NPC target" }).check();
  await expect(target.getByRole("combobox", { name: "Affinity" })).toBeVisible();
  await closeLoadoutEditor(page);
});

test("setup summary exposes the complete core-derived stat line", async ({ page }) => {
  for (const label of [
    "Base Ability Damage",
    "Equipment Damage",
    "Accuracy",
    "Damage Potential",
    "Crit Chance",
    "Crit Damage",
    "Defence",
    "Total Armour Value",
    "Equipment Armour",
    "Maximum Hitpoints",
    "Current Hitpoints",
    "Prayer Bonus",
    "Starting Adrenaline",
    "Maximum Adrenaline",
  ]) {
    await expect(summaryMetric(page, label)).toBeVisible();
  }
  // Hit cap lives on Active effects / Rotation, not the loadout summary.
  await expect(summaryMetric(page, "Hit cap")).toHaveCount(0);
});

test("poison buffs expose every potion tier and persist Herblore", async ({ page }) => {
  await openEffectsEditor(page);
  const effects = page.getByRole("dialog", { name: "Active effects" });
  const potion = effects.getByRole("combobox", { name: "Weapon poison potion" });
  await expect(potion.locator("option")).toHaveText([
    "None",
    "Weapon poison",
    "Weapon poison+",
    "Weapon poison++",
    "Weapon poison+++",
  ]);
  await potion.selectOption("weapon-plus-plus-plus");
  await effects.getByRole("spinbutton", { name: "Herblore level" }).fill("120");
  await closeLoadoutEditor(page);

  await page.reload();
  await openEffectsEditor(page);
  const reopened = page.getByRole("dialog", { name: "Active effects" });
  await expect(reopened.getByRole("combobox", { name: "Weapon poison potion" })).toHaveValue(
    "weapon-plus-plus-plus",
  );
  await expect(reopened.getByRole("spinbutton", { name: "Herblore level" })).toHaveValue("120");
  await closeLoadoutEditor(page);
});

test("Cinderbanes add recursive poison hits to a rendered 60-second bar", async ({
  page,
}, testInfo) => {
  const runAndReadPoison = async () => {
    await page.getByRole("tab", { name: "Rotation", exact: true }).click();
    await page.getByRole("button", { name: "Run bar" }).click();
    await expect(page.getByRole("heading", { name: "Resolved events" })).toBeVisible();
    await page.getByRole("button", { name: "Analyze damage" }).click();
    const dialog = page.getByRole("dialog", { name: "Damage analysis" });
    const poison = dialog.getByTestId("player-poison-analysis");
    await expect(poison).toBeVisible();
    const separateHits = Number(
      await poison
        .getByText("Expected poison hits", { exact: true })
        .locator("..")
        .locator("dd")
        .innerText(),
    );
    const totalDamage = Number(
      (
        await dialog
          .getByText("Expected damage", { exact: true })
          .locator("..")
          .locator("dd")
          .innerText()
      ).replaceAll(",", ""),
    );
    return { dialog, poison, separateHits, totalDamage };
  };

  await openEffectsEditor(page);
  await page
    .getByRole("dialog", { name: "Active effects" })
    .getByRole("combobox", { name: "Weapon poison potion" })
    .selectOption("weapon-plus-plus-plus");
  await closeLoadoutEditor(page);

  const without = await runAndReadPoison();
  await expect(without.poison.getByText(/tier 4/)).toBeVisible();
  await expect(without.poison.getByText(/Cinderbane chain:/)).toHaveCount(0);
  await without.dialog.getByRole("button", { name: "Close" }).click();

  await openEquipmentEditor(page);
  const gear = page.getByRole("dialog", { name: "Change equipment" });
  await gear.getByRole("button", { name: /^Gloves/ }).click();
  await gear.getByRole("searchbox", { name: "Search" }).fill("Cinderbane gloves");
  await gear.getByRole("button", { name: /Cinderbane gloves/ }).click();
  await closeLoadoutEditor(page);

  const withCinderbanes = await runAndReadPoison();
  await expect(withCinderbanes.poison.getByText(/tier 5/)).toBeVisible();
  const chain = withCinderbanes.poison.getByText(/Cinderbane chain: .*expected extra hits/);
  await expect(chain).toBeVisible();
  expect(Number((await chain.innerText()).match(/chain: ([\d.]+)/)?.[1] ?? 0)).toBeGreaterThan(0);
  expect(withCinderbanes.separateHits).toBeGreaterThan(without.separateHits);
  expect(withCinderbanes.totalDamage).toBeGreaterThan(without.totalDamage);
  const sourcePoisonHits = withCinderbanes.dialog.locator("[data-player-poison-hits]");
  await expect(sourcePoisonHits.first()).toBeVisible();
  expect(await sourcePoisonHits.count()).toBeGreaterThan(1);
  expect((await sourcePoisonHits.allInnerTexts()).every((text) => /\+\d/.test(text))).toBe(true);
  const poisonTimeline = withCinderbanes.dialog
    .getByRole("heading", { name: "Resolved timeline" })
    .locator("..");
  const poisonEventRows = poisonTimeline.getByRole("row").filter({ hasText: "Weapon poison" });
  const poisonEventText = await poisonEventRows.allInnerTexts();
  await testInfo.attach("cinderbane-timeline.txt", {
    body: poisonEventText.join("\n"),
    contentType: "text/plain",
  });
  await expect(
    withCinderbanes.dialog.getByText("Damage is EV. Log is the top sampled path."),
  ).toBeVisible();
  expect(poisonEventText.length).toBeGreaterThan(0);
  expect(poisonEventText.some((row) => /\b0 expected occurrences?/.test(row))).toBe(false);
  await withCinderbanes.dialog.screenshot({ path: testInfo.outputPath("cinderbane-analysis.png") });
  await poisonTimeline.screenshot({ path: testInfo.outputPath("cinderbane-timeline.png") });
});

test("summary breakdowns reconcile and open from the keyboard", async ({ page }) => {
  const crit = summaryMetric(page, "Crit Chance");
  const toggle = crit.locator("summary");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(crit).toHaveAttribute("open", "");
  await expectBreakdownToReconcile(crit);

  const life = summaryMetric(page, "Maximum Hitpoints");
  await life.locator("summary").focus();
  await page.keyboard.press("Space");
  await expect(life).toHaveAttribute("open", "");
  await expectBreakdownToReconcile(life);

  const base = summaryMetric(page, "Base Ability Damage");
  await base.locator("summary").click();
  await expectBreakdownToReconcile(base);
});

test("summary reacts to temporary life effects and a manual Damage Potential override", async ({
  page,
}) => {
  // Boon of Het is automatic with Desert unlocked (disabled tile in Active effects).
  await page.evaluate(() => {
    localStorage.setItem("eq:build:v1", JSON.stringify({ elective: ["desert"] }));
  });
  await page.reload();

  await openEffectsEditor(page);
  const effects = page.getByRole("dialog", { name: "Active effects" });
  await effects.getByRole("button", { name: /Reaper Crew/ }).click();
  await effects.getByRole("button", { name: /Font of Life/ }).click();
  await expect(effects.getByRole("button", { name: /Boon of Het/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await closeLoadoutEditor(page);

  // Persistent buffs raise Maximum Hitpoints; temporary ones update the same row.
  const maximumHp = summaryMetric(page, "Maximum Hitpoints");
  await expect(maximumHp.getByText("11,095")).toBeVisible();

  await openEffectsEditor(page);
  await page
    .getByRole("dialog", { name: "Active effects" })
    .getByRole("button", { name: /Thermal bath/ })
    .click();
  await closeLoadoutEditor(page);
  await expect(maximumHp.getByText("11,392")).toBeVisible();
  await expect(maximumHp).toContainText("Includes temporary effects");
  await maximumHp.locator("summary").click();
  await expectBreakdownToReconcile(maximumHp);

  await openTargetEditor(page);
  const target = page.getByRole("dialog", { name: "Edit target" });
  await target.getByRole("checkbox", { name: "Use NPC target" }).check();
  await target.getByRole("checkbox", { name: "Manual Damage Potential" }).check();
  await target.getByRole("spinbutton", { name: /Damage Potential/ }).fill("73");
  await closeLoadoutEditor(page);
  await expect(
    summaryMetric(page, "Damage Potential").getByText("73%", { exact: true }),
  ).toBeVisible();
});

test("setup workbench editors stay within a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".combat-setup")).toBeVisible();
  await expect
    .poll(async () => (await page.locator(".combat-setup").boundingBox())?.height ?? 0)
    .toBeGreaterThan(200);

  const openers: Array<{ open: () => Promise<void>; dialog: string }> = [
    { open: () => openEquipmentEditor(page), dialog: "Change equipment" },
    { open: () => openEffectsEditor(page), dialog: "Active effects" },
    { open: () => openPerksEditor(page), dialog: "Change perks" },
    { open: () => openRelicsEditor(page), dialog: "Archaeology" },
    { open: () => openTargetEditor(page), dialog: "Edit target" },
  ];

  for (const { open, dialog } of openers) {
    await open();
    await expect(page.getByRole("dialog", { name: dialog })).toBeVisible();
    await expect(summary(page)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
      `${dialog} should not overflow horizontally`,
    ).toBe(true);
    await closeLoadoutEditor(page);
  }
});

test("revolution is the default mode with the wiki bar graphic", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();

  await expect(page.getByRole("button", { name: "Optimize bar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run bar" })).toBeVisible();
  await expect(page.getByTestId("revo-empty")).toBeVisible();
  await expect(page.getByTestId("revo-horizon-plan")).toHaveText(/100 ticks/);

  await expect(page.getByTestId("revo-reference-bar")).toContainText(/\d+ of \d+ modelled/);
  await expect(page.getByText("Meteor Strike")).toBeVisible();
  await expect(page.getByText("Chaos Roar")).toBeVisible();

  await page.getByRole("button", { name: "Run bar" }).click();
  await expect(page.getByText("DPS", { exact: true })).toBeVisible();
  await expect(page.getByTestId("revo-horizon")).toHaveText(/^100$/);
  await expect(page.getByTestId("revo-casts")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  const basics = page.locator("[data-basic='true']");
  const timeline = page.getByTestId("revo-cast-timeline");
  await expect(timeline).toBeVisible();
  await expect(basics.or(timeline.locator("tbody tr")).first()).toBeVisible();
});

test("revolution solver optimizes and apply keeps a runnable bar", async ({ page }) => {
  test.setTimeout(180_000);
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Optimize bar" })).toBeVisible();

  await page.getByRole("button", { name: "Optimize bar" }).click();

  const progress = page.getByTestId("revo-solver-progress");
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute("aria-busy", "true");

  await expect(page.getByTestId("revo-solver-results")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("revo-solver-results")).toContainText(/Score/);
  await expect(progress).toHaveAttribute("aria-busy", "false");
  await expect(page.getByTestId("revo-optimize")).toHaveText("Optimize bar");

  await page.getByRole("button", { name: "Apply" }).first().click();
  await expect(page.getByText(/Active Revo\+\+/)).toBeVisible();
  await page.getByRole("button", { name: "Run bar" }).click();
  await expect(page.getByText("DPS", { exact: true })).toBeVisible();
  await expect(page.getByTestId("revo-casts")).toBeVisible();
});

test("solver progress advances at least twice before results", async ({ page }) => {
  test.setTimeout(180_000);
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();

  const optimize = page.getByTestId("revo-optimize");
  await optimize.click();

  const progress = page.getByTestId("revo-solver-progress");
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute("aria-busy", "true");
  await expect(optimize).toHaveText("Optimizing…");

  const seen: number[] = [];
  await expect
    .poll(
      async () => {
        const raw = await progress.getAttribute("data-evals");
        const n = raw != null ? Number(raw) : NaN;
        if (Number.isFinite(n) && (seen.length === 0 || n > seen[seen.length - 1]!)) {
          seen.push(n);
        }
        return seen.length;
      },
      { timeout: 120_000, intervals: [50, 100, 200, 400] },
    )
    .toBeGreaterThanOrEqual(3);

  await expect(page.getByTestId("revo-solver-results")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("revo-solver-results")).toContainText(/Score/);
  await expect(progress).toHaveAttribute("aria-busy", "false");
  await expect(optimize).toHaveText("Optimize bar");
});

test("manual rotation still exposes necromancy abilities", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await page.getByRole("checkbox", { name: "Use Loadout" }).uncheck();
  await page.getByRole("button", { name: "Necromancy", exact: true }).click();
  await expect(page.getByRole("button", { name: /Volley of Souls/ })).toBeVisible();
});

test("loadout base damage follows equipped weapon tier and persists into Revolution", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  const baseMetric = summaryMetric(page, "Base Ability Damage");
  const before = await baseMetric.locator("strong").innerText();

  await openEquipmentEditor(page);
  const gear = page.getByRole("dialog", { name: "Change equipment" });
  await gear.getByRole("group", { name: "Weapon and body slots" }).getByRole("button", { name: /^Main-hand/ }).click();
  await gear.getByRole("searchbox", { name: "Search" }).fill("Masterwork 2h sword");
  await gear.getByRole("button", { name: /Masterwork 2h sword/ }).click();
  await closeLoadoutEditor(page);

  await expect(baseMetric.locator("strong")).not.toHaveText(before);
  await setStartingAdrenaline(page, 62);

  // Hit cap defaults off; pin it so Revolution assumptions stay "Off" after reload.
  await openEffectsEditor(page);
  await page
    .getByRole("dialog", { name: "Active effects" })
    .getByRole("checkbox", { name: "Hit cap" })
    .uncheck();
  await closeLoadoutEditor(page);

  await page.reload();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await expect(page.getByRole("button", { name: /Main Hand:.*Masterwork 2h sword/ })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: /Starting adrenaline/i })).toHaveValue("62");

  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "Run bar" }).click();
  const assumptions = page.locator("details").filter({ hasText: "Assumptions" }).first();
  await assumptions.getByText("Assumptions", { exact: true }).click();
  await expect(assumptions.getByText("62%", { exact: true })).toBeVisible();
  await expect(assumptions.getByText("Off", { exact: true })).toBeVisible();
});

test("v1 loadout migration and Defence/life controls persist across reload", async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.setItem(
      "eq:loadout:v1",
      JSON.stringify({
        style: "melee",
        level: 91,
        attackLevel: 82,
        strengthLevel: 91,
        equipmentSlots: { mainhand: "item:drygore-mace" },
        equipmentIds: ["item:drygore-mace"],
        enchantments: ["agony"],
        perks: { biting: 4 },
        buffs: { vulnerability: true, styleCurse: "turmoil", overload: "elder" },
        target: { defenceLevel: 88, armour: 420, affinity: 50 },
        baseDamage: { mode: "manual", manualValue: 4321 },
        startingAdrenaline: 72,
        hitCapEnabled: false,
      }),
    );
  });
  await page.reload();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();

  await expect(page.getByRole("spinbutton", { name: /^Attack$/ })).toHaveValue("82");
  await expect(page.getByRole("spinbutton", { name: /^Strength$/ })).toHaveValue("91");
  await expect(page.getByRole("spinbutton", { name: /^Defence$/ })).toHaveValue("99");
  await expect(page.getByRole("spinbutton", { name: /^Constitution$/ })).toHaveValue("99");
  await expect(summaryMetric(page, "Base Ability Damage").locator("strong")).not.toHaveText(
    "4,321",
  );
  await expect(page.getByRole("spinbutton", { name: /Starting adrenaline/i })).toHaveValue("72");
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "30,000 hit cap" })).not.toBeChecked();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();

  await page.getByRole("spinbutton", { name: /^Defence$/ }).fill("73");
  await page.getByRole("spinbutton", { name: /^Constitution$/ }).fill("88");

  await openEffectsEditor(page);
  const effects = page.getByRole("dialog", { name: "Active effects" });
  await effects.getByRole("spinbutton", { name: "Current Hitpoints" }).fill("6000");

  const fortitude = effects.getByRole("button", { name: /Fortitude/ });
  await fortitude.click();
  await expect(fortitude).toHaveAttribute("aria-pressed", "true");

  for (const name of ["Reaper Crew", "Font of Life", "Thermal bath"]) {
    await effects.getByRole("button", { name: new RegExp(name) }).click();
  }
  await effects.getByRole("combobox", { name: "Bonfire log type" }).selectOption("elder");
  await effects.getByRole("spinbutton", { name: "Bonfire Firemaking level" }).fill("110");
  await effects.getByRole("combobox", { name: "Overheal source" }).selectOption("soup-line");
  await closeLoadoutEditor(page);

  // Fortitude clears damage prayer; prayer picker lives on the equipment dialog.
  await openEquipmentEditor(page);
  const equipment = page.getByRole("dialog", { name: "Change equipment" });
  const turmoil = equipment.getByTestId("prayer-picker").getByRole("button", { name: /Turmoil/ });
  await expect(turmoil).toHaveAttribute("aria-pressed", "false");
  await closeLoadoutEditor(page);

  await page.reload();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: /^Defence$/ })).toHaveValue("73");
  await expect(page.getByRole("spinbutton", { name: /^Constitution$/ })).toHaveValue("88");

  await openEffectsEditor(page);
  const reopened = page.getByRole("dialog", { name: "Active effects" });
  await expect(reopened.getByRole("spinbutton", { name: "Current Hitpoints" })).toHaveValue(
    "6000",
  );
  await expect(reopened.getByRole("button", { name: /Fortitude/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(reopened.getByRole("combobox", { name: "Bonfire log type" })).toHaveValue("elder");
  await expect(reopened.getByRole("spinbutton", { name: "Bonfire Firemaking level" })).toHaveValue(
    "110",
  );
  await expect(reopened.getByRole("combobox", { name: "Overheal source" })).toHaveValue(
    "soup-line",
  );
  await closeLoadoutEditor(page);

  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("eq:loadout:v1")!),
  );
  expect(stored).toMatchObject({
    style: "melee",
    attackLevel: 82,
    strengthLevel: 91,
    defenceLevel: 73,
    constitutionLevel: 88,
    currentLife: 6000,
    baseDamage: { mode: "automatic" },
    startingAdrenaline: 72,
    hitCapEnabled: false,
    buffs: {
      fortitude: true,
      styleCurse: "none",
      bonfireLogType: "elder",
      bonfireFiremakingLevel: 110,
    },
  });
  expect(stored.base).toBeUndefined();
});

test("Powerburst doubles life for six seconds and persists its cooldown", async ({ page }) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await openEffectsEditor(page);
  const effects = page.getByRole("dialog", { name: "Active effects" });
  await effects.getByRole("spinbutton", { name: "Current Hitpoints" }).fill("4000");
  await effects.getByRole("button", { name: /Powerburst of vitality/ }).click();
  await closeLoadoutEditor(page);

  await expect(summaryMetric(page, "Current Hitpoints").getByText("8,000")).toBeVisible();
  await expect(summaryMetric(page, "Maximum Hitpoints").getByText("19,800", { exact: true })).toBeVisible();
  await expect(summaryMetric(page, "Current Hitpoints").getByText("4,000")).toBeVisible({
    timeout: 8000,
  });
  await expect(summaryMetric(page, "Maximum Hitpoints").getByText("9,900", { exact: true })).toBeVisible();

  await openEffectsEditor(page);
  const powerburst = page
    .getByRole("dialog", { name: "Active effects" })
    .getByRole("button", { name: /Powerburst of vitality/ });
  await expect(powerburst).toHaveAttribute("aria-disabled", "true");
  await closeLoadoutEditor(page);
  await page.reload();
  await openEffectsEditor(page);
  await expect(
    page
      .getByRole("dialog", { name: "Active effects" })
      .getByRole("button", { name: /Powerburst of vitality/ }),
  ).toHaveAttribute("aria-disabled", "true");
  await closeLoadoutEditor(page);
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

test("ranged passive, ammunition, poison, perk, and blessing rows use game art", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.evaluate(() => {
    localStorage.setItem(
      "eq:build:v1",
      JSON.stringify({
        elective: [],
        relics: {},
        blessingPicks: ["Balance", "Chaos"],
        blessingSelections: [],
        blessingResetsUsed: 0,
      }),
    );
    localStorage.setItem(
      "eq:loadout:v1",
      JSON.stringify({
        style: "ranged",
        startingAdrenaline: 100,
        critChance: 50,
        equipmentSlots: {
          twohand: "item:bow-of-the-last-guardian",
          ammo: "item:bik-arrows",
        },
        perks: { aftershock: 4, crackling: 4 },
        gizmos: { weapon1: ["aftershock", "crackling"] },
        buffs: {
          useEquippedWeaponSpecial: true,
          weaponPoison: "weapon-plus-plus-plus",
          herbloreLevel: 120,
        },
      }),
    );
  });
  await page.reload();
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "Run bar" }).click();
  await expect(page.getByRole("heading", { name: "Ability damage" })).toBeVisible({
    timeout: 120_000,
  });

  const expectEffectIcon = async (id: string, path: RegExp) => {
    const row = page.locator(`[data-effect-id="${id}"]`).first();
    await expect(row).toBeVisible();
    await expect(row.locator("img").first()).toHaveAttribute("src", path);
  };

  await expectEffectIcon("perfect_equilibrium", /bow-of-the-last-guardian\.webp$/);
  await expectEffectIcon("ammunition:bik", /bik-arrows\.webp$/);
  await expectEffectIcon("player_weapon_poison", /weapon-poison\.webp$/);
  await expectEffectIcon("crackling", /crackling\.webp$/);
  await expectEffectIcon("aftershock", /aftershock\.webp$/);
  await expectEffectIcon("big-boned", /big-boned\.webp$/);
  await expect(page.locator('[data-effect-id="ammunition:bik"]').first()).toContainText(
    "Evolving Toxin",
  );
  await expect(page.locator('[data-effect-id="player_weapon_poison"]').first()).toContainText(
    "Weapon poison",
  );
  const resolvedEvents = page.getByRole("region", { name: "Run results" });
  await expect(
    resolvedEvents.getByText(/Perfect Equilibrium · [0-3] stacks/).first(),
  ).toBeVisible();
  await expect(
    resolvedEvents.getByText(/Balance by Force · \d+\.\d+s remaining/).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Analyze damage" }).click();
  const analysis = page.getByRole("dialog", { name: "Damage analysis" });
  const timeline = analysis.getByRole("heading", { name: "Resolved timeline" }).locator("..");
  const inferno = timeline.getByRole("row").filter({ hasText: "Inferno" }).first();
  await expect(inferno).toContainText("Perfect Equilibrium");
});

test("equipped passives appear under Gear and disappear when the item is removed", async ({
  page,
}) => {
  await openEquipmentEditor(page);
  const gear = page.getByRole("dialog", { name: "Change equipment" });
  const passives = gear.getByRole("heading", { name: "Passives" }).locator("..");
  await expect(passives.getByText("Natural Instinct")).toHaveCount(0);

  await gear.getByRole("button", { name: /^Helmet/ }).click();
  await gear.getByRole("searchbox", { name: "Search" }).fill("Jaws of the Abyss");
  await gear.getByRole("button", { name: /Jaws of the Abyss/ }).click();

  await expect(passives.getByText("Natural Instinct doubles this bonus gain.")).toBeVisible();
  await expect(passives.getByText("Active", { exact: true })).toBeVisible();

  await gear.getByRole("button", { name: "Clear Helmet" }).click();
  await expect(passives.getByText("Natural Instinct doubles this bonus gain.")).toHaveCount(0);

  await gear.getByRole("button", { name: /^Off-hand/ }).click();
  await gear.getByRole("searchbox", { name: "Search" }).fill("Kalphite defender");
  await gear.getByRole("button", { name: /Kalphite defender/ }).click();
  await expect(
    passives.getByText("Defenders, reprisers, and rebounders have +3% accuracy."),
  ).toBeVisible();
  await expect(passives.getByText("Active", { exact: true })).toBeVisible();
  await closeLoadoutEditor(page);
});

test("set thresholds downgrade and disappear with equipped pieces", async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.setItem(
      "eq:loadout:v1",
      JSON.stringify({
        style: "melee",
        equipmentSlots: {
          helmet: "item:vestments-of-havoc-hood",
          body: "item:vestments-of-havoc-robe-top",
        },
        equipmentIds: ["item:vestments-of-havoc-hood", "item:vestments-of-havoc-robe-top"],
      }),
    );
  });
  await page.reload();
  await openEquipmentEditor(page);
  const gear = page.getByRole("dialog", { name: "Change equipment" });
  const setCard = gear.locator(".set-effect-card").filter({ hasText: "Vestments of havoc" });
  await expect(setCard).toContainText("2 equipped · 2 effective pieces");
  await expect(setCard.getByText("Active", { exact: true })).toBeVisible();
  await expect(setCard.getByText("Set 3", { exact: true })).toBeVisible();

  await gear.getByRole("button", { name: /^Helmet Hood of the Vestments of Havoc/ }).click();
  await gear.getByRole("button", { name: "Clear Helmet" }).click();
  await expect(setCard).toContainText("1 equipped · 1 effective piece");
  await expect(setCard.getByText("Active", { exact: true })).toHaveCount(0);
  await expect(setCard.getByText("Set 2", { exact: true })).toBeVisible();

  await gear.getByRole("button", { name: "Clear all gear" }).click();
  await expect(gear.getByText("Equip set pieces to activate their effects.")).toBeVisible();
  await closeLoadoutEditor(page);
});

test("combat blessing choices stay synced with Build", async ({ page }) => {
  await page.goto("/build");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  // Build lattice unlocks sequentially; Order→Chaos→Balance grants god-tier Splash Zone path.
  await page.getByRole("button", { name: /Order, tier 1$/ }).click();
  await page.getByRole("button", { name: /Chaos, tier 2$/ }).click();
  await page.getByRole("button", { name: /Balance, tier 3$/ }).click();

  await expect(
    page.getByRole("button", {
      name: /Teragard's Aegis.*Order, tier 1, selected/,
    }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto("/combat");
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  const league = page.locator(".setup-league-display");
  await expect(league.getByText(/Teragard's Aegis|Splash Zone|Order/)).toBeVisible();

  await openEffectsEditor(page);
  const effects = page.getByRole("dialog", { name: "Active effects" });
  await expect(effects.getByRole("combobox", { name: "Blessing tier 1" })).toHaveValue("Order");
  await expect(effects.getByRole("combobox", { name: "Blessing tier 2" })).toHaveValue("Chaos");
  await expect(effects.getByRole("combobox", { name: "Blessing tier 3" })).toHaveValue("Balance");
  await expect(effects.getByText(/God Tier One · Splash Zone/)).toBeVisible();
  await closeLoadoutEditor(page);
});

test("T7 relic selection equips its granted pocket item in the Build loadout", async ({ page }) => {
  await page.goto("/build");
  await page.getByRole("option", { name: "Naragi Edict", exact: true }).click();

  const finalLoadout = page.getByRole("complementary", { name: "Final loadout" });
  await expect(finalLoadout.locator('[aria-label="Pocket: Sliver of Edicts"]')).toBeVisible();

  await page.getByRole("option", { name: "Infernal Fire", exact: true }).click();
  await expect(finalLoadout.locator('[aria-label="Pocket: Avernic Star"]')).toBeVisible();
});

test("Genesis Essence marks the main hand and is visible on Loadout", async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.setItem(
      "eq:build:v1",
      JSON.stringify({
        elective: [],
        relics: {},
        blessingPicks: ["Order", "Order", "Order", "Order", "Order", "Order"],
        blessingSelections: [],
        blessingResetsUsed: 0,
      }),
    );
  });
  await page.reload();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();

  await expect(
    page.getByRole("button", { name: /Main Hand:.*, Genesis Essence active/ }),
  ).toBeVisible();
  await expect(page.locator('img[src="/game/blessings/genesis-essence.webp"]')).toBeVisible();
});

test("combat interaction chrome uses the shared emerald gem token", async ({ page }) => {
  const activeTab = page.getByRole("tab", { name: "Loadout", exact: true });
  await expect(activeTab).toHaveAttribute("aria-selected", "true");
  expect(await activeTab.evaluate((element) => getComputedStyle(element).borderBottomColor)).toBe(
    "rgb(46, 203, 143)",
  );
});

test("set effects come only from equipped gear", async ({ page }) => {
  await openEquipmentEditor(page);
  const gear = page.getByRole("dialog", { name: "Change equipment" });
  await expect(gear.getByRole("heading", { name: "Set effects" })).toBeVisible();
  await expect(gear.getByText("Equip set pieces to activate their effects.")).toBeVisible();
  await expect(gear.getByRole("spinbutton", { name: /^Tectonic/ })).toHaveCount(0);
  await closeLoadoutEditor(page);
});
