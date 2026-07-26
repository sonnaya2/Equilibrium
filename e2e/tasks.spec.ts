import { expect, test } from "@playwright/test";

test("tasks keeps Catalyst baseline provenance visible", async ({ page }) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  await page.goto("/tasks");

  await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toBeVisible();
  await expect(page.getByText(/Catalyst League baseline/i)).toBeVisible();
  await expect(page.getByText(/[\d,]+ tasks · completion/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Source", exact: true })).toHaveAttribute(
    "href",
    /runescape\.wiki\/w\/Catalyst_League\/Tasks/,
  );

  const rsn = page.getByRole("textbox", { name: "RuneScape name" });
  await expect(rsn).toBeVisible();
  await page.evaluate(() => {
    window.open = () => null;
  });
  await rsn.fill("JavaHomely");
  await page.getByRole("button", { name: "Open WikiSync" }).click();
  await expect(page.getByRole("status")).toContainText("WikiSync");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "RuneScape name" })).toHaveValue("JavaHomely");

  const importGuide = page.locator(".tasks-wikisync__guide");
  await importGuide.getByText("How to import", { exact: true }).click();
  await expect(importGuide).toContainText("Wait for completed rows to turn green.");
  await expect(importGuide).toContainText("Ctrl+S");
  await expect(importGuide).toContainText("Import saved page");

  await expect(page.getByRole("navigation", { name: "Primary" })).toContainText("Overview");
  await expect(page.locator("body > footer")).toContainText("RuneScape is a trademark of Jagex Ltd.");
  await expect(page.locator("[data-nextjs-dialog]")).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test("saved Wiki page imports completed task ids locally", async ({ page }) => {
  await page.goto("/tasks");

  const card = page.locator("[data-task-id]").first();
  const canonicalId = await card.getAttribute("data-task-id");
  const wikiTaskId = Number(canonicalId?.replace("wiki:", ""));
  expect(Number.isSafeInteger(wikiTaskId)).toBe(true);

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toBe("Mark 1 Wiki task complete?");
    await dialog.accept();
  });
  await page.getByLabel("Import saved Wiki page").setInputFiles({
    name: "Catalyst League Tasks.html",
    mimeType: "text/html",
    buffer: Buffer.from(`
      <table class="qc-active qc-wikisync">
        <tr class="highlight-on wikisync-completed" data-taskid="${wikiTaskId}"></tr>
        <tr class="highlight-on" data-taskid="999999"></tr>
      </table>
    `),
  });

  await expect(page.getByRole("status")).toContainText("1 task imported · 1 matched.");
  await expect(card.getByRole("button", { name: /Mark incomplete:/ })).toBeVisible();
});

test("task filters compose and completion state persists in the page model", async ({ page }) => {
  await page.goto("/tasks");

  const buildOnly = page.getByRole("button", { name: "My build only" });
  await expect(buildOnly).toHaveAttribute("aria-pressed", "true");

  const firstCard = page.locator("[data-task-id]").first();
  const title = (await firstCard.locator(".task-card__title").innerText()).trim();
  await page.getByRole("searchbox", { name: "Search" }).fill(title);
  await page.getByRole("button", { name: "Master", exact: true }).click();
  await expect(page.locator("[data-task-id]")).toHaveCount(1);

  const complete = page.getByRole("button", { name: /Mark complete:/ }).first();
  const completedId = await page.locator("[data-task-id]").first().getAttribute("data-task-id");
  await complete.click();
  await expect(page.getByRole("button", { name: /Mark incomplete:/ }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(async () => new Promise<string[]>((resolve, reject) => {
    const open = indexedDB.open("equilibrium");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const read = open.result
        .transaction("task-progress", "readonly")
        .objectStore("task-progress")
        .get("progress");
      read.onerror = () => reject(read.error);
      read.onsuccess = () => resolve(read.result?.completed ?? []);
    };
  }))).toContain(completedId);

  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(buildOnly).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("combobox", { name: "Skill filter" }).selectOption({ label: "Agility" });
  await expect(page.getByText(/results/).first()).toBeVisible();
  await expect(page.locator("[data-task-id]").first()).toBeVisible();
});

test("completion rates and pagination remain first-class", async ({ page }) => {
  await page.goto("/tasks");

  await page.getByRole("button", { name: "My build only" }).click();
  await page.getByLabel("Sort").selectOption("rarest");
  await expect(page.getByText("<0.1% of players").first()).toBeVisible();

  const pager = page.getByRole("navigation", { name: "Task pages" });
  await expect(pager).toContainText(/Page 1 of \d+/);
  await pager.getByRole("button", { name: "Next" }).click();
  await expect(pager).toContainText(/Page 2 of \d+/);
  await expect(page.locator("[data-task-id]").first()).toBeVisible();
});

test("pinning moves a task to the top and persists", async ({ page }) => {
  await page.goto("/tasks");
  await page.evaluate(() => localStorage.removeItem("eq:task-pins:v1"));
  await page.reload();

  const cards = page.locator("[data-task-id]");
  const target = cards.nth(1);
  const id = await target.getAttribute("data-task-id");
  await target.getByRole("button", { name: /^Pin / }).click();

  await expect(cards.first()).toHaveAttribute("data-task-id", id ?? "");
  await expect(cards.first().getByRole("button", { name: /^Unpin / })).toBeVisible();
  await page.reload();
  await expect(cards.first()).toHaveAttribute("data-task-id", id ?? "");
});
