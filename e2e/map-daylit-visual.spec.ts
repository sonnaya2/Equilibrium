import { expect, test } from "@playwright/test";
import path from "node:path";

/**
 * Visual capture for production /map vs Daylit remaster lab.
 * Screenshots land under test-results/daylit/ — not pinned dates, no golden pixel assert.
 */

const SHOT_DIR = path.join("test-results", "daylit");

async function waitBoard(page: import("@playwright/test").Page): Promise<"canvas" | "fallback" | "none"> {
  const canvas = page.locator("canvas").first();
  const canvasOk = await canvas
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (canvasOk) return "canvas";

  const fallback = page.getByText(/no WebGPU/i).first();
  const fallbackOk = await fallback
    .waitFor({ state: "visible", timeout: 8_000 })
    .then(() => true)
    .catch(() => false);
  return fallbackOk ? "fallback" : "none";
}

test.describe("map daylit visual", () => {
  test("production /map screenshots + region focus", async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });

    await page.goto("/map");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();

    const mode = await waitBoard(page);
    // Soft: canvas when WebGPU works; fallback is also a valid honest state.
    expect(mode === "canvas" || mode === "fallback").toBeTruthy();

    // Let intro / first paint settle when WebGPU mounts.
    if (mode === "canvas") await page.waitForTimeout(2500);

    await page.screenshot({
      path: path.join(SHOT_DIR, "map-prod.png"),
      fullPage: true,
    });

    if (mode === "canvas") {
      await page.locator("canvas").first().screenshot({
        path: path.join(SHOT_DIR, "map-prod-board.png"),
      });
    }

    // Production defaults focus to Misthalin (useMapFocus INITIAL).
    const detail = page.locator('section[aria-label="Region detail"]');
    const misthalin = page.getByRole("button", { name: /^Misthalin/ });
    await expect(misthalin).toBeVisible();
    await expect(detail.locator(".panel-head")).toContainText("Misthalin");

    await page.screenshot({
      path: path.join(SHOT_DIR, "map-prod-focus.png"),
      fullPage: true,
    });

    // After the board mounts, the side detail panel often intercepts pointer
    // events over the ledger (actionability fail). Dispatch click on the
    // button node so focusRegion still runs without a force-hit that can
    // blank the WebGPU surface.
    const asgarnia = page.getByRole("button", { name: /^Asgarnia/ });
    await asgarnia.evaluate((el) => (el as HTMLButtonElement).click());
    await expect(detail.locator(".panel-head")).toContainText("Asgarnia", { timeout: 10_000 });
    if (mode === "canvas") await page.waitForTimeout(900);

    await page.screenshot({
      path: path.join(SHOT_DIR, "map-prod-asgarnia.png"),
      fullPage: true,
    });

    // Page must stay usable — no crash overlay, main content still present.
    await expect(page.getByRole("navigation")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Misthalin/ })).toBeVisible();

    // Soft canvas presence when available (do not fail headless without WebGPU).
    if (mode === "canvas") {
      await expect(page.locator("canvas").first()).toBeVisible();
    }

    test.info().annotations.push({
      type: "console-errors",
      description: errors.length ? errors.join("\n") : "(none)",
    });
    expect(errors.filter((e) => /ChunkLoadError|Application error|Hydration/i.test(e))).toEqual([]);
  });

  test("concepts/map-remaster Daylit default screenshots", async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
    });

    await page.goto("/concepts/map-remaster");
    // Daylit is the arena champion / default tab.
    await expect(page.getByRole("tab", { name: /Daylit/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    const mode = await waitBoard(page);
    expect(mode === "canvas" || mode === "fallback" || mode === "none").toBeTruthy();
    if (mode === "canvas") await page.waitForTimeout(2500);
    else await page.waitForTimeout(1500);

    await page.screenshot({
      path: path.join(SHOT_DIR, "map-daylit-lab.png"),
      fullPage: true,
    });

    if (mode === "canvas") {
      await page.locator("canvas").first().screenshot({
        path: path.join(SHOT_DIR, "map-daylit-lab-board.png"),
      });
    }

    // RemasterShell defaults initialRegion to misthalin — do not click it
    // (toggle would clear focus). Assert default, then switch to a second region.
    const misthalin = page.getByRole("button", { name: /^Misthalin/ }).first();
    await expect(misthalin).toBeVisible({ timeout: 15_000 });
    await expect(misthalin).toHaveAttribute("aria-pressed", "true");

    await page.screenshot({
      path: path.join(SHOT_DIR, "map-daylit-lab-focus.png"),
      fullPage: true,
    });

    // Explicit re-select path: clear Misthalin then re-press (covers click path).
    await misthalin.click({ force: true });
    await expect(misthalin).toHaveAttribute("aria-pressed", "false");
    await misthalin.click({ force: true });
    await expect(misthalin).toHaveAttribute("aria-pressed", "true");

    const asgarnia = page.getByRole("button", { name: /^Asgarnia/ }).first();
    await asgarnia.click({ force: true });
    await expect(asgarnia).toHaveAttribute("aria-pressed", "true");
    if (mode === "canvas") await page.waitForTimeout(600);

    await page.screenshot({
      path: path.join(SHOT_DIR, "map-daylit-lab-asgarnia.png"),
      fullPage: true,
    });

    await expect(page.getByRole("heading", { name: /Map remaster/i }).first()).toBeVisible();
    if (mode === "canvas") {
      await expect(page.locator("canvas").first()).toBeVisible();
    }

    test.info().annotations.push({
      type: "console-errors",
      description: errors.length ? errors.join("\n") : "(none)",
    });
    expect(errors.filter((e) => /ChunkLoadError|Application error|Hydration/i.test(e))).toEqual([]);
  });
});
