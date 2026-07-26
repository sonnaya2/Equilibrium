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

  await expect(page.getByRole("textbox", { name: "RuneScape name" })).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "RuneScape Wiki: “publicly available to anyone”" }),
  ).toHaveAttribute("href", "https://runescape.wiki/w/RuneScape:WikiSync");
  await page.getByRole("button", { name: "Import Wiki progress" }).click();
  const importWindow = page.getByRole("dialog", { name: "Import Wiki progress" });
  await expect(importWindow).toBeVisible();
  await expect(importWindow.getByRole("link", { name: "Wiki task page" })).toHaveAttribute(
    "href",
    /runescape\.wiki\/w\/Catalyst_League\/Tasks/,
  );
  await expect(importWindow).toContainText("Wait for your completed tasks to turn green.");
  await expect(importWindow).toContainText("Ctrl+S");
  await expect(importWindow).toContainText("Processed locally. Not uploaded.");
  await expect(
    importWindow.getByRole("link", {
      name: "RuneScape Wiki: “publicly available to anyone”",
    }),
  ).toHaveAttribute("href", "https://runescape.wiki/w/RuneScape:WikiSync");
  await expect(importWindow.getByRole("button", { name: "Browse" })).toBeVisible();
  await expect(importWindow.getByRole("button", { name: "Upload" })).toBeDisabled();

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

  await page.getByRole("button", { name: "Import Wiki progress" }).click();
  const importWindow = page.getByRole("dialog", { name: "Import Wiki progress" });
  await importWindow.getByLabel("Choose saved Wiki page").setInputFiles({
    name: "Catalyst League Tasks.html",
    mimeType: "text/html",
    buffer: Buffer.from(`
      <table class="qc-active qc-wikisync">
        <tr class="highlight-on wikisync-completed" data-taskid="${wikiTaskId}"></tr>
        <tr class="highlight-on" data-taskid="999999"></tr>
      </table>
    `),
  });

  await expect(importWindow).toContainText("Catalyst League Tasks.html");
  await importWindow.getByRole("button", { name: "Upload" }).click();
  await expect(importWindow.getByRole("status")).toContainText("1 task imported · 1 matched.");
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
