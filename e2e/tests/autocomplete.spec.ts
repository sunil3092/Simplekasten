import { expect, test } from "@playwright/test";
import { createNote, registerAndEnterVault } from "./helpers";

test("typing [[ suggests existing note titles and Enter inserts a closed link", async ({ page }) => {
  await registerAndEnterVault(page, "Autocomplete Test");
  await createNote(page, "Existing Target Note", "the destination");
  await createNote(page, "Source Note", "");

  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.pressSequentially("See [[Exist", { delay: 20 });

  // The tooltip can render while CodeMirror is still debouncing a completion
  // recomputed by the last keystroke (activateOnTypingDelay). Waiting for an
  // option to actually be marked aria-selected — not just for the tooltip to
  // be visible — confirms the completion has settled into its "active" state,
  // which is what the accept-on-Enter keymap binding requires to fire.
  await expect(page.locator('.cm-tooltip-autocomplete li[aria-selected="true"]')).toHaveText("Existing Target Note");
  // A real person's reaction time to seeing that selection is well beyond
  // this; pressing Enter in the exact same tick the debounce settles can
  // race the completion back into a transient "pending" recompute (it
  // re-runs its source on every keystroke, with no validFor to skip that),
  // which briefly makes it invisible to the accept-on-Enter keymap binding.
  await page.waitForTimeout(150);

  await page.keyboard.press("Enter");
  await editor.pressSequentially(" done", { delay: 20 });

  await expect(editor).toContainText("See [[Existing Target Note]] done");
});

test("typing [[ auto-closes the brackets so the cursor lands inside them", async ({ page }) => {
  await registerAndEnterVault(page, "Autoclose Test");
  await createNote(page, "Note One", "");

  const editor = page.locator(".cm-content");
  await editor.click();
  await editor.pressSequentially("[[", { delay: 20 });

  await expect(editor).toContainText("[[]]");
});
