import { expect, test } from "@playwright/test";

test("home renders nav and footer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "EQUILIBRIUM" })).toBeVisible();
  const nav = page.getByRole("navigation");
  for (const label of ["Overview", "Map", "Tasks", "Build", "Combat", "Data"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  const footer = page.locator("body > footer");
  await expect(footer).toContainText(
    "Created using intellectual property belonging to Jagex Limited under the terms of Jagex's Fan Content Policy.",
  );
  await expect(footer).toContainText("RuneScape is a trademark of Jagex Ltd.");
  await footer.getByText("Licenses", { exact: true }).click();
  await expect(footer.getByText("CC BY-NC-SA 3.0", { exact: true })).toBeVisible();
});

test("all routes respond", async ({ page }) => {
  for (const path of ["/", "/map", "/tasks", "/build", "/combat", "/data", "/sources"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});

test("data region rail owns every downstream filter", async ({ page }) => {
  await page.goto("/data");

  const misthalinSkills = page.getByRole("listbox", { name: "Skills in Misthalin" });
  await expect(misthalinSkills).toBeVisible();
  await expect(misthalinSkills.getByRole("option", { name: /^Archaeology/ })).toBeVisible();
  await expect(misthalinSkills.getByRole("option", { name: /^Magic/ })).toBeVisible();
  await expect(misthalinSkills.getByRole("option", { name: /^Prayer/ })).toBeVisible();
  await misthalinSkills.getByRole("option", { name: /^Magic/ }).click();
  await expect(page.getByRole("heading", { name: /^Standard spellbook/ })).toBeVisible();
  await misthalinSkills.getByRole("option", { name: "All skills", exact: true }).click();
  await expect(
    page.locator(".data-upgrade-row__name").filter({ hasText: /^Ancient Summoning/ }),
  ).toBeVisible();
  await expect(
    page
      .locator(".data-upgrade-row")
      .filter({ hasText: /^Expansive essence pouch/ })
      .getByLabel("Region combo: misthalin + forinthry"),
  ).toHaveCount(1);
  await expect(
    page.locator(".data-region-content-table tbody tr").filter({ hasText: "Kerapac" }),
  ).toContainText("Fractured Staff of Armadyl");
  await expect(page.getByText("Major unlocks", { exact: true })).toBeVisible();
  await expect(page.locator(".data-region-content-table")).not.toContainText("Vermyx");
  await page.getByRole("button", { name: "View Varrock Dig Site image" }).click();
  await expect(page.getByRole("dialog", { name: "Varrock Dig Site image" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("combobox", { name: "Sort browse data" }).selectOption("name");
  await expect(page.locator(".data-region-content-table tbody tr").first()).toContainText("Arch-Glacor");

  await page.getByRole("option", { name: /^Havenhythe,/ }).click();
  const skills = page.getByRole("listbox", { name: "Skills in Havenhythe" });
  await expect(skills.getByRole("option", { name: /^Archaeology/ })).toBeVisible();
  await skills.getByRole("option", { name: /^Archaeology/ }).click();
  await expect(page.getByRole("heading", { name: "Archaeology" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Archaeology training in Havenhythe" })).toBeVisible();

  const dataTabs = page.getByRole("tablist", { name: "Data" });
  await expect(dataTabs.getByRole("tab", { name: "Systems", exact: true })).toHaveCount(0);
  await expect(dataTabs.getByRole("tab", { name: "Crafting", exact: true })).toHaveCount(0);
  await expect(dataTabs.getByRole("tab", { name: "Prayers", exact: true })).toHaveCount(0);
  await expect(dataTabs.getByRole("tab", { name: "Notes", exact: true })).toHaveCount(0);
  await expect(dataTabs.getByRole("tab", { name: "Boundaries", exact: true })).toHaveCount(0);
  await dataTabs.getByRole("tab", { name: "Quests", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Region" })).toHaveCount(0);
  await expect(page.getByText("Hearts of Sanguine", { exact: false })).toBeVisible();
  await expect(page.getByText("A Fairy Tale I - Growing Pains", { exact: false })).toHaveCount(0);

  await page.getByRole("option", { name: /^Misthalin,/ }).click();
  await expect(page.getByText("A Fairy Tale I - Growing Pains", { exact: false })).toBeVisible();
  await expect(page.getByText("Hearts of Sanguine", { exact: false })).toHaveCount(0);

  await dataTabs.getByRole("tab", { name: "Progression", exact: true }).click();
  await expect(page.getByRole("option", { name: /^Misthalin,/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel").getByLabel(/^[1-9]\d* routes$/)).toBeVisible();

  await page.getByRole("option", { name: /^Havenhythe,/ }).click();
  await expect(page.getByLabel("0 routes", { exact: true })).toBeVisible();
  await dataTabs.getByRole("tab", { name: "Unlocks", exact: true }).click();
  await expect(page.getByLabel("0 records", { exact: true })).toBeVisible();
});
