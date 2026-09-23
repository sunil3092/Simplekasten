import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

test.beforeEach(async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "light" });
  await page.goto("/");
});

test("creating a template shows it in the list, and it can be renamed and deleted", async ({ page }) => {
  await page.getByRole("button", { name: "Templates…" }).click();
  const modal = page.getByRole("dialog", { name: "Templates" });
  await expect(modal.getByText("No templates yet.")).toBeVisible();

  await modal.getByRole("button", { name: "New template" }).click();
  await modal.getByPlaceholder("Template name").fill("Daily Log");
  await modal.getByPlaceholder(/Template content/).fill("## Tasks\n\nHello, {{title}}!");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal.getByText("Daily Log")).toBeVisible();

  await modal.getByText("Daily Log").click();
  await expect(modal.getByPlaceholder("Template name")).toHaveValue("Daily Log");
  await modal.getByPlaceholder("Template name").fill("Journal");
  await modal.getByRole("button", { name: "Save" }).click();
  await expect(modal.getByText("Journal")).toBeVisible();
  await expect(modal.getByText("Daily Log")).toHaveCount(0);

  await modal.getByRole("button", { name: "Delete Journal" }).click();
  await expect(modal.getByText("No templates yet.")).toBeVisible();
});

test("setting a template as the daily default shows exactly one default at a time", async ({ page }) => {
  await page.getByRole("button", { name: "Templates…" }).click();
  const modal = page.getByRole("dialog", { name: "Templates" });

  for (const name of ["A", "B"]) {
    await modal.getByRole("button", { name: "New template" }).click();
    await modal.getByPlaceholder("Template name").fill(name);
    await modal.getByRole("button", { name: "Save" }).click();
  }

  await modal.getByRole("button", { name: "Use for daily notes" }).first().click();
  await expect(modal.getByText("DAILY DEFAULT")).toHaveCount(1);

  await modal.getByRole("button", { name: "Use for daily notes" }).click(); // now only B offers it
  await expect(modal.getByText("DAILY DEFAULT")).toHaveCount(1);
});

test("inserting a template appends its expanded content to the open note", async ({ page }) => {
  await page.getByRole("button", { name: "Templates…" }).click();
  const modal = page.getByRole("dialog", { name: "Templates" });
  await modal.getByRole("button", { name: "New template" }).click();
  await modal.getByPlaceholder("Template name").fill("Greeting");
  await modal.getByPlaceholder(/Template content/).fill("Hello, {{title}}!");
  await modal.getByRole("button", { name: "Save" }).click();
  await modal.getByRole("button", { name: "Close templates" }).click();

  await page.getByRole("button", { name: /Atomic Habits/ }).first().click();
  await page.getByRole("button", { name: "Insert template" }).click();
  await page.getByRole("button", { name: "Greeting" }).click();

  await expect(page.locator(".cm-content")).toContainText("Small changes compound.");
  await expect(page.locator(".cm-content")).toContainText("Hello, Atomic Habits!");
});
