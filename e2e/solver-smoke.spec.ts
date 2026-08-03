/**
 * Focused Revolution solver smoke - cancel path only.
 * Full combat E2E stays in combat.spec.ts.
 *
 * Selectors: revo-optimize, revo-bar-size, revo-solver-cancel,
 * revo-solver-progress, revo-solver-results.
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
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

  await optimize.click();
  await expect(page.getByTestId("revo-solver-progress")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId("revo-solver-cancel")).toBeVisible({ timeout: 5_000 });

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
});
