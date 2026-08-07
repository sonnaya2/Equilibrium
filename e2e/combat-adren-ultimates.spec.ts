import { expect, test, type Page } from "@playwright/test";

/**
 * Proves the live combat UI applies FotS/CoE adren economy and still casts
 * 100-cost ultimates (Death's Swiftness) in the manual rotation simulator.
 */

async function openArch(page: Page) {
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Loadout sections" })
    .getByRole("button", { name: "Arch", exact: true })
    .click();
}

async function selectRelicIfNeeded(page: Page, name: RegExp) {
  const tile = page.getByRole("button", { name }).first();
  await expect(tile).toBeVisible({ timeout: 15_000 });
  const pressed = await tile.getAttribute("aria-pressed");
  if (pressed !== "true") {
    await tile.click();
  }
  await expect(tile).toHaveAttribute("aria-pressed", "true");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem("eq:build:v1", JSON.stringify({ elective: ["kandarin"] }));
  });
  await page.reload();
});

test("manual rotation casts Death's Swiftness with CoE + FotS at 100 start adren", async ({
  page,
}) => {
  // Stats: force full open adren (ultimates need 100).
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Loadout sections" })
    .getByRole("button", { name: "Stats", exact: true })
    .click();
  await page.getByRole("spinbutton", { name: /Starting adrenaline/i }).fill("100");

  // Arch: Fury of the Small + Conservation of Energy (500 energy exactly).
  await openArch(page);
  await selectRelicIfNeeded(page, /Fury of the Small/i);
  await selectRelicIfNeeded(page, /Conservation of Energy/i);

  // Rotation → manual → ranged → queue DS → Run
  await page.getByRole("tab", { name: "Rotation", exact: true }).click();
  await page.getByRole("button", { name: "manual", exact: true }).click();
  await page.getByRole("button", { name: "Ranged", exact: true }).click();

  // Use Loadout keeps gear gates; DS is ranged and should stay available.
  const useLoadout = page.getByRole("checkbox", { name: /Use Loadout/i });
  if (await useLoadout.isVisible().catch(() => false)) {
    // Leave checked if possible; if DS is gated, uncheck.
  }

  const dsBtn = page.getByRole("button", { name: /Death's Swiftness/i }).first();
  await expect(dsBtn).toBeVisible({ timeout: 10_000 });
  if (await dsBtn.isDisabled()) {
    await useLoadout.uncheck();
  }
  await dsBtn.click();
  await expect(page.getByText(/Queue · 1 cast/)).toBeVisible();

  await page.getByRole("button", { name: "Run", exact: true }).click();

  // Success: fixed-window DPS metrics and DS row in the cast table.
  await expect(page.getByText("Fixed-window DPS", { exact: true })).toBeVisible({ timeout: 15_000 });
  const dsRow = page
    .locator("tbody tr")
    .filter({ hasText: /Death's Swiftness/i })
    .first();
  await expect(dsRow).toBeVisible();
  // CoE leaves 10 after a 100 dump when starting full (adren column on that row).
  await expect(dsRow.locator("td").last()).toHaveText(/10%/);
});

test("FotS + CoE stay selected at 500 energy after reload", async ({ page }) => {
  await openArch(page);
  await selectRelicIfNeeded(page, /Fury of the Small/i);
  await selectRelicIfNeeded(page, /Conservation of Energy/i);

  await page.reload();
  await openArch(page);
  await expect(page.getByRole("button", { name: /Fury of the Small/i }).first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page.getByRole("button", { name: /Conservation of Energy/i }).first(),
  ).toHaveAttribute("aria-pressed", "true");
});
