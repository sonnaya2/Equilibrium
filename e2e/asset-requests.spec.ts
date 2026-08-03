import { expect, test } from "@playwright/test";

/**
 * Runtime proof that publishing from assets/ serves every image the app asks for.

 * The vitest suites resolve dataset records through the real icon resolvers and
 * are the authoritative reference graph; this catches the rest - paths built in
 * CSS, markup, or components that no dataset row reaches.
 */
const ROUTES = ["/", "/map", "/tasks", "/build", "/combat", "/data", "/sources"];

const REGIONS = [
  "misthalin",
  "asgarnia",
  "kandarin",
  "karamja",
  "morytania",
  "desert",
  "fremennik",
  "tirannwn",
  "wilderness",
  "daemonheim",
  "havenhythe",
];

type Broken = { url: string; status: number; type: string | null };

async function collectAssetFailures(
  page: import("@playwright/test").Page,
  paths: string[],
): Promise<Broken[]> {
  const broken: Broken[] = [];

  page.on("response", (response) => {
    const url = new URL(response.url());
    if (!/^\/(game|brand)\//.test(url.pathname)) return;
    const status = response.status();
    const type = response.headers()["content-type"] ?? null;
    // 304 carries no body and no content-type; only a served body proves the type.
    const wrongType = status === 200 && !type?.startsWith("image/");
    if (status >= 400 || wrongType) broken.push({ url: url.pathname, status, type });
  });

  for (const path of paths) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  return broken;
}

test("no route requests a missing image", async ({ page }) => {
  const broken = await collectAssetFailures(page, ROUTES);
  expect(broken, `broken asset requests:\n${JSON.stringify(broken, null, 2)}`).toEqual([]);
});

test("every region detail resolves its art", async ({ page }) => {
  const broken = await collectAssetFailures(
    page,
    REGIONS.map((id) => `/data/regions/${id}`),
  );
  expect(broken, `broken asset requests:\n${JSON.stringify(broken, null, 2)}`).toEqual([]);
});
