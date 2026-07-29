import { expect, test } from "@playwright/test";


type Diag = { ticks: number };

async function settle(page: import("@playwright/test").Page): Promise<boolean> {
  await page.goto("/map");
  const ok = await page
    .locator("canvas")
    .first()
    .waitFor({ state: "visible", timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  if (!ok) return false;
  await page.waitForTimeout(4500);
  return await page.evaluate(
    () => typeof (window as never as { __mapDiag?: unknown }).__mapDiag === "function",
  );
}

async function idleTicks(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const diag = (window as never as { __mapDiag?: () => Diag }).__mapDiag!;
    const before = diag().ticks;
    await new Promise((r) => setTimeout(r, 2000));
    return (diag().ticks - before) / 2;
  });
}

async function movesAtRest(page: import("@playwright/test").Page) {
  const canvas = page.locator("canvas").first();
  const a = await canvas.screenshot();
  await page.waitForTimeout(700);
  return !a.equals(await canvas.screenshot());
}

test("sea animates at rest without pinning the frameloop", async ({ page }) => {
  test.skip(!(await settle(page)), "no WebGPU / dev probe (production build)");
  const ticks = await idleTicks(page);
  expect(await movesAtRest(page), "sea should move with no pointer input").toBe(true);
  expect(ticks).toBeGreaterThan(20);
  expect(ticks).toBeLessThan(45);
});

test("reduced motion is completely still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  test.skip(!(await settle(page)), "no WebGPU / dev probe (production build)");
  expect(await idleTicks(page)).toBe(0);
  expect(await movesAtRest(page), "reduced motion must not animate").toBe(false);
});

test("an offscreen canvas stops asking for frames", async ({ page }) => {
  test.skip(!(await settle(page)), "no WebGPU / dev probe (production build)");
  await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (c) (c as HTMLCanvasElement).style.display = "none";
  });
  await page.waitForTimeout(1200);
  expect(await idleTicks(page)).toBe(0);
});
