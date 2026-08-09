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

  await expect(page.getByText("DPS", { exact: true })).toBeVisible({
    timeout: 25_000,
  });
  await expect(page.getByTestId("revo-run-worker-error")).toHaveCount(0);
});
