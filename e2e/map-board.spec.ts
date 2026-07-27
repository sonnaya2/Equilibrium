import { expect, test } from "@playwright/test";
import path from "node:path";
import sharp from "sharp";

/**
 * The board, at the sizes people actually run.
 *
 * No golden pixels: the sea moves, so any exact snapshot is a coin flip. What is
 * worth asserting is that the board is *there* — a WebGPU canvas that renders a
 * flat fill looks identical to a working one in every structural check, and that
 * is the failure this catches. Shots land under test-results/board/ for eyes.
 */

const SHOT_DIR = path.join("test-results", "board");

const SIZES = [
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "2560x1440", width: 2560, height: 1440 },
  { name: "3440x1440", width: 3440, height: 1440 },
];

type Mode = "canvas" | "fallback";

async function openBoard(page: import("@playwright/test").Page, url = "/map"): Promise<Mode> {
  await page.goto(url);
  const mounted = await page
    .locator("canvas")
    .first()
    .waitFor({ state: "visible", timeout: 25_000 })
    .then(() => true)
    .catch(() => false);
  if (!mounted) return "fallback";
  // Intro descent plus texture decode; the raster alone is a few megabytes.
  await page.waitForTimeout(5000);
  return "canvas";
}

/**
 * How many distinct colours the board is made of — a blank canvas has ~1.
 *
 * Read from Playwright's screenshot rather than from inside the page: a WebGPU
 * canvas cannot be `drawImage`d into a 2D context, so the obvious in-page
 * version returns one flat colour for a board that is rendering perfectly, and
 * would fail this suite for the exact thing it exists to prove.
 */
async function paletteSize(page: import("@playwright/test").Page): Promise<number> {
  const shot = await page.locator("canvas").first().screenshot();
  const { data } = await sharp(shot)
    .resize(160, 100, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const seen = new Set<number>();
  for (let i = 0; i < data.length; i += 3) {
    seen.add(((data[i] >> 3) << 10) | ((data[i + 1] >> 3) << 5) | (data[i + 2] >> 3));
  }
  return seen.size;
}

for (const size of SIZES) {
  test(`board fills a ${size.name} viewport`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: size.width, height: size.height });
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    const mode = await openBoard(page);
    await page.screenshot({ path: path.join(SHOT_DIR, `${size.name}.png`) });

    if (mode === "canvas") {
      // A canvas that mounted and then drew nothing is the WebGPU failure that
      // every structural assertion sails straight past.
      expect(await paletteSize(page), "board looks blank").toBeGreaterThan(200);
      const box = await page.locator("canvas").first().boundingBox();
      expect(box!.width).toBeGreaterThan(size.width * 0.6);
    } else {
      await expect(page.getByText(/no WebGPU/).first()).toBeVisible();
    }

    expect(errors.filter((e) => /ChunkLoadError|Hydration|Application error/i.test(e))).toEqual([]);
  });
}

test("geometry debug mode renders the boundaries it is there to prove", async ({ page }) => {
  test.setTimeout(90_000);
  const mode = await openBoard(page, "/map?debugGeometry=1&topDown=1");
  test.skip(mode === "fallback", "no WebGPU in this browser");
  await page.screenshot({ path: path.join(SHOT_DIR, "debug-geometry.png") });
  expect(await paletteSize(page)).toBeGreaterThan(200);
});

test("the board still plans regions with every 3D layer switched off", async ({ page }) => {
  // The layers are independent by design; losing one must not take the planner
  // with it. This is also the cheapest smoke test for the flag plumbing.
  const mode = await openBoard(page, "/map?no=water,vines,relief,markers,bloom");
  test.skip(mode === "fallback", "no WebGPU in this browser");
  await expect(page.getByRole("button", { name: /^Kandarin/ })).toBeVisible();
  expect(await paletteSize(page)).toBeGreaterThan(100);
});
