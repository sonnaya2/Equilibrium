import { expect, test, type Locator, type Page } from "@playwright/test";

const summary = (page: Page) => page.getByRole("complementary", { name: "Loadout summary" });

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

test.beforeEach(async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("quick calculator runs the real pipeline", async ({ page }) => {
  await page.getByRole("button", { name: "Abilities", exact: true }).click();
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
  await page.getByRole("button", { name: "Abilities", exact: true }).click();
  await page.locator(".combat-quick-toolbar").getByRole("button", { name: "Necromancy" }).click();
  await page.getByRole("option", { name: /Volley of Souls/ }).click();
  await expect(page.getByRole("heading", { name: "Volley of Souls" })).toBeVisible();
  await expect(page.getByText("Residual Souls")).toBeVisible();
  // Summary rail and ability readout both say Damage Potential — pin the first.
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
  await expect(page.getByText("Natural DPS", { exact: true })).toBeVisible();
  await expect(page.getByText("6 ticks · 3.6s").first()).toBeVisible();
});

test("combat navigation exposes the production workspaces", async ({ page }) => {
  const tabs = page.getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await expect(tabs).toHaveText(["Loadout", "Rotation", "Analysis"]);
  await expect(page.getByRole("tab", { name: "Reference" })).toHaveCount(0);

  const nav = page.getByRole("navigation", { name: "Loadout sections" });
  await expect(nav.getByRole("button")).toHaveText([
    "Gear",
    "Stats",
    "Buffs",
    "Archaeology",
    "Invention",
    "Abilities",
    "Target",
  ]);

  await page.getByRole("button", { name: "Gear", exact: true }).click();
  const doll = page.getByRole("group", { name: "Equipment slots" });
  await expect(doll.getByText("Main-hand")).toBeVisible();
  await expect(doll.getByText("Empty").first()).toBeVisible();

  await page.getByRole("button", { name: "Archaeology", exact: true }).click();
  await expect(page.getByText("No Archaeology combat buffs are modeled yet.")).toBeVisible();

  await page.getByRole("button", { name: "Invention", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Invention" })).toBeVisible();
  const aftershock = page.getByRole("button", { name: /Aftershock.*Weapon/ });
  await page.getByRole("button", { name: /Armour 1/ }).click();
  await expect(aftershock).toHaveAttribute("aria-disabled", "true");
  await page.getByRole("button", { name: /Weapon 1/ }).click();
  await aftershock.click();
  await expect(page.getByRole("status", { name: "Aftershock rank" })).toHaveText("R1");
  await page.getByRole("button", { name: "Increase Aftershock rank" }).click();
  await expect(page.getByRole("status", { name: "Aftershock rank" })).toHaveText("R2");

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
  // Overload boosts Defence: elder is floor(99 × 0.17) + 5 = 21 over 99 → 120.
  // Summary shows one Defence row (visible level); base 99 is in the dropdown.
  const defence = summaryMetric(page, "Defence");
  await expect(defence.getByText("120")).toBeVisible();
  await defence.locator("summary").click();
  await expect(defence.getByText("99", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Gear", exact: true }).click();
  await expect(page.getByText("Equip set pieces to activate their effects.")).toBeVisible();

  await page.getByRole("button", { name: "Target", exact: true }).click();
  await page.getByRole("checkbox", { name: "Use NPC target model" }).check();
  await expect(page.getByRole("combobox", { name: "Affinity" })).toBeVisible();
});

test("setup summary exposes the complete core-derived stat line", async ({ page }) => {
  for (const label of [
    "Base ability damage",
    "Equipment damage",
    "Accuracy",
    "Damage Potential",
    "Crit chance",
    "Crit damage",
    "Defence",
    // Armour is the Loadout-screen stat; armour rating is hit-chance only.
    "Armour",
    "Armour rating",
    "Maximum HP",
    "Current HP",
    "Prayer bonus",
    "Starting adrenaline",
    "Maximum adrenaline",
  ]) {
    await expect(summaryMetric(page, label)).toBeVisible();
  }
  // Hit cap lives on Rotation, not the loadout summary.
  await expect(summaryMetric(page, "Hit cap")).toHaveCount(0);
});

test("summary breakdowns reconcile and open from the keyboard", async ({ page }) => {
  const crit = summaryMetric(page, "Crit chance");
  const toggle = crit.locator("summary");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(crit).toHaveAttribute("open", "");
  await expectBreakdownToReconcile(crit);

  const life = summaryMetric(page, "Maximum HP");
  await life.locator("summary").focus();
  await page.keyboard.press("Space");
  await expect(life).toHaveAttribute("open", "");
  await expectBreakdownToReconcile(life);

  const base = summaryMetric(page, "Base ability damage");
  await base.locator("summary").click();
  await expectBreakdownToReconcile(base);
});

test("summary reacts to temporary life effects and a manual Damage Potential override", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await page.getByRole("button", { name: /Reaper Crew/ }).click();
  await page.getByRole("button", { name: /Font of Life/ }).click();
  await page.getByRole("button", { name: /Boon of Het/ }).click();

  // Persistent buffs raise Maximum HP; temporary ones update the same row.
  const maximumHp = summaryMetric(page, "Maximum HP");
  await expect(maximumHp.getByText("11,095")).toBeVisible();
  await page.getByRole("button", { name: /Thermal bath/ }).click();
  await expect(maximumHp.getByText("11,392")).toBeVisible();
  await expect(maximumHp).toContainText("Includes temporary effects");
  await maximumHp.locator("summary").click();
  await expectBreakdownToReconcile(maximumHp);

  await page.getByRole("button", { name: "Target", exact: true }).click();
  await page.getByRole("checkbox", { name: "Use NPC target model" }).check();
  await page.getByRole("checkbox", { name: "Manual Damage Potential override" }).check();
  await page.getByRole("spinbutton", { name: "Damage Potential override" }).fill("73");
  await expect(
    summaryMetric(page, "Damage Potential").getByText("73%", { exact: true }),
  ).toBeVisible();
  await expect(summaryMetric(page, "Damage Potential")).toContainText("manual override");
});

test("setup summary and every editor subtab stay within a phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ["Gear", "Stats", "Buffs", "Archaeology", "Invention", "Abilities", "Target"]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await expect(summary(page)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
      `${tab} should not overflow horizontally`,
    ).toBe(true);
  }
});

test("revolution is the default mode with the wiki bar graphic", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();

  await expect(page.getByRole("button", { name: "Optimize bar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run bar" })).toBeVisible();
  await expect(page.getByTestId("revo-empty")).toBeVisible();
  await expect(page.getByTestId("revo-horizon-plan")).toHaveText(/100 ticks/);

  await expect(page.getByText(/\d+ of \d+ slots modelled/)).toBeVisible();
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

test("revolution solver optimizes and apply keeps a runnable bar", async ({ page }) => {
  test.setTimeout(180_000);
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await expect(page.getByRole("button", { name: "Optimize bar" })).toBeVisible();

  // Thorough depth is the default; cap slots for a faster browser pass.
  await page.getByLabel("Max slots").fill("6");
  await page.getByRole("button", { name: "Optimize bar" }).click();

  const progress = page.getByTestId("revo-solver-progress");
  await expect(progress).toBeVisible();
  await expect(progress).toHaveAttribute("aria-busy", "true");

  await expect(page.getByTestId("revo-solver-results")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("revo-solver-results")).toContainText(/Score/);
  await expect(progress).toHaveAttribute("aria-busy", "false");
  await expect(page.getByTestId("revo-optimize")).toHaveText("Optimize bar");

  await page.getByRole("button", { name: "Apply" }).first().click();
  await expect(page.getByText(/Solved bar/)).toBeVisible();
  await page.getByRole("button", { name: "Run bar" }).click();
  await expect(page.getByText("Fixed-window DPS", { exact: true })).toBeVisible();
  await expect(page.getByTestId("revo-casts")).toBeVisible();
});

test("solver progress advances at least twice before results", async ({ page }) => {
  test.setTimeout(180_000);
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByLabel("Max slots").fill("6");

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
  await page.getByRole("button", { name: "Necromancy", exact: true }).click();
  await expect(page.getByRole("button", { name: /Volley of Souls/ })).toBeVisible();
});

test("loadout calculation controls reset automatic base and persist into Revolution", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Stats", exact: true }).click();

  const baseAuto = page.getByRole("checkbox", { name: "Base ability damage automatic" });
  await baseAuto.uncheck();
  await page.getByRole("spinbutton", { name: "Base ability damage" }).fill("9999");
  // Manual entry shows in the summary total when Aegis is 0; open the dropdown
  // only to prove the Manual source line also reconciles.
  const baseMetric = summaryMetric(page, "Base ability damage");
  await expect(baseMetric.locator("strong")).toHaveText("9,999");
  await baseMetric.locator("summary").click();
  await expect(baseMetric.locator("dd").filter({ hasText: "9,999" })).toBeVisible();

  await page.getByRole("spinbutton", { name: "Main weapon tier" }).fill("91");
  await expect(baseAuto).toBeChecked();
  await page.getByRole("spinbutton", { name: "Starting adrenaline" }).fill("62");

  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("checkbox", { name: "30,000 hit cap" }).uncheck();

  await page.reload();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Abilities", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Use Loadout" })).toBeChecked();
  await expect(page.getByRole("spinbutton", { name: "Base ability damage" })).toHaveValue("1705");

  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "30,000 hit cap" })).not.toBeChecked();
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
        target: { defenceLevel: 88, armour: 420, affinity: "strong" },
        baseDamage: { mode: "manual", manualValue: 4321 },
        startingAdrenaline: 72,
        hitCapEnabled: false,
      }),
    );
  });
  await page.reload();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Stats", exact: true }).click();

  await expect(page.getByRole("spinbutton", { name: "Attack level" })).toHaveValue("82");
  await expect(page.getByRole("spinbutton", { name: "Strength level" })).toHaveValue("91");
  await expect(page.getByRole("spinbutton", { name: "Defence level" })).toHaveValue("99");
  await expect(page.getByRole("spinbutton", { name: "Constitution level" })).toHaveValue("99");
  await expect(
    page.getByRole("checkbox", { name: "Base ability damage automatic" }),
  ).not.toBeChecked();
  await expect(page.getByRole("spinbutton", { name: "Starting adrenaline" })).toHaveValue("72");
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "30,000 hit cap" })).not.toBeChecked();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Stats", exact: true }).click();

  await page.getByRole("spinbutton", { name: "Defence level" }).fill("73");
  await page.getByRole("spinbutton", { name: "Constitution level" }).fill("88");
  // Current HP follows the maximum until that is turned off.
  await page.getByRole("checkbox", { name: "Current HP automatic" }).uncheck();
  await page.getByRole("spinbutton", { name: "Current HP" }).fill("6000");
  await page.getByRole("button", { name: "Buffs", exact: true }).click();

  const fortitude = page.getByRole("button", { name: /Fortitude/ });
  const turmoil = page.getByRole("button", { name: /Turmoil/ });
  await fortitude.click();
  await expect(fortitude).toHaveAttribute("aria-pressed", "true");
  await expect(turmoil).toHaveAttribute("aria-pressed", "false");
  await turmoil.click();
  await expect(fortitude).toHaveAttribute("aria-pressed", "false");
  await fortitude.click();

  for (const name of ["Reaper Crew", "Font of Life", "Boon of Het", "Thermal bath"]) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
  }
  await page.getByRole("combobox", { name: "Bonfire log type" }).selectOption("elder");
  await page.getByRole("spinbutton", { name: "Bonfire Firemaking level" }).fill("110");
  const totem = page.getByRole("button", { name: /Totem of Vitality/ });
  await totem.click();
  await expect(page.getByRole("combobox", { name: "Bonfire log type" })).toHaveValue("none");
  await totem.click();
  await page.getByRole("combobox", { name: "Bonfire log type" }).selectOption("elder");
  await page.getByRole("combobox", { name: "Overheal source" }).selectOption("soup-line");

  await page.reload();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Defence level" })).toHaveValue("73");
  await expect(page.getByRole("spinbutton", { name: "Constitution level" })).toHaveValue("88");
  await expect(page.getByRole("spinbutton", { name: "Current HP" })).toHaveValue("6000");
  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await expect(page.getByRole("button", { name: /Fortitude/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("combobox", { name: "Bonfire log type" })).toHaveValue("elder");
  await expect(page.getByRole("spinbutton", { name: "Bonfire Firemaking level" })).toHaveValue(
    "110",
  );
  await expect(page.getByRole("combobox", { name: "Overheal source" })).toHaveValue("soup-line");

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
    baseDamage: { mode: "manual", manualValue: 4321 },
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
  await page.getByRole("button", { name: "Stats", exact: true }).click();
  await page.getByRole("checkbox", { name: "Current HP automatic" }).uncheck();
  await page.getByRole("spinbutton", { name: "Current HP" }).fill("4000");
  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await page.getByRole("button", { name: /Powerburst of vitality/ }).click();
  await page.getByRole("button", { name: "Stats", exact: true }).click();

  const life = page.getByRole("heading", { name: "Defence & life" }).locator("..");
  await expect(page.getByRole("spinbutton", { name: "Current HP" })).toHaveValue("8000");
  await expect(life.getByText("19,800", { exact: true })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Current HP" })).toHaveValue("4000", {
    timeout: 8000,
  });
  await expect(life.getByText("9,900", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  const powerburst = page.getByRole("button", { name: /Powerburst of vitality/ });
  await expect(powerburst).toHaveAttribute("aria-disabled", "true");
  await page.reload();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await expect(page.getByRole("button", { name: /Powerburst of vitality/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
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

test("equipped passives appear under Gear and disappear when the item is removed", async ({
  page,
}) => {
  const passives = page.getByRole("heading", { name: "Passives" }).locator("..");
  await expect(passives.getByText("No equipped item grants a passive.")).toBeVisible();

  await page.getByRole("button", { name: /^Helmet/ }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill("Jaws of the Abyss");
  await page.getByRole("button", { name: /Jaws of the Abyss/ }).click();

  await expect(passives.getByText("Natural Instinct doubles this bonus gain.")).toBeVisible();
  await expect(passives.getByText("Modeled", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Clear Helmet" }).click();
  await expect(passives.getByText("No equipped item grants a passive.")).toBeVisible();

  await page.getByRole("button", { name: /^Off-hand/ }).click();
  await page.getByRole("searchbox", { name: "Search" }).fill("Kalphite defender");
  await page.getByRole("button", { name: /Kalphite defender/ }).click();
  await expect(
    passives.getByText("Defenders, reprisers, and rebounders have +3% accuracy."),
  ).toBeVisible();
  await expect(passives.getByText("Modeled", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Gear", exact: true }).click();
  const setCard = page.locator(".set-effect-card").filter({ hasText: "Vestments of havoc" });
  await expect(setCard).toContainText("2/4");
  await expect(setCard.getByText("Active", { exact: true })).toBeVisible();
  await expect(setCard.getByText("Set 3", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /^Helmet Hood of the Vestments of Havoc/ }).click();
  await page.getByRole("button", { name: "Clear Helmet" }).click();
  await expect(setCard).toContainText("1/4");
  await expect(setCard.getByText("Active", { exact: true })).toHaveCount(0);
  await expect(setCard.getByText("Set 2", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Clear all gear" }).click();
  await expect(page.getByText("Equip set pieces to activate their effects.")).toBeVisible();
});

test("combat blessing choices stay synced with Build", async ({ page }) => {
  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await page.getByRole("combobox", { name: "Blessing tier 1" }).selectOption("Order");
  await page.getByRole("combobox", { name: "Blessing tier 2" }).selectOption("Chaos");
  await page.getByRole("combobox", { name: "Blessing tier 3" }).selectOption("Balance");
  await expect(page.getByText(/God Tier One · Splash Zone/)).toBeVisible();

  await page.goto("/build");
  await expect(
    page.getByRole("button", {
      name: /Teragard's Aegis, Order, tier 1, selected/,
    }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto("/combat");
  await page.getByRole("button", { name: "Buffs", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Blessing tier 1" })).toHaveValue("Order");
  await expect(page.getByRole("combobox", { name: "Blessing tier 2" })).toHaveValue("Chaos");
  await expect(page.getByRole("combobox", { name: "Blessing tier 3" })).toHaveValue("Balance");
});

test("combat interaction chrome uses the shared emerald gem token", async ({ page }) => {
  const activeTab = page.getByRole("tab", { name: "Loadout", exact: true });
  await expect(activeTab).toHaveAttribute("aria-selected", "true");
  expect(await activeTab.evaluate((element) => getComputedStyle(element).borderBottomColor)).toBe(
    "rgb(46, 203, 143)",
  );
});

test("set effects come only from equipped gear", async ({ page }) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Gear", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Set effects" })).toBeVisible();
  await expect(page.getByText("Equip set pieces to activate their effects.")).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: /^Tectonic/ })).toHaveCount(0);
});
