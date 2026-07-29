import { expect, test } from "@playwright/test";
import path from "node:path";
import sharp from "sharp";


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
  await page.waitForTimeout(5000);
  return "canvas";
}

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
  const mode = await openBoard(page, "/map?no=water,relief,markers,bloom");
  test.skip(mode === "fallback", "no WebGPU in this browser");
  await expect(page.getByRole("button", { name: /^Kandarin/ })).toBeVisible();
  expect(await paletteSize(page)).toBeGreaterThan(100);
});
