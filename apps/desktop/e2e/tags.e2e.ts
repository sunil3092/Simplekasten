import { expect, test } from "@playwright/test";
import { stubBridge } from "./bridge";

// Fixture: "Atomic Habits" has #habits in its text and no assigned tags;
// "Systems" has the assigned tag "method" (see bridge.ts).
test("tag dropdown assigns, creates and unassigns tags; #hashtags are locked", async ({ page }) => {
  await stubBridge(page, { theme: "memphis", themeMode: "light" });
  await page.goto("/");
  await page.getByRole("button", { name: /Atomic Habits/ }).first().click();

  const trigger = page.getByRole("button", { name: /^Tags/ });
  await trigger.click();
  const list = page.getByRole("listbox", { name: "Tags" });

  // The hashtag from the text is ticked but can't be removed here.
  const habits = list.getByRole("option", { name: /#habits/ });
  await expect(habits).toHaveAttribute("aria-selected", "true");
  await expect(habits).toHaveAttribute("aria-disabled", "true");
  await expect(habits).toContainText("in text");

  // Assign an existing tag from another note.
  await list.getByRole("option", { name: /#method/ }).click();
  await expect(list.getByRole("option", { name: /#method/ })).toHaveAttribute("aria-selected", "true");

  // Create a new one with the keyboard; a leading # is fine.
  await page.getByLabel("Find or create a tag…").fill("#Reading");
  await expect(page.getByRole("button", { name: "Create #reading" })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(list.getByRole("option", { name: /#reading/ })).toHaveAttribute("aria-selected", "true");

  // Invalid names are explained, not saved.
  await page.getByLabel("Find or create a tag…").fill("two words");
  await expect(list.getByText(/Tags start with a letter/)).toBeVisible();
  await page.getByLabel("Find or create a tag…").fill("");

  // Unassign, then close with Escape.
  await list.getByRole("option", { name: /#method/ }).click();
  await expect(list.getByRole("option", { name: /#method/ })).toHaveAttribute("aria-selected", "false");
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();

  // The trigger counts the note's tags: #habits + #reading.
  await expect(trigger).toContainText("2");
  // And the sidebar's tag chips pick up the new tag.
  await expect(page.locator("aside").first().getByRole("button", { name: /#reading/ })).toBeVisible();
});
