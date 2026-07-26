import { expect, test } from "@playwright/test";

/**
 * Places on the map: selection, deep links, and the one regression that
 * matters — poking at the board must never edit the build.
 *
 * Nothing here pins a scraped value; region and place names are structural.
 */

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

  // The whole point of splitting focus from picks: a place is view state.
  await expect(page.getByText("0/3")).toBeVisible();

  // Sticky — a pointer leaving the chip must not clear the selection.
  await page.mouse.move(0, 0);
  await expect(chip).toHaveAttribute("aria-pressed", "true");
});

test("clicking the board focuses without spending a pick", async ({ page }) => {
  // The canvas mounts only after an async adapter probe and the dynamic 3D
  // chunk. Counting immediately reports 0 on a perfectly WebGPU-capable
  // browser, which is how this test silently skipped itself.
  const canvas = page.locator("canvas").first();
  let has3d = true;
  await canvas.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {
    has3d = false;
  });
  test.skip(!has3d, "no WebGPU in this browser");
  await expect(page.getByText("0/3")).toBeVisible();

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  // A few pokes around the middle of the world surface.
  for (const [dx, dy] of [
    [0.5, 0.55],
    [0.42, 0.5],
    [0.58, 0.6],
  ]) {
    await page.mouse.click(box!.x + box!.width * dx, box!.y + box!.height * dy);
  }

  // Before this change every one of those clicks toggled a region.
  await expect(page.getByText("0/3")).toBeVisible();
});

test("deep link opens on a region and its place", async ({ page }) => {
  // Cold load with the hash already present — the pasted-link case.
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
  // Wait for hydration before poking the fragment: the counter only reads 0/3
  // once the build store has loaded, which is after the listener is attached.
  // Without this the hash can change in the gap and the event lands nowhere.
  await expect(page.getByText("0/3")).toBeVisible();
  // Same document, fragment only — back/forward and in-page links land here.
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

test("keyboard reaches a place and the inspector pick control", async ({ page }) => {
  const chip = page.getByRole("button", { name: "Lumbridge", exact: true });
  await chip.focus();
  await expect(chip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(chip).toHaveAttribute("aria-pressed", "true");

  // Picking lives on a named control now that the board no longer toggles.
  // "Pick <region>" / "Remove <region>" deliberately do not start with the
  // region name, so the ledger's /^<name>/ locators stay single-match.
  await page.getByRole("button", { name: /^Kandarin/ }).click();
  await expect(page.getByText("1/3")).toBeVisible();

  const remove = page.getByRole("button", { name: "Remove Kandarin" });
  await expect(remove).toBeVisible();
  await remove.click();
  await expect(page.getByText("0/3")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick Kandarin" })).toBeVisible();
});
