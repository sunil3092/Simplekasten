import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export function uniqueEmail(label: string): string {
  // Test labels are human-readable ("Theme Test") but an email's local part
  // can't contain a space — slugify so the label stays descriptive in test
  // output while the address stays valid.
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${slug}-${randomUUID()}@example.test`;
}

/** Registers a brand-new account through the real UI and waits for the vault shell to render. */
export async function registerAndEnterVault(page: Page, label: string): Promise<{ email: string }> {
  const email = uniqueEmail(label);
  await page.goto("/");
  await page.getByText(/need an account\? register/i).click();
  await page.getByPlaceholder("Display name").fill(label);
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("correcthorse-battery-staple");
  await page.getByRole("button", { name: /create account/i }).click();
  await page.getByRole("button", { name: /\+ new note/i }).first().waitFor();
  return { email };
}

/** Creates a note via the sidebar button and renames it in one step, leaving it open. */
export async function createNote(page: Page, title: string, content: string): Promise<void> {
  await page.getByRole("button", { name: /\+ new note/i }).first().click();
  const titleInput = page.locator('input[class*="font-display"]');
  // Creating a note is asynchronous (create, then re-fetch) — filling the
  // title as soon as *an* input is visible can land on the *previous* note,
  // which is still displayed until the new one finishes loading. The app
  // itself auto-focuses and selects the title the instant the new note
  // becomes current, so that focus is the reliable "it's ready" signal.
  // A generous timeout absorbs a cold Next.js dev-server compile of the
  // editor bundle on the very first note created after a fresh server start
  // (the default 5s expect timeout has been marginal for that one-time cost).
  await expect(titleInput).toBeFocused({ timeout: 15000 });
  await titleInput.fill(title);
  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.pressSequentially(content, { delay: 2 });
  // Wait for the debounced autosave (600ms) to actually land, by watching
  // for its specific, unambiguous effect — the sidebar picking up the new
  // title. The generic "Saved" indicator is the wrong signal here: it can
  // already be showing (left over from a previous note) and so resolves
  // immediately, before this note's own save has actually gone through.
  await page.locator("aside").first().getByText(title, { exact: true }).waitFor({ timeout: 5000 });
}
