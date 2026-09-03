import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/combat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("magic combat spell picker switches and persists", async ({ page }) => {
  await page.getByRole("button", { name: "Magic", exact: true }).click();
  await page.getByRole("tab", { name: "Loadout", exact: true }).click();

  const picker = page.getByRole("group", { name: "Active Magic spell" });
  await expect(picker.getByRole("button", { name: "Manual", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await picker.getByRole("button", { name: "Incite Fear", exact: true }).click();
  await expect(picker.getByRole("button", { name: "Incite Fear", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(picker.getByText("Glacial Embrace reduces Tsunami cost")).toBeVisible();

  await page.reload();
  const restored = page.getByRole("group", { name: "Active Magic spell" });
  await expect(restored.getByRole("button", { name: "Incite Fear", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
