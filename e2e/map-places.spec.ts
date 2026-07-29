import { expect, test } from "@playwright/test";


test.beforeEach(async ({ page }) => {
  await page.goto("/map");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("selecting a place does not touch elective picks", async ({ page }) => {
  await expect(page.getByText("0/3")).toBeVisible();

  const chip = page.getByRole("button", { name: "Varrock", exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute("aria-pressed", "true");

  await expect(page.getByText("0/3")).toBeVisible();

  await page.mouse.move(0, 0);
  await expect(chip).toHaveAttribute("aria-pressed", "true");
});

test("clicking the board focuses without spending a pick", async ({ page }) => {
  const canvas = page.locator("canvas").first();
  let has3d = true;
  await canvas.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {
    has3d = false;
  });
  test.skip(!has3d, "no WebGPU in this browser");
  await expect(page.getByText("0/3")).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  for (const [dx, dy] of [
    [0.5, 0.55],
    [0.42, 0.5],
    [0.58, 0.6],
  ]) {
    await page.mouse.click(box!.x + box!.width * dx, box!.y + box!.height * dy);
  }

  await expect(page.getByText("0/3")).toBeVisible();
});

test("deep link opens on a region and its place", async ({ page }) => {
  await page.goto("/");
  await page.goto("/map#region=morytania&place=Barrows");
  const panel = page.locator('section[aria-label="Region detail"]');
  await expect(panel.locator(".panel-head")).toContainText("Morytania");
  await expect(page.getByRole("button", { name: "Barrows", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("hash change on an open page moves the inspector", async ({ page }) => {
  await expect(page.getByText("0/3")).toBeVisible();
  await page.evaluate(() => {
    window.location.hash = "#region=tirannwn&place=Prifddinas";
  });
  const panel = page.locator('section[aria-label="Region detail"]');
  await expect(panel.locator(".panel-head")).toContainText("Tirannwn");
});

test("selecting a place writes a shareable hash", async ({ page }) => {
  await page.getByRole("button", { name: "Lumbridge", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => window.location.hash))
    .toBe("#region=misthalin&place=Lumbridge");
});

test("keyboard reaches a place and the ledger toggles elective picks", async ({ page }) => {
  const chip = page.getByRole("button", { name: "Lumbridge", exact: true });
  await chip.focus();
  await expect(chip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(chip).toHaveAttribute("aria-pressed", "true");

  const kandarin = page.getByRole("button", { name: /^Kandarin/ });
  await kandarin.click();
  await expect(page.getByText("1/3")).toBeVisible();
  await expect(kandarin).toHaveAttribute("aria-pressed", "true");

  await kandarin.click();
  await expect(page.getByText("0/3")).toBeVisible();
  await expect(kandarin).toHaveAttribute("aria-pressed", "false");
});
