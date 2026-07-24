import { expect, test } from "@playwright/test";

test("home renders nav and footer", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "EQUILIBRIUM" })).toBeVisible();
  const nav = page.getByRole("navigation");
  for (const label of ["Overview", "Map", "Tasks", "Build", "Combat", "Data"]) {
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
  await expect(page.getByText("RuneScape is a trademark of Jagex Ltd.")).toBeVisible();
});

test("all routes respond", async ({ page }) => {
  for (const path of ["/", "/map", "/tasks", "/build", "/combat", "/data", "/sources"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});
