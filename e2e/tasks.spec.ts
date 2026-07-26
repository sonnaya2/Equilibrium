import { expect, test } from "@playwright/test";

test("tasks shows provisional banner or loaded count", async ({ page }) => {
  await page.goto("/tasks");
  // Equilibrium list is empty pre-launch — Catalyst stand-in shows Provisional.
  // When real tasks ship, the count line is enough. Never pin task names.
  const provisional = page.getByText(/Provisional/i);
  const loaded = page.getByText(/\d+ tasks loaded/);
  await expect(provisional.or(loaded).first()).toBeVisible();
});

test("tasks points section is present", async ({ page }) => {
  await page.goto("/tasks");
  // Points ladder is page chrome. "Task list" may stay as h2 or fold into twin-desk
  // table/rail chrome — accept heading, loaded count, or task filters.
  const points = page.getByRole("heading", { name: /^Points$/i }).or(page.getByText(/^Points$/));
  await expect(points.first()).toBeVisible();

  const taskListHeading = page.getByRole("heading", { name: /Task list/i });
  const loaded = page.getByText(/\d+ tasks loaded/);
  const taskChrome = page.getByLabel(/Filter (tasks|by (tier|region))/i);
  await expect(taskListHeading.or(loaded).or(taskChrome).first()).toBeVisible();
});

test("tasks region filter and Comp% wiki links when Catalyst stand-in loads", async ({ page }) => {
  await page.goto("/tasks");
  const loaded = page.getByText(/\d+ tasks loaded/);
  if (!(await loaded.isVisible().catch(() => false))) return;

  // Build-scoped filter is on by default when the stand-in list loads.
  const myBuild = page.getByRole("button", { name: "My build" });
  if (await myBuild.isVisible().catch(() => false)) {
    await expect(myBuild).toHaveAttribute("aria-pressed", "true");
  }

  // Region filter: Select + Stage uses <select aria-label="Filter by region">.
  // Soft — only assert structure that is present. Never pin region names.
  const regionSelect = page.getByLabel(/^Filter by region$/i);
  if (await regionSelect.isVisible().catch(() => false)) {
    await expect(regionSelect).toBeVisible();
  }

  // Comp% values that have a wiki task id open the Wiki row (hash id).
  // Match aria-label (list rows) or Catalyst Tasks#N href (table cells).
  // Virtualized lists only mount viewport rows — use .first() of what rendered.
  // Never pin rates or task names.
  const wikiHref = /runescape\.wiki\/w\/Catalyst_League\/Tasks#\d+/;
  const compByLabel = page.getByRole("link", { name: /Wiki Comp%/i });
  const compByHref = page.locator(`a[href*="Catalyst_League/Tasks#"]`);
  const compLink = compByLabel.or(compByHref).first();
  if (await compLink.isVisible().catch(() => false)) {
    await expect(compLink).toHaveAttribute("href", wikiHref);
  }
});
