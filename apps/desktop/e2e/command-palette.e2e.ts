import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

test.beforeEach(async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "light" });
  await page.goto("/");
});

test("typing '>' switches the switcher from notes to commands", async ({ page }) => {
  await page.getByRole("button", { name: /Jump to/ }).click();
  const switcher = page.getByRole("dialog", { name: "Quick switcher" });
  await expect(switcher.getByText("Atomic Habits")).toBeVisible();

  await page.keyboard.type(">");
  await expect(switcher.getByText("Atomic Habits")).toHaveCount(0);
  await expect(switcher.getByText("Today", { exact: true })).toBeVisible();
  await expect(switcher.getByText("Graph view")).toBeVisible();
});

test("running the Today command from the palette opens today's daily note", async ({ page }) => {
  await page.getByRole("button", { name: /Jump to/ }).click();
  await page.keyboard.type(">today");
  await page.keyboard.press("Enter");

  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText("3 notes")).toBeVisible();
  const titleInput = page.locator("input[placeholder='Untitled']");
  await expect(titleInput).not.toHaveValue("");
});

test("running the Graph view command opens the graph, and the palette closes", async ({ page }) => {
  await page.getByRole("button", { name: /Jump to/ }).click();
  await page.keyboard.type(">graph");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("graph-view")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Quick switcher" })).toHaveCount(0);
});

test("shows an empty state when no command matches", async ({ page }) => {
  await page.getByRole("button", { name: /Jump to/ }).click();
  const switcher = page.getByRole("dialog", { name: "Quick switcher" });
  await page.keyboard.type(">zzznotacommand");
  await expect(switcher.getByText("No matching commands.")).toBeVisible();
});
