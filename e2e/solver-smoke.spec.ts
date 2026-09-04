/**
 * Focused Revolution solver smoke.
 * Full combat E2E stays in combat.spec.ts.
 *
 * Selectors: revo-optimize, revo-bar-size, revo-solver-cancel,
 * revo-solver-progress, revo-solver-results, revo-ability-rules.
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("ability rules lock, disable, and clear abilities", async ({ page }) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();

  const rules = page.getByTestId("revo-ability-rules");
  await rules.locator("summary").click();
  await rules.getByTestId("revo-ability-rules-search").fill("Dismember");

  const lock = rules.getByRole("button", { name: "Lock Dismember" });
  const disable = rules.getByRole("button", { name: "Disable Dismember" });
  await lock.click();
  await expect(lock).toHaveAttribute("aria-pressed", "true");
  await expect(disable).toHaveAttribute("aria-pressed", "false");
  await expect(rules.locator("summary")).toContainText("1 locked · 0 disabled");

  await disable.click();
  await expect(lock).toHaveAttribute("aria-pressed", "false");
  await expect(disable).toHaveAttribute("aria-pressed", "true");
  await expect(rules.locator("summary")).toContainText("0 locked · 1 disabled");

  await rules.getByRole("button", { name: "Clear rules" }).click();
  await expect(rules.locator("summary")).toContainText("All available");

  await page.setViewportSize({ width: 320, height: 800 });
  const listFits = await rules
    .locator(".revo-ability-rules__list")
    .evaluate((element) => element.scrollWidth <= element.clientWidth + 1);
  expect(listFits).toBe(true);
});

test("ability rules constrain a completed solve and stale progress clears", async ({ page }) => {
  test.setTimeout(60_000);
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();

  const editor = page.getByTestId("revo-bar-editor");
  const barSlots = page.locator(".ability-bar-slot");
  while ((await barSlots.count()) > 1) {
    await barSlots.last().click();
    await editor.getByRole("button", { name: "Remove", exact: true }).click();
  }
  await editor.getByRole("combobox", { name: "Ability in slot 1" }).selectOption({
    label: "Berserk",
  });
  for (const ability of ["Dismember", "Rend", "Punish"]) {
    await editor.getByRole("combobox", { name: "Ability to add" }).selectOption({ label: ability });
    await editor.getByRole("button", { name: "Add slot", exact: true }).click();
  }

  const rules = page.getByTestId("revo-ability-rules");
  await rules.locator("summary").click();
  await rules.getByRole("button", { name: "Lock Dismember" }).click();

  const keptAbilities = new Set(["Berserk", "Dismember", "Rend", "Punish"]);
  const disableLabels = await rules
    .locator('button[aria-label^="Disable "]')
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? ""));
  for (const label of disableLabels) {
    const ability = label.replace(/^Disable /, "");
    if (!keptAbilities.has(ability)) {
      await rules.getByRole("button", { name: label, exact: true }).click();
    }
  }

  await page.getByTestId("revo-bar-size").selectOption("fixed4");
  await page.getByTestId("revo-optimize").click();

  const results = page.getByTestId("revo-solver-results");
  await expect(results).toBeVisible({ timeout: 45_000 });
  await expect(results).toContainText("Dismember");
  await expect(results).not.toContainText("Backhand");

  await page.getByTestId("revo-solver-profile").selectOption("burst");
  await expect(page.getByTestId("revo-solver-progress")).toHaveCount(0);
  await expect(results).toHaveCount(0);
});

test("rotation solver starts, shows progress, and cancel leaves no verified result", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();

  const revoMode = page.getByRole("button", { name: /^revo/i });
  if (await revoMode.count()) {
    await revoMode.first().click();
  }

  const optimize = page.getByTestId("revo-optimize");
  await expect(optimize).toBeVisible({ timeout: 15_000 });

  // Fixed four-slot bounds via compact size preset.
  const sizeSelect = page.getByTestId("revo-bar-size");
  await expect(sizeSelect).toBeVisible();
  await sizeSelect.selectOption("fixed4");
  await expect(sizeSelect).toHaveValue("fixed4");

  await page.evaluate(() => {
    const tick = () => {
      const root = document.documentElement;
      root.dataset.solverFrames = String(Number(root.dataset.solverFrames ?? 0) + 1);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await optimize.click();
  await expect(page.getByTestId("revo-solver-progress")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("revo-solver-cancel")).toBeVisible({ timeout: 5_000 });

  const framesBefore = Number(await page.locator("html").getAttribute("data-solver-frames"));
  await page.waitForTimeout(500);
  const framesAfter = Number(await page.locator("html").getAttribute("data-solver-frames"));
  expect(framesAfter - framesBefore).toBeGreaterThan(5);

  await page.getByTestId("revo-solver-cancel").click();

  await expect(optimize).toBeEnabled({ timeout: 20_000 });
  await expect(page.getByTestId("revo-solver-cancel")).toHaveCount(0);

  // No final verified result: either no results panel, or stopped-early only.
  const results = page.getByTestId("revo-solver-results");
  if (await results.count()) {
    const text = await results.innerText();
    expect(text.toLowerCase()).toMatch(/stopped|stop|preview/);
    expect(text.toLowerCase()).not.toMatch(/full-shortlist-best|globally-optimal/);
  }

  await expect(page.getByTestId("revo-solver-progress")).toBeVisible();
  const rules = page.getByTestId("revo-ability-rules");
  await rules.locator("summary").click();
  await rules.getByTestId("revo-ability-rules-search").fill("Dismember");
  await rules.getByRole("button", { name: "Lock Dismember" }).click();
  await expect(page.getByTestId("revo-solver-progress")).toHaveCount(0);
  await expect(page.getByTestId("revo-solver-results")).toHaveCount(0);
});

test("uncached rotation analysis stays responsive and returns a worker result", async ({
  page,
}) => {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page.getByRole("button", { name: "Show all active effects", exact: true }).click();
  const effects = page.getByRole("dialog", { name: "Active effects" });
  const vulnerability = effects.getByRole("checkbox", { name: /Vulnerability/ });
  await vulnerability.check();
  await expect(vulnerability).toBeChecked();
  await effects.getByRole("button", { name: "Close loadout editor" }).click();
  await expect(effects).toBeHidden();

  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByTestId("revo-run-duration").fill("67");

  await page.evaluate(() => {
    const tick = () => {
      const root = document.documentElement;
      root.dataset.runFrames = String(Number(root.dataset.runFrames ?? 0) + 1);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.getByTestId("revo-run-button").click();
  await expect(page.getByTestId("revo-run-busy")).toBeVisible();

  const framesBefore = Number(await page.locator("html").getAttribute("data-run-frames"));
  await page.waitForTimeout(500);
  const framesAfter = Number(await page.locator("html").getAttribute("data-run-frames"));
  expect(framesAfter - framesBefore).toBeGreaterThan(5);

  await expect(page.getByTestId("revo-casts")).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByTestId("revo-run-worker-error")).toHaveCount(0);
});
