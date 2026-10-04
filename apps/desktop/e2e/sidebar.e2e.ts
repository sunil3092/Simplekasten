import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

test("sidebar sections collapse independently while Settings stays visible", async ({
  page,
}) => {
  await stubBridge(page, { theme: "classic", themeMode: "system" });
  await page.goto("/");

  // Create, Navigate, Views, Tags and the note list — Tags only appears once the vault has loaded.
  await expect(page.locator("aside details")).toHaveCount(5);
  const groups = await page.locator("aside details").all();

  for (const group of groups) {
    await expect(group).toHaveJSProperty("open", true);
    await group.locator("summary").click();
    await expect(group).toHaveJSProperty("open", false);
  }

  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();

  const notes = groups.at(-1)!;
  await notes.locator("summary").click();
  await expect(notes).toHaveJSProperty("open", true);
});

test("vault folder controls live in Settings, not the sidebar", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" });
  await page.goto("/");

  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByRole("button", { name: "Choose vault folder…" })).toHaveCount(0);

  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await expect(settings.getByTestId("vault-path")).toHaveText("/fixture");
  await expect(settings.getByRole("button", { name: "Choose vault folder…" })).toBeVisible();
  await expect(settings.getByRole("button", { name: "Show vault location" })).toBeVisible();
});

test("shortcut hints name the key for the platform: Ctrl on Windows and Linux, ⌘ on a Mac", async ({ browser }) => {
  for (const [platform, jump, today] of [
    ["Win32", "Ctrl+K", "Ctrl+J"],
    ["MacIntel", "⌘K", "⌘J"],
  ] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.addInitScript((p) => Object.defineProperty(navigator, "platform", { get: () => p }), platform);
    await stubBridge(page, { theme: "classic", themeMode: "light" });
    await page.goto("/");
    await expect(page.getByRole("button", { name: /Jump to/ })).toContainText(jump);
    await expect(page.getByRole("button", { name: /Today/ })).toContainText(today);
    await context.close();
  }
});

test("purging the vault takes a warning and the vault's name, then leaves an empty vault", async ({ page }) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" });
  await page.goto("/");
  const sidebar = page.locator("aside").first();
  await expect(sidebar.getByText("2 notes")).toBeVisible();

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Purge vault…" }).click();
  const dialog = page.getByRole("dialog", { name: "Purge vault" });

  // First confirmation: what will go.
  await expect(dialog.getByTestId("purge-summary")).toContainText("2 notes");
  await expect(dialog).toContainText("cannot be undone");
  // Escape backs out of the purge only; Settings stays, and nothing is deleted.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
  await expect(sidebar.getByText("2 notes")).toBeVisible();

  // Second confirmation: the vault's name (the fixture vault is "/fixture").
  await page.getByRole("button", { name: "Purge vault…" }).click();
  await dialog.getByRole("button", { name: "Continue" }).click();
  const purge = dialog.getByRole("button", { name: "Purge vault" });
  await expect(purge).toBeDisabled();
  await dialog.getByRole("textbox").fill("wrong");
  await expect(purge).toBeDisabled();
  await dialog.getByRole("textbox").fill("fixture");
  await purge.click();

  await expect(page.getByRole("dialog", { name: "Settings" })).toBeHidden();
  await expect(sidebar.getByText("0 notes")).toBeVisible();
  await expect(page.getByText(/Your vault is empty/)).toBeVisible();
});
