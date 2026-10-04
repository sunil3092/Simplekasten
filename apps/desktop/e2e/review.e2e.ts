import { expect, test, type Page } from "@playwright/test";
import { stubBridge } from "./bridge";

// Fixture (see bridge.ts): "Atomic Habits" is fleeting, "Systems" is
// permanent — so the inbox starts with one note.
const open = async (page: Page, seed?: Parameters<typeof stubBridge>[2]) => {
  await stubBridge(page, { theme: "classic", themeMode: "light" }, seed);
  await page.goto("/");
};
const sidebar = (page: Page) => page.locator("aside").first();
const reviewButton = (page: Page) => sidebar(page).getByRole("button", { name: "Review" });
const count = (page: Page) => reviewButton(page).getByTestId("review-count");
const session = (page: Page) => page.getByTestId("review-session");
const title = (page: Page) => session(page).getByRole("textbox", { name: "Title" });

test("the badge counts fleeting notes and follows creates, sorting and deletes", async ({ page }) => {
  await open(page);
  await expect(count(page)).toHaveText("1");

  await sidebar(page).getByRole("button", { name: "New note" }).click();
  await expect(count(page)).toHaveText("2");

  await reviewButton(page).click();
  await expect(session(page).getByText("1 of 2")).toBeVisible();
  await expect(title(page)).toHaveValue("Atomic Habits");

  await session(page).getByRole("button", { name: "Permanent" }).click();
  await expect(session(page).getByText("2 of 2")).toBeVisible();
  await expect(title(page)).toHaveValue("Untitled");

  // Delete asks first.
  await session(page).getByRole("button", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete this note?" });
  await expect(confirm).toContainText("Untitled");
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(title(page)).toHaveValue("Untitled");
  await session(page).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("dialog", { name: "Delete this note?" }).getByRole("button", { name: "Delete" }).click();

  await expect(session(page).getByText("You're all caught up.")).toBeVisible();
  await session(page).getByRole("button", { name: "Close" }).last().click();
  await expect(count(page)).toHaveCount(0);
  await expect(sidebar(page).getByText("2 notes")).toBeVisible();
});

test("each type button is offered, and Skip leaves the note fleeting", async ({ page }) => {
  await open(page);
  await reviewButton(page).click();
  for (const name of ["Permanent", "Literature", "Structure", "Skip", "Delete"]) {
    await expect(session(page).getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(session(page).getByRole("button", { name: "Daily" })).toHaveCount(0);
  await expect(session(page).getByRole("button", { name: "Fleeting" })).toHaveCount(0);

  await session(page).getByRole("button", { name: "Skip" }).click();
  await expect(session(page).getByText("You're all caught up.")).toBeVisible();
  await session(page).getByRole("button", { name: "Close" }).last().click();
  await expect(count(page)).toHaveText("1");
});

test("a note can be rewritten in place before it is sorted", async ({ page }) => {
  await open(page);
  await reviewButton(page).click();
  await title(page).fill("Habits compound");
  const body = session(page).locator(".cm-content");
  await body.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" Rewritten in review.");
  await session(page).getByRole("button", { name: "Literature" }).click();
  await session(page).getByRole("button", { name: "Close" }).last().click();

  await sidebar(page).getByRole("button", { name: /Habits compound/ }).first().click();
  await expect(page.locator("main .cm-content")).toContainText("Rewritten in review.");
});

test("Escape saves an edit still waiting to be written", async ({ page }) => {
  await open(page);
  await reviewButton(page).click();
  await title(page).fill("Saved on the way out");
  await page.keyboard.press("Escape");
  await expect(session(page)).toHaveCount(0);
  await expect(sidebar(page).getByRole("button", { name: /Saved on the way out/ }).first()).toBeVisible();
});

test("a double click on a type button sorts one note", async ({ page }) => {
  await open(page, [
    { id: "a", zettelId: "1", title: "One", content: "", type: "fleeting", tags: [] },
    { id: "b", zettelId: "2", title: "Two", content: "", type: "fleeting", tags: [] },
    { id: "c", zettelId: "3", title: "Three", content: "", type: "fleeting", tags: [] },
  ]);
  await reviewButton(page).click();
  await session(page).getByRole("button", { name: "Permanent" }).dblclick();
  await expect(session(page).getByText("2 of 3")).toBeVisible();
  await expect(title(page)).toHaveValue("Two");
  await session(page).getByRole("button", { name: "Close" }).first().click();
  await expect(count(page)).toHaveText("2");
});

test("a failed type change stays on the note and says so", async ({ page }) => {
  await open(page);
  await reviewButton(page).click();
  // The stub's types aren't visible to the spec files, hence the cast.
  await page.evaluate(() => {
    (window as unknown as { simplekasten: { vault: { updateNote: () => Promise<never> } } }).simplekasten.vault.updateNote = async () => {
      throw new Error("disk full");
    };
  });
  await session(page).getByRole("button", { name: "Permanent" }).click();
  await expect(session(page).getByRole("alert")).toContainText("That didn't go through");
  await expect(session(page).getByText("1 of 1")).toBeVisible();
  await expect(title(page)).toHaveValue("Atomic Habits");
});

test("sorting the note that is open in the editor updates the editor", async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole("button", { name: /Atomic Habits/ }).first().click();
  await reviewButton(page).click();
  await session(page).getByRole("button", { name: "Structure" }).click();
  await session(page).getByRole("button", { name: "Close" }).last().click();
  // The editor behind Review shows the new type, not the one it loaded with.
  await expect(page.locator("main select").first()).toHaveValue("structure");
  // Structure notes are listed as Maps of Content.
  await expect(sidebar(page).getByText("Maps of content")).toBeVisible();
  await expect(count(page)).toHaveCount(0);
});

test("with nothing fleeting, Review opens caught up", async ({ page }) => {
  await open(page, [{ id: "b", zettelId: "1", title: "Systems", content: "", type: "permanent", tags: [] }]);
  await expect(count(page)).toHaveCount(0);
  await reviewButton(page).click();
  await expect(session(page).getByText("You're all caught up.")).toBeVisible();
  await expect(title(page)).toHaveCount(0);
});

test("the note header no longer has a review-queue button", async ({ page }) => {
  await open(page);
  await sidebar(page).getByRole("button", { name: /Atomic Habits/ }).first().click();
  await expect(page.getByRole("button", { name: /review queue/i })).toHaveCount(0);
});
